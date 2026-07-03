import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { splitExt } from '../lib/format'

/** extensions accepted when a File has an empty MIME type (e.g. from clipboard) */
const MEDIA_EXTENSIONS = new Set([
  // video
  'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'flv', 'wmv', 'mpg', 'mpeg', 'ts', 'mts', '3gp', 'ogv',
  // audio
  'mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'wma', 'aiff', 'amr',
])

function isMediaFile(file: File): boolean {
  if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true
  // clipboard files often carry no MIME type — fall back to extension
  if (!file.type) {
    const [, ext] = splitExt(file.name)
    return MEDIA_EXTENSIONS.has(ext)
  }
  return false
}

/** first audio/video file among the given files, if any */
function pickMediaFile(files: FileList | null | undefined): File | undefined {
  if (!files) return undefined
  for (const file of Array.from(files)) {
    if (isMediaFile(file)) return file
  }
  return undefined
}

export interface FileInputApi {
  /** attach to a hidden <input type="file"> */
  inputRef: React.RefObject<HTMLInputElement | null>
  /** open the native file picker (no-op while running) */
  openPicker: () => void
  /** onChange handler for the hidden input */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** true while a drag with files hovers anywhere over the window */
  isDragging: boolean
}

/**
 * Unified file intake: window-wide drag & drop, document paste, and a
 * hidden <input type=file>. Accepts only the first audio/video file and
 * feeds it to the store. All intake paths are ignored mid-run so the
 * active input cannot be swapped under a running pipeline.
 */
export function useFileInput(): FileInputApi {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  // counter instead of boolean: dragenter/dragleave fire per nested element
  const dragDepth = useRef(0)

  const acceptFile = useCallback((file: File | undefined) => {
    if (!file) return
    const { runPhase, setInputFile } = useAppStore.getState()
    if (runPhase === 'running') return
    setInputFile(file)
  }, [])

  const openPicker = useCallback(() => {
    if (useAppStore.getState().runPhase === 'running') return
    inputRef.current?.click()
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      acceptFile(pickMediaFile(e.target.files))
      // allow re-selecting the same file later
      e.target.value = ''
    },
    [acceptFile],
  )

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current++
      setIsDragging(true)
    }
    const onDragOver = (e: DragEvent) => {
      // preventDefault is required or the browser opens the dropped file
      if (hasFiles(e)) e.preventDefault()
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setIsDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setIsDragging(false)
      acceptFile(pickMediaFile(e.dataTransfer?.files))
    }
    const onPaste = (e: ClipboardEvent) => {
      const file = pickMediaFile(e.clipboardData?.files)
      if (!file) return
      e.preventDefault()
      acceptFile(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      document.removeEventListener('paste', onPaste)
    }
  }, [acceptFile])

  return { inputRef, openPicker, handleInputChange, isDragging }
}
