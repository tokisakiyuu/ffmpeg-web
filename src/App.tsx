import { useAppStore } from './store'
import { EngineBadge } from './components/EngineBadge'
import { RunControls } from './components/RunControls'
import { ResultPanel } from './components/ResultPanel'
import { DropZone } from './components/input/DropZone'
import { FileCard } from './components/input/FileCard'
import { PipelineEditor } from './components/pipeline/PipelineEditor'

function App() {
  const hasInput = useAppStore((s) => Boolean(s.inputFile))
  const hasOutputs = useAppStore((s) => s.outputs.length > 0)

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">FFmpeg Web Toolbox</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Your files never leave the browser · No install, no upload
            </p>
          </div>
          <EngineBadge />
        </header>

        <main className="space-y-6">
          {hasInput ? <FileCard /> : <DropZone />}
          <PipelineEditor />
          <RunControls />
          {hasOutputs && <ResultPanel />}
        </main>

        <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          Powered by{' '}
          <a
            href="https://github.com/ffmpegwasm/ffmpeg.wasm"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600 dark:decoration-zinc-700 dark:hover:text-zinc-300"
          >
            ffmpeg.wasm
          </a>{' '}
          · Everything runs locally — files are never uploaded · ~2GB per-file limit; large files are slow
        </footer>
      </div>
    </div>
  )
}

export default App
