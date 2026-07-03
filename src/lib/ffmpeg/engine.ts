/**
 * FfmpegEngine: lazy-loading singleton wrapper around @ffmpeg/ffmpeg.
 * Serializes jobs (single wasm worker), mounts inputs via WORKERFS with a
 * writeFile fallback, normalizes the unreliable progress events, and maps
 * cancellation to terminate()+reload.
 */
import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
// @ffmpeg/core's exports field only exposes "." (esm js) and "./wasm";
// deep dist/esm paths are rejected by Vite's strict exports resolution
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import type {
  EngineStatus,
  JobCallbacks,
  JobRequest,
  JobResult,
  MediaInfo,
} from '../../types'
import { probeFile, sanitizeFsName } from './probe'

const INPUT_DIR = '/job-input'
const LOG_TAIL_MAX = 40
const ERROR_TAIL_LINES = 8

export class FfmpegEngine {
  status: EngineStatus = 'unloaded'
  private ffmpeg = new FFmpeg()
  private loadPromise?: Promise<void>
  /** covers both runJob and probe — the worker handles one command at a time */
  private busy = false

  ensureLoaded(onProgress?: (ratio: number) => void): Promise<void> {
    if (this.status === 'ready' || this.status === 'running') return Promise.resolve()
    if (!this.loadPromise) this.loadPromise = this.doLoad(onProgress)
    return this.loadPromise
  }

  private async doLoad(onProgress?: (ratio: number) => void): Promise<void> {
    this.status = 'loading'
    try {
      const wasmBlobURL = await downloadToBlobURL(wasmURL, 'application/wasm', onProgress)
      try {
        // coreURL js is tiny, the same-origin URL can be passed as-is
        await this.ffmpeg.load({ coreURL, wasmURL: wasmBlobURL })
      } finally {
        URL.revokeObjectURL(wasmBlobURL)
      }
      this.status = 'ready'
      onProgress?.(1)
    } catch (err) {
      // cancel() may have flipped status to 'unloaded' already — keep that
      if (this.status === 'loading') this.status = 'error'
      this.loadPromise = undefined
      throw err
    }
  }

  async runJob(req: JobRequest, cbs?: JobCallbacks): Promise<JobResult> {
    if (this.busy) throw new Error('Engine is busy — only one job can run at a time')
    await this.ensureLoaded()
    this.busy = true
    this.status = 'running'

    const logTail: string[] = []
    const onLog = ({ message }: { message: string }) => {
      logTail.push(message)
      if (logTail.length > LOG_TAIL_MAX) logTail.shift()
      cbs?.onLog?.(message)
    }
    const expected = req.expectedOutputDurationSec
    const onProgress = ({ progress, time }: { progress: number; time: number }) => {
      // ffmpeg.wasm progress events are unreliable (negative/NaN/jumps);
      // prefer output time / expected duration, clamp everything to [0,1]
      const ratio =
        expected && expected > 0 && Number.isFinite(time) ? time / 1_000_000 / expected : progress
      if (!Number.isFinite(ratio)) return
      cbs?.onProgress?.(Math.min(1, Math.max(0, ratio)))
    }
    this.ffmpeg.on('log', onLog)
    this.ffmpeg.on('progress', onProgress)

    const inputName = sanitizeFsName(req.inputName)
    let outputPath = sanitizeFsName(req.outputName)
    // fallback path writes the input at FS root — keep output distinct
    if (outputPath === inputName) outputPath = `out_${outputPath}`
    let inputPath = `${INPUT_DIR}/${inputName}`
    let mounted = false
    let wroteInput = false

    try {
      try {
        // WORKERFS = zero-copy read-only view of the browser file
        await this.ffmpeg.createDir(INPUT_DIR)
        await this.ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: inputName, data: req.input }] }, INPUT_DIR)
        mounted = true
      } catch {
        // mount is flaky (ffmpeg.wasm#757) — fall back to a MEMFS copy
        inputPath = inputName
        await this.ffmpeg.writeFile(inputPath, await fetchFile(req.input))
        wroteInput = true
      }

      // runner built args with the original names; swap in actual FS paths
      const args = req.args.map((a) =>
        a === req.inputName ? inputPath : a === req.outputName ? outputPath : a,
      )
      const code = await this.ffmpeg.exec(args)
      if (code !== 0) {
        throw new Error(
          `ffmpeg exited with code ${code}\n${logTail.slice(-ERROR_TAIL_LINES).join('\n')}`,
        )
      }

      const data = await this.ffmpeg.readFile(outputPath)
      try {
        await this.ffmpeg.deleteFile(outputPath)
      } catch {
        /* ignore */
      }
      if (typeof data === 'string') throw new Error('Unexpected text output, expected binary data')
      return { data, outputName: req.outputName }
    } catch (err) {
      this.recoverIfCorrupted(err)
      throw err
    } finally {
      this.ffmpeg.off('log', onLog)
      this.ffmpeg.off('progress', onProgress)
      // skip FS cleanup after terminate() — the FS is gone with the worker
      if (this.ffmpeg.loaded) {
        if (mounted) {
          try {
            await this.ffmpeg.unmount(INPUT_DIR)
          } catch {
            /* ignore */
          }
        }
        try {
          await this.ffmpeg.deleteDir(INPUT_DIR)
        } catch {
          /* ignore */
        }
        if (wroteInput) {
          try {
            await this.ffmpeg.deleteFile(inputPath)
          } catch {
            /* ignore */
          }
        }
      }
      this.busy = false
      // cancel() may have flipped status to 'unloaded' — keep that
      if (this.status === 'running') this.status = 'ready'
    }
  }

  /**
   * Hard-stop the worker. Pending runJob/probe promises reject with
   * "called FFmpeg.terminate()"; the next ensureLoaded() re-loads the core.
   */
  cancel(): void {
    try {
      this.ffmpeg.terminate()
    } catch {
      /* worker may not exist yet */
    }
    this.loadPromise = undefined
    this.busy = false
    this.status = 'unloaded'
  }

  async probe(file: File): Promise<MediaInfo> {
    if (this.busy) throw new Error('Engine is busy — cannot probe the file right now')
    await this.ensureLoaded()
    this.busy = true
    try {
      return await probeFile(this.ffmpeg, file)
    } catch (err) {
      this.recoverIfCorrupted(err)
      throw err
    } finally {
      this.busy = false
    }
  }

  /**
   * A wasm-level trap (e.g. "memory access out of bounds", seen with some
   * codec combos, ffmpeg.wasm#591) leaves the core corrupted: every later
   * command fails the same way. Detect it and discard the worker so the
   * next job transparently reloads a fresh core. Controlled failures
   * (non-zero exit codes) never take this path.
   */
  private recoverIfCorrupted(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err)
    if (/RuntimeError|memory access|out of bounds|unreachable|abort\(/i.test(msg)) {
      this.cancel()
    }
  }
}

let singleton: FfmpegEngine | undefined

export function getEngine(): FfmpegEngine {
  if (!singleton) singleton = new FfmpegEngine()
  return singleton
}

/**
 * Fetch a same-origin asset into a blob URL, reporting byte progress.
 * Without Content-Length progress stays at 0 (indeterminate) until done;
 * the caller reports 1 when the whole load finishes.
 */
async function downloadToBlobURL(
  url: string,
  mime: string,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Failed to download ffmpeg core: HTTP ${res.status}`)
  const total = Number(res.headers.get('Content-Length') ?? 0)
  const reader = res.body.getReader()
  const chunks: BlobPart[] = []
  let received = 0
  onProgress?.(0)
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    if (total > 0) onProgress?.(Math.min(0.999, received / total))
  }
  return URL.createObjectURL(new Blob(chunks, { type: mime }))
}
