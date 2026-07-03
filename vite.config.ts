import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Required: Vite's pre-bundler breaks the package-internal
    // `new URL('./worker.js', import.meta.url)` worker, making load() hang
    // silently with a 504 "Outdated Optimize Dep".
    // https://github.com/ffmpegwasm/ffmpeg.wasm/issues/532
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
