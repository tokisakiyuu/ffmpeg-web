import type { OpDefinition, OpKind } from '../../types'
import { convertOp } from './convert'
import { extractAudioOp } from './extractAudio'
import { trimOp } from './trim'
import { compressOp } from './compress'
import { rotateOp } from './rotate'
import { removeAudioOp } from './removeAudio'
import { cropOp } from './crop'
import { speedOp } from './speed'

export const OPS: Record<OpKind, OpDefinition> = {
  convert: convertOp,
  'extract-audio': extractAudioOp,
  trim: trimOp,
  compress: compressOp,
  rotate: rotateOp,
  'remove-audio': removeAudioOp,
  crop: cropOp,
  speed: speedOp,
}

export const OP_LIST: OpDefinition[] = [
  convertOp, extractAudioOp, trimOp, compressOp, rotateOp, removeAudioOp, cropOp, speedOp,
]
