import type { MediaInfo, OpDefinition, OpParams } from '../../types'
import { splitExt } from '../format'

export const compressOp: OpDefinition = {
  kind: 'compress',
  title: 'Compress',
  description: 'Re-encode to a smaller MP4; downscaling saves the most',
  fields: [
    {
      key: 'crf',
      label: 'Quality (CRF)',
      type: 'number',
      min: 20,
      max: 34,
      step: 1,
      help: 'Higher = smaller file, lower quality (28 recommended)',
    },
    {
      key: 'preset',
      label: 'Encoding speed',
      type: 'select',
      options: [
        { value: 'ultrafast', label: 'ultrafast (fastest)' },
        { value: 'veryfast', label: 'veryfast (recommended)' },
        { value: 'fast', label: 'fast (smaller file)' },
      ],
      help: 'At equal CRF, ultrafast outputs 2-3x larger files; veryfast is the best speed/size balance',
    },
    {
      key: 'resolution',
      label: 'Resolution',
      type: 'select',
      options: [
        { value: 'original', label: 'Keep original' },
        { value: '1080', label: '1080p' },
        { value: '720', label: '720p' },
        { value: '480', label: '480p' },
      ],
      help: 'Downscaling gives the biggest size and speed win',
    },
    {
      key: 'audioBitrate',
      label: 'Audio bitrate',
      type: 'select',
      options: [
        { value: '64k', label: '64 kbps' },
        { value: '96k', label: '96 kbps' },
        { value: '128k', label: '128 kbps' },
      ],
    },
  ],
  defaultParams: () => ({
    crf: 28,
    preset: 'veryfast',
    resolution: '720',
    audioBitrate: '96k',
  }),
  outputName: (inputName) => {
    const [base] = splitExt(inputName)
    return `${base}.min.mp4`
  },
  buildArgs: (inputPath, outputPath, params) => {
    const resolution = String(params.resolution || 'original')
    const scale = resolution === 'original' ? [] : ['-vf', `scale=-2:${resolution}`]
    return [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', String(params.crf ?? 28),
      '-preset', String(params.preset || 'veryfast'),
      ...scale,
      '-c:a', 'aac',
      '-b:a', String(params.audioBitrate || '96k'),
      '-movflags', '+faststart',
      outputPath,
    ]
  },
  expectedOutputDurationSec: (_params: OpParams, info?: MediaInfo) => info?.durationSec,
  outputMime: () => 'video/mp4',
}
