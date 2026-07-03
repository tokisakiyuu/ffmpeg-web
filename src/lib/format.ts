/** shared formatting helpers — keep dependency-free */

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

/** seconds → "m:ss" or "h:mm:ss" */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

/** seconds → ffmpeg timecode "HH:MM:SS.mmm" */
export function toTimecode(sec: number): string {
  const clamped = Math.max(0, sec)
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  const s = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
}

/** parse "ss", "mm:ss", "hh:mm:ss", each part may have decimals; undefined when invalid */
export function parseTimecode(input: string): number | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  const parts = trimmed.split(':')
  if (parts.length > 3) return undefined
  let sec = 0
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part)) return undefined
    sec = sec * 60 + Number(part)
  }
  return sec
}

/** strip extension, returns [base, ext-without-dot] */
export function splitExt(name: string): [string, string] {
  const i = name.lastIndexOf('.')
  if (i <= 0) return [name, '']
  return [name.slice(0, i), name.slice(i + 1).toLowerCase()]
}
