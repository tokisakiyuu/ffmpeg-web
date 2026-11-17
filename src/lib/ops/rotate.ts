import type { OpDefinition } from '../../types'
import { splitExt } from '../format'
import { buildVideoArgs } from './video'

export const rotateOp: OpDefinition = {
  kind: 'rotate',
  title: 'Rotate video',
  description: 'Rotate or mirror the picture and save as MP4, keeping audio when present',
  fields: [
    {
      key: 'angle',
      label: 'Rotation / flip',
      type: 'select',
      options: [
        { value: '90', label: '90° clockwise' },
        { value: '180', label: '180°' },
        { value: '270', label: '90° counterclockwise' },
        { value: 'horizontal', label: 'Flip horizontally (left ↔ right)' },
        { value: 'vertical', label: 'Flip vertically (top ↔ bottom)' },
      ],
      help: 'Applied to the displayed orientation. Re-encodes to MP4 (H.264 + AAC).',
    },
  ],
  defaultParams: () => ({ angle: '90' }),
  outputName: (inputName, params) => {
    const [base] = splitExt(inputName)
    const action = params.angle === 'horizontal' || params.angle === 'vertical' ? 'flipped' : 'rotated'
    return `${base}.${action}.mp4`
  },
  buildArgs: (inputPath, outputPath, params) => {
    const filter = params.angle === 'horizontal' ? 'hflip'
      : params.angle === 'vertical' ? 'vflip'
      : params.angle === '180' ? 'hflip,vflip'
      : params.angle === '270' ? 'transpose=2' : 'transpose=1'
    return buildVideoArgs(inputPath, outputPath, filter)
  },
  expectedOutputDurationSec: (_params, info) => info?.durationSec,
  outputMime: () => 'video/mp4',
}
