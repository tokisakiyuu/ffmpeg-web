/**
 * Shared contracts between the ffmpeg engine, operation definitions,
 * store, and UI. This file is the module boundary — implementations in
 * lib/, store/, and components/ must conform to these types.
 */

// ---------- media / files ----------

export interface MediaInfo {
  durationSec?: number
  width?: number
  height?: number
  videoCodec?: string
  audioCodec?: string
  container?: string
  bitrateKbps?: number
}

export interface InputFile {
  id: string
  file: File
  name: string
  sizeBytes: number
  /** filled asynchronously by probing; undefined while loading */
  info?: MediaInfo
  probeError?: string
}

export interface OutputArtifact {
  id: string
  /** node that produced it */
  nodeId: string
  name: string
  blob: Blob
  /** object URL for preview/download; must be revoked on removal */
  url: string
  sizeBytes: number
  mime: string
}

// ---------- operations ----------

export type OpKind = 'convert' | 'extract-audio' | 'trim' | 'compress'

export type OpParams = Record<string, string | number | boolean>

export interface OpFieldOption {
  value: string
  label: string
}

export interface OpParamField {
  key: string
  label: string
  type: 'select' | 'number' | 'text' | 'toggle' | 'timerange'
  options?: OpFieldOption[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  /** short hint rendered under the control */
  help?: string
  /** render only when this predicate over current params passes */
  showIf?: (params: OpParams) => boolean
}

export interface OpDefinition {
  kind: OpKind
  title: string
  description: string
  fields: OpParamField[]
  defaultParams: (info?: MediaInfo) => OpParams
  /** output filename for a given input filename + params */
  outputName: (inputName: string, params: OpParams) => string
  /** full ffmpeg argv (without input/output paths injected separately) */
  buildArgs: (inputPath: string, outputPath: string, params: OpParams, info?: MediaInfo) => string[]
  /**
   * expected output duration in seconds, used to normalize ffmpeg's
   * unreliable progress events (computed from log `time` / this value)
   */
  expectedOutputDurationSec: (params: OpParams, info?: MediaInfo) => number | undefined
  /** mime type of the produced file (by output extension) */
  outputMime: (params: OpParams) => string
}

// ---------- engine ----------

export type EngineStatus = 'unloaded' | 'loading' | 'ready' | 'running' | 'error'

export interface JobRequest {
  /** input file provided as browser File/Blob (mounted or written to FS) */
  input: File | Blob
  inputName: string
  outputName: string
  args: string[]
  expectedOutputDurationSec?: number
}

export interface JobResult {
  data: Uint8Array
  outputName: string
}

export interface JobCallbacks {
  /** normalized 0..1 */
  onProgress?: (ratio: number) => void
  onLog?: (line: string) => void
}

// ---------- pipeline ----------

export type NodeStatus = 'idle' | 'waiting' | 'running' | 'done' | 'error' | 'cancelled'

export interface PipelineNode {
  id: string
  kind: OpKind
  params: OpParams
}

export interface NodeRunState {
  status: NodeStatus
  /** 0..1 */
  progress: number
  logTail: string[]
  error?: string
  outputId?: string
  startedAt?: number
  finishedAt?: number
}

export type RunPhase = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

// ---------- persisted settings ----------

export interface PersistedState {
  /** last used params per op kind, restored when adding a node */
  lastParams: Partial<Record<OpKind, OpParams>>
  /** last pipeline layout (kinds only, params come from lastParams) */
  lastPipeline: OpKind[]
}
