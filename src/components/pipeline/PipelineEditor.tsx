import { Fragment } from 'react'
import { ChevronRight, Workflow } from 'lucide-react'
import { useAppStore } from '../../store'
import { AddNodeMenu } from './AddNodeMenu'
import { NodeCard } from './NodeCard'

export function PipelineEditor() {
  const nodes = useAppStore((s) => s.nodes)
  const pipelineRunning = useAppStore((s) => s.runPhase === 'running')

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <Workflow size={28} className="text-zinc-300 dark:text-zinc-600" />
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No processing nodes yet</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Add nodes to build a workflow — the file runs through them in order
          </p>
        </div>
        <AddNodeMenu emphasized disabled={pipelineRunning} />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex w-max items-center gap-2">
        {nodes.map((node, i) => (
          <Fragment key={node.id}>
            <NodeCard node={node} index={i} total={nodes.length} />
            <ChevronRight size={18} className="shrink-0 text-zinc-300 dark:text-zinc-700" />
          </Fragment>
        ))}
        <AddNodeMenu disabled={pipelineRunning} />
      </div>
    </div>
  )
}
