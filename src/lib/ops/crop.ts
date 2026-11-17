import type { OpDefinition, OpParams } from '../../types'
import { splitExt } from '../format'
import { buildVideoArgs } from './video'

const ASPECT_RATIOS: Record<string, string> = {
  '1:1': '1',
  '16:9': '16/9',
  '9:16': '9/16',
  '4:3': '4/3',
  '3:4': '3/4',
}

function percent(params: OpParams, key: string, fallback: number, min = 0): number {
  const value = Number(params[key] ?? fallback)
  return Number.isFinite(value) ? Math.min(100, Math.max(min, value)) : fallback
}

export const cropOp: OpDefinition = {
  kind: 'crop',
  title: 'Crop video',
  description: 'Crop to a common aspect ratio or a custom region; saves as MP4',
  fields: [
    {
      key: 'aspect',
      label: 'Crop shape',
      type: 'select',
      options: [
        { value: '1:1', label: '1:1 (square)' },
        { value: '16:9', label: '16:9 (landscape)' },
        { value: '9:16', label: '9:16 (portrait)' },
        { value: '4:3', label: '4:3 (landscape)' },
        { value: '3:4', label: '3:4 (portrait)' },
        { value: 'custom', label: 'Custom region' },
      ],
      help: 'Keeps the largest area that fits the selected shape. Audio is retained.',
    },
    {
      key: 'widthPercent',
      label: 'Width to keep (%)',
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
      showIf: (params) => params.aspect === 'custom',
    },
    {
      key: 'heightPercent',
      label: 'Height to keep (%)',
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
      showIf: (params) => params.aspect === 'custom',
    },
    {
      key: 'positionX',
      label: 'Horizontal position (%)',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      help: '0 = left, 50 = center, 100 = right',
    },
    {
      key: 'positionY',
      label: 'Vertical position (%)',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      help: '0 = top, 50 = center, 100 = bottom',
    },
  ],
  defaultParams: () => ({ aspect: '1:1', widthPercent: 100, heightPercent: 100, positionX: 50, positionY: 50 }),
  outputName: (inputName) => {
    const [base] = splitExt(inputName)
    return `${base}.cropped.mp4`
  },
  buildArgs: (inputPath, outputPath, params) => {
    const ratio = ASPECT_RATIOS[String(params.aspect)] ?? '1'
    // FFmpeg evaluates against this node's actual input, including prior rotations/crops.
    const width = params.aspect === 'custom'
      ? `iw*${percent(params, 'widthPercent', 100, 1)}/100`
      : `min(iw,ih*(${ratio})/sar)`
    const height = params.aspect === 'custom'
      ? `ih*${percent(params, 'heightPercent', 100, 1)}/100`
      : `min(ih,iw*sar/(${ratio}))`
    const filter = [
      `crop=w='max(2,trunc((${width})/2)*2)'`,
      `h='max(2,trunc((${height})/2)*2)'`,
      `x='trunc((iw-ow)*${percent(params, 'positionX', 50)}/100/2)*2'`,
      `y='trunc((ih-oh)*${percent(params, 'positionY', 50)}/100/2)*2'`,
    ].join(':')
    return buildVideoArgs(inputPath, outputPath, filter)
  },
  expectedOutputDurationSec: (_params, info) => info?.durationSec,
  outputMime: () => 'video/mp4',
}
