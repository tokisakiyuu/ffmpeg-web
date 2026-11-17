import type { OpDefinition } from '../../types'
import { splitExt } from '../format'

const EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  ts: 'video/mp2t',
  '3gp': 'video/3gpp',
  ogv: 'video/ogg',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  gif: 'image/gif',
}

export const removeAudioOp: OpDefinition = {
  kind: 'remove-audio',
  title: 'Remove audio',
  description: 'Remove all audio tracks, keeping the video quality and file format',
  fields: [],
  defaultParams: () => ({}),
  outputName: (inputName) => {
    const [base, ext] = splitExt(inputName)
    return `${base}.muted.${ext || 'mp4'}`
  },
  buildArgs: (inputPath, outputPath) => [
    '-i', inputPath,
    '-map', '0:v',
    '-c:v', 'copy',
    '-an',
    outputPath,
  ],
  expectedOutputDurationSec: (_params, info) => info?.durationSec,
  outputMime: (_params, outputName) => {
    const [, ext] = splitExt(outputName ?? '')
    return EXT_MIME[ext] ?? 'application/octet-stream'
  },
}
