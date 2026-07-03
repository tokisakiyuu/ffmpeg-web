import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import type { MediaInfo, OpKind, OpParams } from '../../types'
import { OPS } from '../../lib/ops'

interface CommandPreviewProps {
  kind: OpKind
  params: OpParams
  /** actual input filename; falls back to a placeholder */
  inputName?: string
  info?: MediaInfo
}

/** quote argv items the way a shell user would type them */
function shellQuote(arg: string): string {
  return /[\s"'\\$&|;<>()*?#]/.test(arg) ? `'${arg.replaceAll("'", "'\\''")}'` : arg
}

export function CommandPreview({ kind, params, inputName, info }: CommandPreviewProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const def = OPS[kind]
  const inName = inputName ?? 'input.mp4'
  let command = ''
  try {
    const outName = def.outputName(inName, params)
    const args = def.buildArgs(inName, outName, params, info)
    command = ['ffmpeg', ...args].map(shellQuote).join(' ')
  } catch {
    command = '# incomplete params — cannot build the command'
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable (permissions/insecure context); ignore
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Show command
      </button>

      {open && (
        <div className="relative mt-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-950 dark:ring-1 dark:ring-zinc-800">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all p-2.5 pr-9 font-mono text-[11px] leading-relaxed text-zinc-200">
            {command}
          </pre>
          <button
            type="button"
            onClick={copy}
            title={copied ? 'Copied' : 'Copy command'}
            className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  )
}
