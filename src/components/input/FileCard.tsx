import { AlertTriangle, Clock, FileAudio, FileVideo, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../../store'
import { useFileInput } from '../../hooks/useFileInput'
import { formatBytes, formatDuration } from '../../lib/format'

const MB = 1024 * 1024
const WARN_BYTES = 500 * MB
const DANGER_BYTES = 1536 * MB

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      {children}
    </span>
  )
}

/** selected-file card: metadata badges, size warnings, replace/remove actions */
export function FileCard() {
  const inputFile = useAppStore((s) => s.inputFile)
  const runPhase = useAppStore((s) => s.runPhase)
  const clearInputFile = useAppStore((s) => s.clearInputFile)
  const { inputRef, openPicker, handleInputChange } = useFileInput()

  if (!inputFile) return null

  const { name, sizeBytes, info, probeError } = inputFile
  const probing = !info && !probeError
  const running = runPhase === 'running'
  const isAudio = inputFile.file.type.startsWith('audio/')
  const FileIcon = isAudio ? FileAudio : FileVideo

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3 p-4">
        <FileIcon size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-500" />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100" title={name}>
              {name}
            </p>
            <span className="shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              {formatBytes(sizeBytes)}
            </span>
          </div>

          {probing && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              <Loader2 size={14} className="animate-spin" />
              Reading media info…
            </p>
          )}

          {info && (
            <div className="flex flex-wrap gap-1.5">
              {info.durationSec !== undefined && (
                <Badge>
                  <Clock size={12} />
                  <span className="font-mono">{formatDuration(info.durationSec)}</span>
                </Badge>
              )}
              {info.width !== undefined && info.height !== undefined && (
                <Badge>
                  <span className="font-mono">
                    {info.width}×{info.height}
                  </span>
                </Badge>
              )}
              {info.videoCodec && (
                <Badge>
                  video <span className="font-mono">{info.videoCodec}</span>
                </Badge>
              )}
              {info.audioCodec && (
                <Badge>
                  audio <span className="font-mono">{info.audioCodec}</span>
                </Badge>
              )}
            </div>
          )}

          {probeError && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Could not read metadata — processing still works</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={openPicker}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw size={14} />
            Replace
          </button>
          <button
            type="button"
            onClick={clearInputFile}
            disabled={running}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-red-950/40"
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      </div>

      {sizeBytes > WARN_BYTES && (
        <div
          className={clsx(
            'flex items-start gap-2 rounded-b-xl border-t px-4 py-2.5 text-xs',
            sizeBytes > DANGER_BYTES
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400'
              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400',
          )}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {sizeBytes > DANGER_BYTES
            ? 'File is close to the 2GB browser memory limit — processing will likely fail. Split or compress it with a native tool first.'
            : 'Large file — in-browser processing is slow and memory-hungry. Please be patient.'}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
