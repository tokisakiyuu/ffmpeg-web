import { clsx } from 'clsx'
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react'
import type { NodeRunState, NodeStatus, PipelineNode } from '../../types'
import { OPS } from '../../lib/ops'
import { useAppStore } from '../../store'
import { OP_ICONS } from './opIcons'
import { CommandPreview } from './CommandPreview'
import { ParamField } from './ParamField'

const IDLE_RUN: NodeRunState = { status: 'idle', progress: 0, logTail: [] }

const STATUS_DOT: Record<NodeStatus, string> = {
  idle: 'bg-zinc-300 dark:bg-zinc-600',
  waiting: 'bg-slate-400',
  running: 'bg-emerald-500 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500',
  cancelled: 'bg-amber-500',
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: 'Idle',
  waiting: 'Queued',
  running: 'Running',
  done: 'Done',
  error: 'Error',
  cancelled: 'Cancelled',
}

interface NodeCardProps {
  node: PipelineNode
  index: number
  total: number
}

export function NodeCard({ node, index, total }: NodeCardProps) {
  const run = useAppStore((s) => s.nodeRuns[node.id]) ?? IDLE_RUN
  const pipelineRunning = useAppStore((s) => s.runPhase === 'running')
  const inputFile = useAppStore((s) => s.inputFile)
  const removeNode = useAppStore((s) => s.removeNode)
  const moveNode = useAppStore((s) => s.moveNode)
  const updateNodeParams = useAppStore((s) => s.updateNodeParams)

  const def = OPS[node.kind]
  const Icon = OP_ICONS[node.kind]
  const disabled = pipelineRunning

  return (
    <div className="w-72 shrink-0 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <Icon size={18} className="shrink-0 text-emerald-600 dark:text-emerald-500" />
        <span className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {def.title}
        </span>
        <span
          title={STATUS_LABEL[run.status]}
          className={clsx('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[run.status])}
        />
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <HeaderButton
            title="Move left"
            disabled={disabled || index === 0}
            onClick={() => moveNode(node.id, -1)}
          >
            <ArrowLeft size={14} />
          </HeaderButton>
          <HeaderButton
            title="Move right"
            disabled={disabled || index === total - 1}
            onClick={() => moveNode(node.id, 1)}
          >
            <ArrowRight size={14} />
          </HeaderButton>
          <HeaderButton title="Remove node" danger disabled={disabled} onClick={() => removeNode(node.id)}>
            <Trash2 size={14} />
          </HeaderButton>
        </div>
      </div>

      {/* params */}
      <div className="space-y-3 px-3 py-3">
        {def.fields.length === 0 && (
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {def.description}
          </p>
        )}
        {def.fields.map((field) => (
          <ParamField
            key={field.key}
            field={field}
            params={node.params}
            disabled={disabled}
            onChange={(patch) => updateNodeParams(node.id, patch)}
          />
        ))}
      </div>

      {/* footer */}
      <div className="space-y-2 border-t border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <CommandPreview
          kind={node.kind}
          params={node.params}
          inputName={inputFile?.name}
          info={inputFile?.info}
        />

        {run.status === 'running' && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${Math.round(run.progress * 100)}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] text-emerald-600 dark:text-emerald-500">
              {Math.round(run.progress * 100)}%
            </span>
          </div>
        )}

        {run.status === 'error' && run.error && (
          <p title={run.error} className="truncate text-xs text-red-600 dark:text-red-500">
            {run.error}
          </p>
        )}
      </div>
    </div>
  )
}

function HeaderButton({
  title,
  danger,
  disabled,
  onClick,
  children,
}: {
  title: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'rounded-md p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950 dark:hover:text-red-500'
          : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300',
      )}
    >
      {children}
    </button>
  )
}
