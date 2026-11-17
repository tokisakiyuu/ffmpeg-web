import { Crop, Gauge, Music, Repeat, RotateCw, Scissors, Shrink, VolumeX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OpKind } from '../../types'

/** kind → icon mapping shared by AddNodeMenu and NodeCard */
export const OP_ICONS: Record<OpKind, LucideIcon> = {
  convert: Repeat,
  'extract-audio': Music,
  trim: Scissors,
  compress: Shrink,
  rotate: RotateCw,
  'remove-audio': VolumeX,
  crop: Crop,
  speed: Gauge,
}
