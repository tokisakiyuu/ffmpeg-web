# FFmpeg Web Toolbox

An in-browser ffmpeg utility built on [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm). Everything runs locally — files never leave your device.

## Features

- Convert between common formats — video: MP4 / WebM / MKV / MOV / AVI / FLV / MPEG-TS / GIF; audio: MP3 / M4A / WAV / FLAC / OGG Vorbis
- Extract the audio track from a video (lossless stream copy supported)
- Trim clips (fast keyframe mode / frame-accurate re-encode mode)
- Compress video (adjustable CRF, resolution, encoder preset)
- Import files via drag & drop, file picker, or ⌘V paste
- Chain operations as nodes in a linear workflow with per-node progress; only the final node's output is produced. The equivalent ffmpeg command is previewed live and copyable
- Node layout and parameters persist in localStorage

## Development

```bash
pnpm install
pnpm dev
pnpm build   # output in dist/, deployable to any static host (incl. GitHub Pages — no COOP/COEP headers needed)
```

## Technical notes

- Single-threaded `@ffmpeg/core`, self-hosted via `?url` imports — no SharedArrayBuffer requirement, works on Safari
- Inputs are mounted zero-copy through WORKERFS, falling back to `writeFile`; MEMFS is cleaned right after each output is read
- Progress is normalized from the log `time` divided by the expected output duration (the official progress event is unreliable for trim/stream-copy jobs)
- Cancellation = `terminate()` + lazy reload
- Limits: 2GB wasm32 memory ceiling (input + output + working memory combined); a warning shows above 500MB; re-encoding runs at roughly 1/12 of native speed
