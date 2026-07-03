import type { MediaInfo, OpDefinition, OpParams } from '../../types'
import { splitExt, toTimecode } from '../format'

const EXT_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  ts: 'video/mp2t',
}

function isCopy(params: OpParams): boolean {
  return String(params.mode || 'copy') === 'copy'
}

/**
 * copy mode must stay in the source container (stream copy into a different
 * one can fail). outputMime only receives params, so the probed container is
 * carried through the hidden `sourceExt` param set in defaultParams.
 * ffmpeg demuxer names are comma lists, e.g. "mov,mp4,m4a,3gp,3g2,mj2".
 */
function containerToExt(container?: string): string {
  const c = container ?? ''
  if (c.includes('mp4')) return 'mp4'
  if (c.includes('matroska') || c.includes('webm')) return 'mkv'
  if (c.includes('avi')) return 'avi'
  if (c.includes('flv')) return 'flv'
  if (c.includes('mpegts')) return 'ts'
  return ''
}

export const trimOp: OpDefinition = {
  kind: 'trim',
  title: 'Trim',
  description: 'Cut a time range, either fast (no re-encode) or frame-accurate',
  fields: [
    {
      key: 'range',
      label: 'Time range',
      type: 'timerange',
      help: 'Start/end as mm:ss or hh:mm:ss (decimals allowed)',
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: [
        { value: 'copy', label: 'Fast (no re-encode)' },
        { value: 'precise', label: 'Accurate (re-encode)' },
      ],
      help: 'Fast mode snaps to keyframes and may be off by a few seconds; accurate mode is frame-exact but slower',
    },
  ],
  defaultParams: (info?: MediaInfo) => ({
    startSec: 0,
    endSec: info?.durationSec ?? 0,
    mode: 'copy',
    sourceExt: containerToExt(info?.container),
  }),
  outputName: (inputName, params) => {
    const [base, ext] = splitExt(inputName)
    // copy mode keeps the source container; precise re-encodes to h264+aac → mp4
    const outExt = isCopy(params) ? ext || 'mp4' : 'mp4'
    return `${base}.trim.${outExt}`
  },
  buildArgs: (inputPath, outputPath, params) => {
    // -ss/-to before -i: fast seek, required by both recipes
    const head = [
      '-ss', toTimecode(Number(params.startSec) || 0),
      '-to', toTimecode(Number(params.endSec) || 0),
      '-i', inputPath,
    ]
    const tail = isCopy(params)
      ? ['-c', 'copy', '-avoid_negative_ts', 'make_zero']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac']
    return [...head, ...tail, outputPath]
  },
  expectedOutputDurationSec: (params: OpParams) => {
    const dur = (Number(params.endSec) || 0) - (Number(params.startSec) || 0)
    return dur > 0 ? dur : undefined
  },
  outputMime: (params) => {
    if (!isCopy(params)) return 'video/mp4'
    return EXT_MIME[String(params.sourceExt || '')] ?? 'video/mp4'
  },
}
