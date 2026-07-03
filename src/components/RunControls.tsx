import { Ban, CheckCircle2, Play, RotateCcw, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../store'

/** overall run progress: finished nodes count as 1 each, plus current node ratio */
function useOverallProgress() {
  const nodes = useAppStore((s) => s.nodes)
  const nodeRuns = useAppStore((s) => s.nodeRuns)

  const total = nodes.length
  let done = 0
  let currentIndex = -1
  let currentRatio = 0
  nodes.forEach((n, i) => {
    const run = nodeRuns[n.id]
    if (run?.status === 'done') done++
    if (run?.status === 'running' && currentIndex === -1) {
      currentIndex = i
      currentRatio = Math.min(1, Math.max(0, run.progress))
    }
  })
  const overall = total > 0 ? (done + currentRatio) / total : 0
  // while between nodes, show the next pending node as current
  const displayIndex = currentIndex >= 0 ? currentIndex : Math.min(done, total - 1)
  return { total, displayIndex, currentRatio, overall }
}

const PHASE_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  done: {
    label: 'Done',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
    icon: <CheckCircle2 size={16} />,
  },
  error: {
    label: 'Failed',
    cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
    icon: <XCircle size={16} />,
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
    icon: <Ban size={16} />,
  },
}

export function RunControls() {
  const inputFile = useAppStore((s) => s.inputFile)
  const nodeCount = useAppStore((s) => s.nodes.length)
  const runPhase = useAppStore((s) => s.runPhase)
  const runPipeline = useAppStore((s) => s.runPipeline)
  const cancelRun = useAppStore((s) => s.cancelRun)
  const resetRun = useAppStore((s) => s.resetRun)
  const { total, displayIndex, currentRatio, overall } = useOverallProgress()

  if (runPhase === 'running') {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">
                Processing node {displayIndex + 1} of {total}
              </span>
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                current node {Math.round(currentRatio * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 dark:bg-emerald-500"
                style={{ width: `${Math.round(overall * 100)}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={cancelRun}
            className="shrink-0 rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const badge = PHASE_BADGE[runPhase]
  const disabled = !inputFile || nodeCount === 0

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void runPipeline()}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors',
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-emerald-700',
        )}
      >
        <Play size={16} />
        Start
      </button>
      {badge && (
        <>
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              badge.cls,
            )}
          >
            {badge.icon}
            {badge.label}
          </span>
          <button
            type="button"
            onClick={resetRun}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </>
      )}
    </div>
  )
}
