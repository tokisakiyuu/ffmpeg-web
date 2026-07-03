import type { MediaInfo, OpDefinition, OpParams } from '../../types'
import { splitExt } from '../format'

const CRF_TARGETS = ['mp4', 'mkv', 'mov', 'flv', 'ts']

const EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  ts: 'video/mp2t',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
}

function target(params: OpParams): string {
  return String(params.target || 'mp4')
}

/** shared H.264 + AAC encoder args used by several containers */
function h264Args(crf: string): string[] {
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-c:a', 'aac', '-b:a', '128k']
}

export const convertOp: OpDefinition = {
  kind: 'convert',
  title: 'Convert',
  description: 'Convert to common video, audio, or GIF formats',
  fields: [
    {
      key: 'target',
      label: 'Target format',
      type: 'select',
      options: [
        { value: 'mp4', label: 'MP4 (H.264 + AAC)' },
        { value: 'webm', label: 'WebM (VP8/VP9 + Vorbis)' },
        { value: 'mkv', label: 'MKV (H.264 + AAC)' },
        { value: 'mov', label: 'MOV (H.264 + AAC)' },
        { value: 'avi', label: 'AVI (MPEG-4 + MP3)' },
        { value: 'flv', label: 'FLV (H.264 + AAC)' },
        { value: 'ts', label: 'MPEG-TS (H.264 + AAC)' },
        { value: 'gif', label: 'Animated GIF' },
        { value: 'mp3', label: 'MP3 (audio only)' },
        { value: 'm4a', label: 'M4A (audio only)' },
        { value: 'wav', label: 'WAV (audio only)' },
        { value: 'flac', label: 'FLAC (audio only)' },
        { value: 'ogg', label: 'OGG Vorbis (audio only)' },
      ],
    },
    {
      key: 'crf',
      label: 'Quality (CRF)',
      type: 'number',
      min: 18,
      max: 32,
      step: 1,
      help: 'Lower = better quality, larger file (23 recommended)',
      showIf: (params) => CRF_TARGETS.includes(target(params)),
    },
    {
      key: 'webmCodec',
      label: 'Video codec',
      type: 'select',
      options: [
        { value: 'vp8', label: 'VP8 (fast, recommended)' },
        { value: 'vp9', label: 'VP9 (smaller, much slower)' },
      ],
      help: 'VP9 encodes far slower than VP8 — avoid for large files',
      showIf: (params) => target(params) === 'webm',
    },
  ],
  defaultParams: () => ({ target: 'mp4', crf: 23, webmCodec: 'vp8' }),
  outputName: (inputName, params) => {
    const [base] = splitExt(inputName)
    return `${base}.converted.${target(params)}`
  },
  buildArgs: (inputPath, outputPath, params) => {
    const t = target(params)
    const crf = String(params.crf ?? 23)
    const head = ['-i', inputPath]
    switch (t) {
      case 'mp4':
      case 'mov':
        return [...head, ...h264Args(crf), '-movflags', '+faststart', outputPath]
      case 'mkv':
      case 'ts':
      case 'flv':
        return [...head, ...h264Args(crf), outputPath]
      case 'avi':
        // classic AVI pairing; H.264/AAC in AVI plays poorly in older players
        return [...head, '-c:v', 'mpeg4', '-qscale:v', '5', '-c:a', 'libmp3lame', '-b:a', '192k', outputPath]
      case 'webm': {
        const vcodec = params.webmCodec === 'vp9' ? 'libvpx-vp9' : 'libvpx'
        // libvorbis, not libopus: this core's libopus encoder hits a wasm
        // "memory access out of bounds" whenever the input audio is
        // compressed (aac/opus) — https://github.com/ffmpegwasm/ffmpeg.wasm/issues/591
        return [...head, '-c:v', vcodec, '-deadline', 'realtime', '-cpu-used', '5', '-b:v', '1M', '-c:a', 'libvorbis', '-q:a', '5', outputPath]
      }
      case 'gif':
        return [...head, '-vf', 'fps=12,scale=480:-2:flags=lanczos', outputPath]
      case 'mp3':
        return [...head, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', outputPath]
      case 'm4a':
        return [...head, '-vn', '-c:a', 'aac', '-b:a', '192k', outputPath]
      case 'wav':
        return [...head, '-vn', '-c:a', 'pcm_s16le', '-ar', '44100', outputPath]
      case 'flac':
        return [...head, '-vn', '-c:a', 'flac', outputPath]
      case 'ogg':
        return [...head, '-vn', '-c:a', 'libvorbis', '-q:a', '5', outputPath]
      default:
        return [...head, outputPath]
    }
  },
  expectedOutputDurationSec: (_params: OpParams, info?: MediaInfo) => info?.durationSec,
  outputMime: (params) => EXT_MIME[target(params)] ?? 'application/octet-stream',
}
