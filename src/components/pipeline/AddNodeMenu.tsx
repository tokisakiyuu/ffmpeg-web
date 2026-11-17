import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { OpKind } from '../../types'
import { OP_LIST } from '../../lib/ops'
import { useAppStore } from '../../store'
import { OP_ICONS } from './opIcons'

const MENU_WIDTH = 288

interface AddNodeMenuProps {
  disabled?: boolean
  /** larger button style for the empty state */
  emphasized?: boolean
}

export function AddNodeMenu({ disabled, emphasized }: AddNodeMenuProps) {
  const addNode = useAppStore((s) => s.addNode)
  const [open, setOpen] = useState(false)
  // fixed positioning so the popover escapes the overflow-x-auto scroller
  const [pos, setPos] = useState<{
    top?: number
    bottom?: number
    left: number
    maxHeight: number
  }>({ top: 0, left: 0, maxHeight: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom - 16
      const above = rect.top - 16
      const openAbove = below < 420 && above > below
      setPos({
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)),
        maxHeight: Math.max(0, openAbove ? above : below),
      })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return
      setOpen(false)
    }
    const close = () => setOpen(false)
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    // fixed position goes stale on scroll/resize, just dismiss
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const pick = (kind: OpKind) => {
    addNode(kind)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        className={
          emphasized
            ? 'inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
            : 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 transition-colors hover:border-emerald-500 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:text-emerald-500'
        }
      >
        <Plus size={16} />
        Add node
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', ...pos, width: MENU_WIDTH }}
          className="z-50 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {OP_LIST.map((op) => {
            const Icon = OP_ICONS[op.kind]
            return (
              <button
                key={op.kind}
                type="button"
                onClick={() => pick(op.kind)}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Icon size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {op.title}
                  </span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {op.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
