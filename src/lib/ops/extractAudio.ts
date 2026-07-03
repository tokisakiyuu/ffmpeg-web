import type { MediaInfo, OpDefinition, OpParams } from '../../types'
import { splitExt } from '../format'

const EXT_MIME: Record<string, string> = {
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
}

/** container extension that can hold the source codec as-is (for -c:a copy) */
function extForCodec(codec: string): string {
  if (codec.startsWith('pcm_')) return 'wav'
  switch (codec) {
    case 'aac':
      return 'm4a'
    case 'mp3':
      return 'mp3'
    case 'opus':
    case 'vorbis':
      return 'ogg'
    case 'flac':
      return 'flac'
    default:
      return 'm4a'
  }
}

/**
 * outputName/outputMime only receive params, so the probed audio codec is
 * carried through a hidden param set by defaultParams.
 */
function outputExt(params: OpParams): string {
  const format = String(params.format || 'm4a')
  if (format === 'copy') return extForCodec(String(params.sourceAudioCodec || ''))
  return format
}

export const extractAudioOp: OpDefinition = {
  kind: 'extract-audio',
  title: 'Extract audio',
  description: 'Pull the audio track from a video, losslessly or re-encoded',
  fields: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      options: [
        { value: 'm4a', label: 'M4A (AAC)' },
        { value: 'mp3', label: 'MP3' },
        { value: 'wav', label: 'WAV (uncompressed)' },
        { value: 'flac', label: 'FLAC (lossless)' },
        { value: 'ogg', label: 'OGG Vorbis' },
        { value: 'copy', label: 'Stream copy (no re-encode)' },
      ],
      help: 'Stream copy is fastest, but only works when the source codec fits the target container (e.g. AAC → M4A)',
    },
    {
      key: 'bitrate',
      label: 'Bitrate',
      type: 'select',
      options: [
        { value: '128k', label: '128 kbps' },
        { value: '192k', label: '192 kbps' },
        { value: '256k', label: '256 kbps' },
      ],
      showIf: (params) => params.format === 'mp3' || params.format === 'm4a',
    },
  ],
  defaultParams: (info?: MediaInfo) => ({
    format: 'm4a',
    bitrate: '192k',
    sourceAudioCodec: info?.audioCodec ?? '',
  }),
  outputName: (inputName, params) => {
    const [base] = splitExt(inputName)
    return `${base}.audio.${outputExt(params)}`
  },
  buildArgs: (inputPath, outputPath, params) => {
    const head = ['-i', inputPath, '-vn']
    const bitrate = String(params.bitrate || '192k')
    switch (String(params.format || 'm4a')) {
      case 'copy':
        return [...head, '-c:a', 'copy', outputPath]
      case 'mp3':
        return [...head, '-c:a', 'libmp3lame', '-b:a', bitrate, outputPath]
      case 'wav':
        return [...head, '-c:a', 'pcm_s16le', '-ar', '44100', outputPath]
      case 'flac':
        return [...head, '-c:a', 'flac', outputPath]
      case 'ogg':
        return [...head, '-c:a', 'libvorbis', '-q:a', '5', outputPath]
      case 'm4a':
      default:
        return [...head, '-c:a', 'aac', '-b:a', bitrate, outputPath]
    }
  },
  expectedOutputDurationSec: (_params: OpParams, info?: MediaInfo) => info?.durationSec,
  outputMime: (params) => EXT_MIME[outputExt(params)] ?? 'audio/mp4',
}
