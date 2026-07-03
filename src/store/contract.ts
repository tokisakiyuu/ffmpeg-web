/**
 * Store API surface. src/store/index.ts implements exactly this shape
 * (zustand store named `useAppStore`); UI components consume it via
 * selectors. Keep this file dependency-free apart from src/types.ts.
 */
import type {
  EngineStatus,
  InputFile,
  NodeRunState,
  OpKind,
  OpParams,
  OutputArtifact,
  PipelineNode,
  RunPhase,
} from '../types'

export interface AppState {
  // engine
  engineStatus: EngineStatus
  /** core download progress 0..1 while engineStatus === 'loading' */
  engineLoadProgress: number
  engineError?: string

  // input
  inputFile?: InputFile

  // pipeline
  nodes: PipelineNode[]
  nodeRuns: Record<string, NodeRunState>
  runPhase: RunPhase

  // results
  outputs: OutputArtifact[]

  // actions — input
  setInputFile: (file: File) => void
  clearInputFile: () => void

  // actions — pipeline editing
  addNode: (kind: OpKind, index?: number) => void
  removeNode: (nodeId: string) => void
  moveNode: (nodeId: string, direction: -1 | 1) => void
  updateNodeParams: (nodeId: string, params: Partial<OpParams>) => void

  // actions — execution (implemented in lib/runner.ts, exposed here)
  runPipeline: () => Promise<void>
  cancelRun: () => void
  resetRun: () => void

  // internal mutators used by the runner
  _setEngineStatus: (status: EngineStatus, error?: string) => void
  _setEngineLoadProgress: (ratio: number) => void
  _setInputInfo: (fileId: string, info?: InputFile['info'], probeError?: string) => void
  _setNodeRun: (nodeId: string, patch: Partial<NodeRunState>) => void
  _setRunPhase: (phase: RunPhase) => void
  _addOutput: (artifact: OutputArtifact) => void
  _clearOutputs: () => void
}
