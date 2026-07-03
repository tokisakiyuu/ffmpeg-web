import type { OpDefinition, OpKind } from '../../types'
import { convertOp } from './convert'
import { extractAudioOp } from './extractAudio'
import { trimOp } from './trim'
import { compressOp } from './compress'

export const OPS: Record<OpKind, OpDefinition> = {
  convert: convertOp,
  'extract-audio': extractAudioOp,
  trim: trimOp,
  compress: compressOp,
}

export const OP_LIST: OpDefinition[] = [convertOp, extractAudioOp, trimOp, compressOp]
