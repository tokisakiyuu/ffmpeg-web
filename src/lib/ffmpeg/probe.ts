/**
 * Media probing: extract MediaInfo from a browser File using a loaded
 * FFmpeg instance. Tries `ffprobe -of json` first, falls back to parsing
 * the `-i` stderr banner when ffprobe is unavailable or fails.
 */
import { FFFSType, type FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import type { MediaInfo } from '../../types'
import { splitExt } from '../format'

/** wasm FS paths cannot contain path separators */
export function sanitizeFsName(name: string): string {
  const cleaned = name.replace(/[\\/]/g, '_').trim()
  return cleaned || 'file'
}

const PROBE_DIR = '/probe-input'
const PROBE_OUT = 'probe-output.json'

export async function probeFile(ffmpeg: FFmpeg, file: File): Promise<MediaInfo> {
  const name = sanitizeFsName(file.name || 'input')
  let inputPath = `${PROBE_DIR}/${name}`
  let mounted = false
  let wrote = false
  try {
    try {
      // WORKERFS avoids copying a possibly huge file just to read metadata
      await ffmpeg.createDir(PROBE_DIR)
      await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name, data: file }] }, PROBE_DIR)
      mounted = true
    } catch {
      // mount is flaky (ffmpeg.wasm#757) — fall back to a MEMFS copy
      inputPath = name
      await ffmpeg.writeFile(inputPath, await fetchFile(file))
      wrote = true
    }

    const info =
      (await tryFfprobeJson(ffmpeg, inputPath)) ?? (await parseFromStderr(ffmpeg, inputPath))
    if (info.container === undefined) {
      const [, ext] = splitExt(name)
      if (ext) info.container = ext
    }
    return info
  } finally {
    if (mounted) {
      try {
        await ffmpeg.unmount(PROBE_DIR)
      } catch {
        /* ignore */
      }
    }
    try {
      // dir may exist even when mount failed
      await ffmpeg.deleteDir(PROBE_DIR)
    } catch {
      /* ignore */
    }
    if (wrote) {
      try {
        await ffmpeg.deleteFile(inputPath)
      } catch {
        /* ignore */
      }
    }
  }
}

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
}

interface FfprobeFormat {
  duration?: string
  bit_rate?: string
  format_name?: string
}

interface FfprobeJson {
  streams?: FfprobeStream[]
  format?: FfprobeFormat
}

/** undefined means "fall back to stderr parsing" */
async function tryFfprobeJson(ffmpeg: FFmpeg, inputPath: string): Promise<MediaInfo | undefined> {
  try {
    // `-o file` form is the documented way to capture ffprobe output in
    // ffmpeg.wasm (see FFmpeg.ffprobe JSDoc example)
    const code = await ffmpeg.ffprobe([
      '-v',
      'error',
      '-show_format',
      '-show_streams',
      '-of',
      'json',
      inputPath,
      '-o',
      PROBE_OUT,
    ])
    if (code !== 0) return undefined
    const raw = await ffmpeg.readFile(PROBE_OUT, 'utf8')
    try {
      await ffmpeg.deleteFile(PROBE_OUT)
    } catch {
      /* ignore */
    }
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    return parseProbeJson(JSON.parse(text) as FfprobeJson)
  } catch {
    return undefined
  }
}

function parseProbeJson(json: FfprobeJson): MediaInfo {
  const info: MediaInfo = {}
  const video = json.streams?.find((s) => s.codec_type === 'video')
  const audio = json.streams?.find((s) => s.codec_type === 'audio')
  if (video) {
    if (video.codec_name) info.videoCodec = video.codec_name
    if (typeof video.width === 'number' && video.width > 0) info.width = video.width
    if (typeof video.height === 'number' && video.height > 0) info.height = video.height
  }
  if (audio?.codec_name) info.audioCodec = audio.codec_name
  const duration = Number(json.format?.duration)
  if (Number.isFinite(duration) && duration > 0) info.durationSec = duration
  const bitrate = Number(json.format?.bit_rate)
  if (Number.isFinite(bitrate) && bitrate > 0) info.bitrateKbps = Math.round(bitrate / 1000)
  const fmt = json.format?.format_name
  if (fmt) info.container = fmt.split(',')[0]
  return info
}

async function parseFromStderr(ffmpeg: FFmpeg, inputPath: string): Promise<MediaInfo> {
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', onLog)
  try {
    // exits non-zero (no output file) — we only want the input banner
    await ffmpeg.exec(['-i', inputPath])
  } finally {
    ffmpeg.off('log', onLog)
  }
  return parseBanner(lines.join('\n'))
}

/** best-effort parse of the `ffmpeg -i` stderr banner */
export function parseBanner(text: string): MediaInfo {
  const info: MediaInfo = {}
  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text)
  if (dur) info.durationSec = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])
  const br = /Duration:[^\n]*bitrate:\s*(\d+(?:\.\d+)?)\s*kb\/s/.exec(text)
  if (br) info.bitrateKbps = Math.round(Number(br[1]))
  const input = /Input #\d+,\s*([^,\n]+)/.exec(text)
  if (input) info.container = input[1].trim()
  const video = /Stream #[^\n]*Video:\s*([A-Za-z0-9_]+)/.exec(text)
  if (video) info.videoCodec = video[1]
  // require a separator before/after so hex ids like "0x31637634" don't match
  const size = /Stream #[^\n]*Video:[^\n]*?[\s,](\d{2,5})x(\d{2,5})(?:[\s,[]|$)/m.exec(text)
  if (size) {
    info.width = Number(size[1])
    info.height = Number(size[2])
  }
  const audio = /Stream #[^\n]*Audio:\s*([A-Za-z0-9_]+)/.exec(text)
  if (audio) info.audioCodec = audio[1]
  return info
}
