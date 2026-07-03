/**
 * App store implementing the AppState contract. Only PersistedState
 * (lastParams + lastPipeline) reaches localStorage — File/Blob/object
 * URLs must never be serialized.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState } from './contract'
import type {
  MediaInfo,
  NodeRunState,
  OpKind,
  OpParams,
  OutputArtifact,
  PersistedState,
  PipelineNode,
} from '../types'
import { uid } from '../lib/format'
import { OPS } from '../lib/ops'
import { getEngine } from '../lib/ffmpeg/engine'
import { cancelPipeline, runPipeline, type RunnerHost } from '../lib/runner'

// PersistedState fields live on the runtime state so partialize can pick
// them and rehydration can merge them back before nodes are rebuilt
type StoreState = AppState & PersistedState

const EMPTY_RUN: NodeRunState = { status: 'idle', progress: 0, logTail: [] }

function revokeOutputs(outputs: OutputArtifact[]): void {
  for (const o of outputs) URL.revokeObjectURL(o.url)
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Ops carry hidden params derived from the probed file (extract-audio's
 * sourceAudioCodec, trim's sourceExt). Values restored from lastParams
 * belong to a previous file and would give copy-mode outputs the wrong
 * extension/mime, so re-derive them from the current file's info.
 */
const SOURCE_DERIVED_KEYS = ['sourceAudioCodec', 'sourceExt']

function refreshSourceParams(kind: OpKind, params: OpParams, info?: MediaInfo): OpParams {
  const defaults = OPS[kind].defaultParams(info)
  let next = params
  for (const key of SOURCE_DERIVED_KEYS) {
    if (key in defaults && next[key] !== defaults[key]) {
      if (next === params) next = { ...params }
      next[key] = defaults[key]
    }
  }
  return next
}

function buildNodesFromPersisted(
  lastPipeline: OpKind[],
  lastParams: Partial<Record<OpKind, OpParams>>,
): PipelineNode[] {
  // persisted layout may predate an op being renamed/removed
  const kinds = lastPipeline.filter((kind) => kind in OPS)
  const effective: OpKind[] = kinds.length > 0 ? kinds : ['convert']
  return effective.map((kind) => ({
    id: uid(),
    kind,
    params: { ...(lastParams[kind] ?? OPS[kind].defaultParams()) },
  }))
}

/** probe runs async after setInputFile; fileId guards against stale results */
async function probeInput(file: File, fileId: string): Promise<void> {
  const api = useAppStore.getState()
  const engine = getEngine()
  try {
    if (engine.status !== 'ready') api._setEngineStatus('loading')
    await engine.ensureLoaded((ratio: number) => api._setEngineLoadProgress(ratio))
    api._setEngineStatus(engine.status)
    const info = await engine.probe(file)
    useAppStore.getState()._setInputInfo(fileId, info)
  } catch (e) {
    useAppStore.getState()._setInputInfo(fileId, undefined, errorMessage(e))
    useAppStore.getState()._setEngineStatus(engine.status)
  }
}

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // engine
      engineStatus: 'unloaded',
      engineLoadProgress: 0,
      engineError: undefined,

      // input
      inputFile: undefined,

      // pipeline
      nodes: [],
      nodeRuns: {},
      runPhase: 'idle',

      // results
      outputs: [],

      // persisted (maintained alongside edits, restored on rehydrate)
      lastParams: {},
      lastPipeline: ['convert'],

      // ---- input actions ----
      setInputFile: (file) => {
        revokeOutputs(get().outputs)
        const id = uid()
        set({
          inputFile: { id, file, name: file.name, sizeBytes: file.size },
          outputs: [],
          nodeRuns: {},
          runPhase: 'idle',
        })
        void probeInput(file, id)
      },

      clearInputFile: () => {
        revokeOutputs(get().outputs)
        set({ inputFile: undefined, outputs: [], nodeRuns: {}, runPhase: 'idle' })
      },

      // ---- pipeline editing ----
      addNode: (kind, index) => {
        const { lastParams, inputFile } = get()
        const params = refreshSourceParams(
          kind,
          { ...(lastParams[kind] ?? OPS[kind].defaultParams(inputFile?.info)) },
          inputFile?.info,
        )
        const node: PipelineNode = { id: uid(), kind, params }
        set((s) => {
          const nodes = [...s.nodes]
          nodes.splice(index ?? nodes.length, 0, node)
          return { nodes, lastParams: { ...s.lastParams, [kind]: params } }
        })
      },

      removeNode: (nodeId) => {
        set((s) => {
          const nodeRuns = { ...s.nodeRuns }
          delete nodeRuns[nodeId]
          return { nodes: s.nodes.filter((n) => n.id !== nodeId), nodeRuns }
        })
      },

      moveNode: (nodeId, direction) => {
        set((s) => {
          const i = s.nodes.findIndex((n) => n.id === nodeId)
          const j = i + direction
          if (i < 0 || j < 0 || j >= s.nodes.length) return {}
          const nodes = [...s.nodes]
          const tmp = nodes[i]
          nodes[i] = nodes[j]
          nodes[j] = tmp
          return { nodes }
        })
      },

      updateNodeParams: (nodeId, params) => {
        set((s) => {
          const node = s.nodes.find((n) => n.id === nodeId)
          if (!node) return {}
          // Partial<OpParams> widens values with undefined; drop those keys
          const merged: OpParams = { ...node.params }
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) merged[key] = value
          }
          return {
            nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, params: merged } : n)),
            lastParams: { ...s.lastParams, [node.kind]: merged },
          }
        })
      },

      // ---- execution ----
      runPipeline: async () => {
        if (get().runPhase === 'running') return
        const host: RunnerHost = {
          getInputFile: () => get().inputFile,
          getNodes: () => get().nodes,
          setEngineStatus: (status, error) => get()._setEngineStatus(status, error),
          setEngineLoadProgress: (ratio) => get()._setEngineLoadProgress(ratio),
          setNodeRun: (nodeId, patch) => get()._setNodeRun(nodeId, patch),
          setRunPhase: (phase) => get()._setRunPhase(phase),
          addOutput: (artifact) => get()._addOutput(artifact),
          clearOutputs: () => get()._clearOutputs(),
        }
        await runPipeline(host)
      },

      cancelRun: () => {
        if (get().runPhase !== 'running') return
        // node/phase bookkeeping happens in the runner's catch path
        cancelPipeline()
      },

      resetRun: () => {
        revokeOutputs(get().outputs)
        set({ nodeRuns: {}, runPhase: 'idle', outputs: [] })
      },

      // ---- internal mutators (used by the runner / probe) ----
      _setEngineStatus: (status, error) => set({ engineStatus: status, engineError: error }),

      _setEngineLoadProgress: (ratio) => set({ engineLoadProgress: ratio }),

      _setInputInfo: (fileId, info, probeError) => {
        set((s) => {
          if (!s.inputFile || s.inputFile.id !== fileId) return {}
          const patch: Partial<StoreState> = {
            inputFile: { ...s.inputFile, info, probeError },
          }
          const duration = info?.durationSec
          patch.nodes = s.nodes.map((n) => {
            let params = refreshSourceParams(n.kind, n.params, info)
            // trim's endSec defaults to 0 until duration is known; only fill
            // it in when still 0 so a user-entered value is never overwritten
            if (n.kind === 'trim' && params.endSec === 0 && duration && duration > 0) {
              if (params === n.params) params = { ...params }
              params.endSec = duration
            }
            return params === n.params ? n : { ...n, params }
          })
          return patch
        })
      },

      _setNodeRun: (nodeId, patch) => {
        set((s) => ({
          nodeRuns: {
            ...s.nodeRuns,
            [nodeId]: { ...(s.nodeRuns[nodeId] ?? EMPTY_RUN), ...patch },
          },
        }))
      },

      _setRunPhase: (phase) => set({ runPhase: phase }),

      _addOutput: (artifact) => set((s) => ({ outputs: [...s.outputs, artifact] })),

      _clearOutputs: () => {
        revokeOutputs(get().outputs)
        set({ outputs: [] })
      },
    }),
    {
      name: 'ffmpeg-web-v1',
      partialize: (state): PersistedState => ({
        lastParams: state.lastParams,
        lastPipeline: state.nodes.map((n) => n.kind),
      }),
    },
  ),
)

// localStorage rehydration is synchronous, so the persisted layout is
// already merged here; turn it into concrete nodes exactly once at startup
{
  const { lastPipeline, lastParams } = useAppStore.getState()
  useAppStore.setState({ nodes: buildNodesFromPersisted(lastPipeline, lastParams) })
}
