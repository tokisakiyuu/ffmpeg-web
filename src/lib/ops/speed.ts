import type { OpDefinition, OpParams } from '../../types'
import { splitExt } from '../format'
import { buildVideoArgs } from './video'

function speed(params: OpParams): number {
  const value = Number(params.rate ?? 2)
  return Number.isFinite(value) ? Math.min(4, Math.max(0.25, value)) : 2
}

/** Keep each atempo stage within 0.5–2 to preserve audio quality at the extremes. */
function audioTempo(rate: number): string {
  if (rate < 0.5) return `atempo=0.5,atempo=${rate / 0.5}`
  if (rate > 2) return `atempo=2,atempo=${rate / 2}`
  return `atempo=${rate}`
}

export const speedOp: OpDefinition = {
  kind: 'speed',
  title: 'Change speed',
  description: 'Speed up or slow down video and audio together, preserving audio pitch',
  fields: [
    {
      key: 'rate',
      label: 'Playback speed (×)',
      type: 'number',
      min: 0.25,
      max: 4,
      step: 0.25,
      help: '0.5 = half speed, 1 = original, 2 = double speed. Saves as MP4; audio pitch stays the same.',
    },
  ],
  defaultParams: () => ({ rate: 2 }),
  outputName: (inputName, params) => {
    const [base] = splitExt(inputName)
    return `${base}.${speed(params)}x.mp4`
  },
  buildArgs: (inputPath, outputPath, params) => {
    const rate = speed(params)
    return buildVideoArgs(
      inputPath,
      outputPath,
      `setpts=(PTS-STARTPTS)/${rate}`,
      `asetpts=PTS-STARTPTS,${audioTempo(rate)}`,
    )
  },
  expectedOutputDurationSec: (params, info) => (
    info?.durationSec === undefined ? undefined : info.durationSec / speed(params)
  ),
  outputMime: () => 'video/mp4',
}
