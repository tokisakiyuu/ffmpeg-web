import { Download } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../store'
import { formatBytes } from '../lib/format'
import type { OutputArtifact } from '../types'

/** size delta vs the original input, e.g. "-63%" / "+12%" */
function SizeDeltaBadge({ outBytes, inBytes }: { outBytes: number; inBytes?: number }) {
  if (!inBytes || inBytes <= 0) return null
  const delta = Math.round(((outBytes - inBytes) / inBytes) * 100)
  const grew = delta > 0
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 font-mono text-xs font-medium',
        grew
          ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
      )}
    >
      {grew ? '+' : ''}
      {delta}%
    </span>
  )
}

function Preview({ artifact }: { artifact: OutputArtifact }) {
  if (artifact.mime.startsWith('video/')) {
    return <video controls src={artifact.url} className="max-h-64 w-full rounded-lg bg-black" />
  }
  if (artifact.mime.startsWith('audio/')) {
    return <audio controls src={artifact.url} className="w-full" />
  }
  return null
}

export function ResultPanel() {
  const outputs = useAppStore((s) => s.outputs)
  const inputBytes = useAppStore((s) => s.inputFile?.sizeBytes)

  if (outputs.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Output</h2>
      {outputs.map((artifact) => (
        <div
          key={artifact.id}
          className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-800 dark:text-zinc-200">
              {artifact.name}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatBytes(artifact.sizeBytes)}
            </span>
            <SizeDeltaBadge outBytes={artifact.sizeBytes} inBytes={inputBytes} />
          </div>
          <Preview artifact={artifact} />
          <div>
            <a
              download={artifact.name}
              href={artifact.url}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-950"
            >
              <Download size={16} />
              Download
            </a>
          </div>
        </div>
      ))}
    </section>
  )
}
