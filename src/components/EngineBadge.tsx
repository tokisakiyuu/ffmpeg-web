import { Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../store'

/** small status pill reflecting ffmpeg core lifecycle */
export function EngineBadge() {
  const status = useAppStore((s) => s.engineStatus)
  const progress = useAppStore((s) => s.engineLoadProgress)
  const error = useAppStore((s) => s.engineError)

  const dot = (cls: string, pulse = false) => (
    <span
      className={clsx(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        cls,
        pulse && 'animate-pulse',
      )}
    />
  )

  let content: React.ReactNode
  switch (status) {
    case 'loading':
      content = (
        <>
          <Loader2 size={14} className="shrink-0 animate-spin text-emerald-600 dark:text-emerald-500" />
          <span>Downloading core {Math.round(progress * 100)}%</span>
        </>
      )
      break
    case 'ready':
      content = (
        <>
          {dot('bg-emerald-600 dark:bg-emerald-500')}
          <span>Ready</span>
        </>
      )
      break
    case 'running':
      content = (
        <>
          {dot('bg-emerald-600 dark:bg-emerald-500', true)}
          <span>Processing</span>
        </>
      )
      break
    case 'error':
      content = (
        <>
          {dot('bg-red-600')}
          <span className="text-red-600 dark:text-red-500">{error ?? 'Engine error'}</span>
        </>
      )
      break
    default:
      content = (
        <>
          {dot('bg-zinc-400 dark:bg-zinc-600')}
          <span>Engine not loaded · downloads ~31MB on first run</span>
        </>
      )
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      {content}
    </span>
  )
}
