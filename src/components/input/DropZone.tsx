import { Upload } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../../store'
import { useFileInput } from '../../hooks/useFileInput'

/** big drop target shown while no input file is selected */
export function DropZone() {
  const inputFile = useAppStore((s) => s.inputFile)
  const { inputRef, openPicker, handleInputChange, isDragging } = useFileInput()

  if (inputFile) return null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPicker()
        }
      }}
      className={clsx(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
        isDragging
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-zinc-300 bg-white hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-600',
      )}
    >
      <Upload
        size={20}
        className={clsx(isDragging ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-400')}
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Drop, click to choose, or paste (<span className="font-mono">⌘V</span>) a video/audio file
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Processed locally in your browser — never uploaded</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={handleInputChange}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
