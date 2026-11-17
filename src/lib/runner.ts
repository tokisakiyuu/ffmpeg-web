/**
 * Sequential pipeline executor. Deliberately does not import the store
 * (avoids an import cycle); the store's runPipeline action passes in a
 * RunnerHost with the data getters and mutators the runner needs.
 */
import type {
  EngineStatus,
  InputFile,
  JobRequest,
  MediaInfo,
  NodeRunState,
  OutputArtifact,
  PipelineNode,
  RunPhase,
} from '../types'
import { OPS } from './ops'
import { getEngine } from './ffmpeg/engine'
import { uid } from './format'

export interface RunnerHost {
  getInputFile(): InputFile | undefined
  getNodes(): PipelineNode[]
  setEngineStatus(status: EngineStatus, error?: string): void
  setEngineLoadProgress(ratio: number): void
  setNodeRun(nodeId: string, patch: Partial<NodeRunState>): void
  setRunPhase(phase: RunPhase): void
  addOutput(artifact: OutputArtifact): void
  clearOutputs(): void
}

const LOG_TAIL_LINES = 30

/**
 * Set when cancelRun fires. engine.cancel() terminates the worker, which
 * rejects the pending runJob promise with a generic error — this flag is
 * how the catch block tells a user cancel apart from a real failure.
 */
let cancelling = false

export function cancelPipeline(): void {
  cancelling = true
  getEngine().cancel()
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function markRemainingIdle(host: RunnerHost, nodes: PipelineNode[], fromIndex: number): void {
  for (let i = fromIndex; i < nodes.length; i++) {
    host.setNodeRun(nodes[i].id, { status: 'idle', progress: 0 })
  }
}

function finishCancelled(host: RunnerHost, nodes: PipelineNode[], index: number): void {
  host.setNodeRun(nodes[index].id, { status: 'cancelled', finishedAt: Date.now() })
  markRemainingIdle(host, nodes, index + 1)
  host.setRunPhase('cancelled')
  // terminate() unloads the core; reflect the real engine state in the UI
  host.setEngineStatus(getEngine().status)
}

export async function runPipeline(host: RunnerHost): Promise<void> {
  const inputFile = host.getInputFile()
  const nodes = host.getNodes()
  if (!inputFile || nodes.length === 0) return

  cancelling = false
  host.clearOutputs()
  host.setRunPhase('running')
  for (const node of nodes) {
    host.setNodeRun(node.id, {
      status: 'waiting',
      progress: 0,
      logTail: [],
      error: undefined,
      outputId: undefined,
      startedAt: undefined,
      finishedAt: undefined,
    })
  }

  const engine = getEngine()
  try {
    if (engine.status !== 'ready') host.setEngineStatus('loading')
    await engine.ensureLoaded((ratio: number) => host.setEngineLoadProgress(ratio))
    host.setEngineStatus('ready')
  } catch (e) {
    if (cancelling) {
      finishCancelled(host, nodes, 0)
      return
    }
    host.setEngineStatus('error', errorMessage(e))
    markRemainingIdle(host, nodes, 0)
    host.setRunPhase('error')
    return
  }

  // each node consumes the previous node's artifact (or the original file)
  let currentInput: File | Blob = inputFile.file
  let currentName = inputFile.name
  let currentInfo: MediaInfo | undefined = inputFile.info

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (cancelling) {
      finishCancelled(host, nodes, i)
      return
    }

    const op = OPS[node.kind]
    const outputName = op.outputName(currentName, node.params)
    const expected = op.expectedOutputDurationSec(node.params, currentInfo)
    const req: JobRequest = {
      input: currentInput,
      inputName: currentName,
      outputName,
      args: op.buildArgs(currentName, outputName, node.params, currentInfo),
      expectedOutputDurationSec: expected,
    }

    host.setNodeRun(node.id, { status: 'running', progress: 0, startedAt: Date.now() })
    host.setEngineStatus('running')

    const logTail: string[] = []
    let lastSentProgress = 0
    try {
      const result = await engine.runJob(req, {
        onProgress: (ratio: number) => {
          // throttle store writes; every set() also triggers a persist write
          if (ratio >= 1 || ratio - lastSentProgress >= 0.005) {
            lastSentProgress = ratio
            host.setNodeRun(node.id, { progress: ratio })
          }
        },
        onLog: (line: string) => {
          logTail.push(line)
          if (logTail.length > LOG_TAIL_LINES) logTail.shift()
          host.setNodeRun(node.id, { logTail: [...logTail] })
        },
      })

      const mime = op.outputMime(node.params, result.outputName)
      // readFile's Uint8Array is transferred zero-copy; wrap in a Blob and
      // drop the reference so wasm memory can be reclaimed
      const blob = new Blob([result.data as unknown as BlobPart], { type: mime })
      // only the last node's output is surfaced to the user; intermediates
      // exist just to feed the next node and are dropped with this loop
      const isLast = i === nodes.length - 1
      let outputId: string | undefined
      if (isLast) {
        const artifact: OutputArtifact = {
          id: uid(),
          nodeId: node.id,
          name: result.outputName,
          blob,
          url: URL.createObjectURL(blob),
          sizeBytes: blob.size,
          mime,
        }
        host.addOutput(artifact)
        outputId = artifact.id
      }
      host.setNodeRun(node.id, {
        status: 'done',
        progress: 1,
        outputId,
        finishedAt: Date.now(),
      })

      currentInput = blob
      currentName = result.outputName
      // probing intermediates would cost another pass; carry the expected
      // duration forward so the next node's progress stays roughly accurate
      currentInfo = { ...currentInfo, durationSec: expected ?? currentInfo?.durationSec }
    } catch (e) {
      if (cancelling) {
        finishCancelled(host, nodes, i)
      } else {
        host.setNodeRun(node.id, {
          status: 'error',
          error: errorMessage(e),
          finishedAt: Date.now(),
        })
        markRemainingIdle(host, nodes, i + 1)
        host.setRunPhase('error')
        host.setEngineStatus(engine.status)
      }
      return
    }
  }

  host.setRunPhase('done')
  host.setEngineStatus(engine.status)
}
