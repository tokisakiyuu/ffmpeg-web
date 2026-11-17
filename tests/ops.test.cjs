const assert = require('node:assert/strict')
const fs = require('node:fs')
const { test } = require('node:test')
const { pathToFileURL } = require('node:url')
const ts = require('typescript')

// Load the same operation definitions used by Vite, without another test dependency.
require.extensions['.ts'] = (mod, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  })
  mod._compile(outputText, filename)
}

const { cropOp } = require('../src/lib/ops/crop.ts')
const { speedOp } = require('../src/lib/ops/speed.ts')
const { rotateOp } = require('../src/lib/ops/rotate.ts')
const { removeAudioOp } = require('../src/lib/ops/removeAudio.ts')

test('video operations process real media with the bundled FFmpeg core', async (t) => {
  // The browser core expects a worker location, even when wasmBinary is supplied.
  globalThis.self = { location: { href: pathToFileURL(require.resolve('@ffmpeg/core')).href } }
  const core = await require('@ffmpeg/core')({
    wasmBinary: fs.readFileSync(require.resolve('@ffmpeg/core/wasm')),
  })
  delete globalThis.self
  let logs = []
  core.setLogger(({ message }) => logs.push(message))

  function exec(args) {
    logs = []
    core.reset()
    assert.equal(core.exec(...args), 0, logs.slice(-20).join('\n'))
  }

  function run(op, input, params = op.defaultParams()) {
    const output = op.outputName(input, params)
    exec(op.buildArgs(input, output, params))
    return output
  }

  function probe(name) {
    core.reset()
    core.ffprobe('-v', 'error', '-show_streams', '-show_format', '-of', 'json', '-o', 'probe.json', name)
    const info = JSON.parse(core.FS.readFile('probe.json', { encoding: 'utf8' }))
    core.FS.unlink('probe.json')
    return info
  }

  function rgb(name) {
    exec(['-i', name, '-map', '0:v:0', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'frame.rgb'])
    return core.FS.readFile('frame.rgb')
  }

  function sample(data, width, x, y) {
    return [...data.slice((y * width + x) * 3, (y * width + x) * 3 + 3)]
  }

  function nearColor(actual, expected) {
    actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 30, `${actual} differs from ${expected}`))
  }

  function assertTracks(info, width, height, audioCount = 2) {
    const video = info.streams.find((s) => s.codec_type === 'video')
    assert.equal(video.width, width)
    assert.equal(video.height, height)
    assert.equal(info.streams.filter((s) => s.codec_type === 'audio').length, audioCount)
  }

  exec([
    '-f', 'lavfi', '-i',
    'color=black:s=96x64:r=24:d=2,drawbox=x=0:y=0:w=48:h=32:color=red:t=fill,drawbox=x=48:y=0:w=48:h=32:color=blue:t=fill,drawbox=x=0:y=32:w=48:h=32:color=green:t=fill,drawbox=x=48:y=32:w=48:h=32:color=yellow:t=fill',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-map', '0:v', '-map', '1:a', '-map', '1:a',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 'input.mp4',
  ])
  const original = rgb('input.mp4')
  const corners = [[24, 16], [72, 16], [24, 48], [72, 48]]
    .map(([x, y]) => sample(original, 96, x, y))

  await t.test('rotate node flip options mirror pixels and preserve both audio tracks', () => {
    for (const [angle, order] of [
      ['horizontal', [1, 0, 3, 2]],
      ['vertical', [2, 3, 0, 1]],
      ['180', [3, 2, 1, 0]],
    ]) {
      const output = run(rotateOp, 'input.mp4', { angle })
      assertTracks(probe(output), 96, 64)
      const pixels = rgb(output)
      ;[[24, 16], [72, 16], [24, 48], [72, 48]]
        .forEach(([x, y], i) => nearColor(sample(pixels, 96, x, y), corners[order[i]]))
    }
  })

  await t.test('aspect crops keep the largest region with even dimensions', () => {
    for (const [aspect, width, height] of [
      ['1:1', 64, 64], ['16:9', 96, 54], ['9:16', 36, 64],
      ['4:3', 84, 64], ['3:4', 48, 64],
    ]) {
      assertTracks(probe(run(cropOp, 'input.mp4', { aspect })), width, height)
    }
  })

  await t.test('custom crops select the requested region and position', () => {
    for (const [positionX, positionY, corner] of [[0, 0, 0], [100, 0, 1], [0, 100, 2], [100, 100, 3]]) {
      const output = run(cropOp, 'input.mp4', {
        aspect: 'custom', widthPercent: 50, heightPercent: 50, positionX, positionY,
      })
      assertTracks(probe(output), 48, 32)
      nearColor(sample(rgb(output), 48, 24, 16), corners[corner])
    }
  })

  await t.test('crop values outside the controls stay inside the source picture', () => {
    const output = run(cropOp, 'input.mp4', {
      aspect: 'custom', widthPercent: 500, heightPercent: -20, positionX: -10, positionY: 200,
    })
    assertTracks(probe(output), 96, 2)
  })

  await t.test('speed changes duration, keeps audio in sync, and preserves the 440 Hz pitch', () => {
    for (const rate of [0.25, 0.5, 1, 1.5, 2, 4]) {
      const output = run(speedOp, 'input.mp4', { rate })
      const info = probe(output)
      assertTracks(info, 96, 64)
      const expected = 2 / rate
      assert.ok(Math.abs(Number(info.format.duration) - expected) < 0.15, `duration at ${rate}×: ${info.format.duration}`)
      const video = info.streams.find((s) => s.codec_type === 'video')
      for (const audio of info.streams.filter((s) => s.codec_type === 'audio')) {
        assert.ok(Math.abs(Number(video.duration) - Number(audio.duration)) < 0.15, `audio/video sync at ${rate}×`)
      }
      assert.equal(speedOp.expectedOutputDurationSec({ rate }, { durationSec: 2 }), expected)
      exec(['-i', output, '-ss', '0.1', '-t', '0.25', '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'audio.pcm'])
      const raw = core.FS.readFile('audio.pcm')
      const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
      let crossings = 0
      for (let i = 2; i < raw.byteLength; i += 2) {
        if (view.getInt16(i - 2, true) <= 0 && view.getInt16(i, true) > 0) crossings++
      }
      const frequency = crossings / (raw.byteLength / 2 / 8000)
      assert.ok(Math.abs(frequency - 440) < 15, `pitch at ${rate}×: ${frequency} Hz`)
    }
  })

  await t.test('rotation → crop → flip → speed uses the actual intermediate picture', () => {
    let output = run(rotateOp, 'input.mp4')
    output = run(cropOp, output)
    output = run(rotateOp, output, { angle: 'horizontal' })
    output = run(speedOp, output)
    const info = probe(output)
    assertTracks(info, 64, 64)
    assert.ok(Math.abs(Number(info.format.duration) - 1) < 0.15)
  })

  await t.test('all new nodes accept a silent video after audio removal', () => {
    let output = run(removeAudioOp, 'input.mp4')
    assert.deepEqual(rgb(output), original)
    output = run(cropOp, output)
    output = run(rotateOp, output, { angle: 'vertical' })
    output = run(speedOp, output, { rate: 0.5 })
    const info = probe(output)
    assertTracks(info, 64, 64, 0)
    assert.ok(Math.abs(Number(info.format.duration) - 4) < 0.15)
  })
})
