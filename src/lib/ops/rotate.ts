import type { OpDefinition } from '../../types'
import { splitExt } from '../format'

export const rotateOp: OpDefinition = {
  kind: 'rotate',
  title: 'Rotate video',
  description: 'Rotate the picture and save as MP4, keeping audio when present',
  fields: [
    {
      key: 'angle',
      label: 'Rotation',
      type: 'select',
      options: [
        { value: '90', label: '90° clockwise' },
        { value: '180', label: '180°' },
        { value: '270', label: '90° counterclockwise' },
      ],
      help: 'Applied to the displayed orientation. Re-encodes to MP4 (H.264 + AAC).',
    },
  ],
  defaultParams: () => ({ angle: '90' }),
  outputName: (inputName) => {
    const [base] = splitExt(inputName)
    return `${base}.rotated.mp4`
  },
  buildArgs: (inputPath, outputPath, params) => {
    const filter = params.angle === '180' ? 'hflip,vflip'
      : params.angle === '270' ? 'transpose=2' : 'transpose=1'
    return [
      '-i', inputPath,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-vf', `${filter},pad=ceil(iw/2)*2:ceil(ih/2)*2`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-metadata:s:v:0', 'rotate=0',
      '-movflags', '+faststart',
      outputPath,
    ]
  },
  expectedOutputDurationSec: (_params, info) => info?.durationSec,
  outputMime: () => 'video/mp4',
}
