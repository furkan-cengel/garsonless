import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const directory = new URL('.', import.meta.url)
const source = readFileSync(new URL('order-alert-audio.ts', directory), 'utf8')

const strongPresets = ['masabu-alert', 'kitchen-pulse', 'double-strike', 'urgent-triple'] as const

test('strong alarms are valid normalized mono PCM files for phone speakers', () => {
  for (const preset of strongPresets) {
    const wav = readFileSync(new URL(`../../public/audio/order-alerts/${preset}.wav`, directory))
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
    assert.equal(wav.readUInt16LE(20), 1, `${preset} must use PCM`)
    assert.equal(wav.readUInt16LE(22), 1, `${preset} must be mono`)
    assert.equal(wav.readUInt32LE(24), 44_100)
    assert.equal(wav.readUInt16LE(34), 16)

    let peak = 0
    let squareSum = 0
    const sampleCount = (wav.length - 44) / 2
    for (let offset = 44; offset < wav.length; offset += 2) {
      const sample = wav.readInt16LE(offset) / 32_768
      peak = Math.max(peak, Math.abs(sample))
      squareSum += sample * sample
    }
    const rms = Math.sqrt(squareSum / sampleCount)
    assert.ok(peak >= 0.87 && peak <= 0.91, `${preset} peak ${peak} is not safely normalized`)
    assert.ok(rms >= 0.18, `${preset} RMS ${rms} is too quiet`)
    assert.ok(sampleCount / 44_100 >= 1.2 && sampleCount / 44_100 <= 2)
  }
})

test('audio engine preloads, caches, coalesces and retains one AudioContext', () => {
  assert.match(source, /preloadOrderAlertSounds/)
  assert.match(source, /encodedAssetCache/)
  assert.match(source, /decodedAssetCache/)
  assert.match(source, /let sharedContext: AudioContext \| null/)
  assert.match(source, /if \(activePlayback\) return activePlayback/)
  assert.match(source, /COALESCE_WINDOW_MS/)
  assert.doesNotMatch(source, /context\.close\(/)
})

test('every static alarm has a Web Audio fallback', () => {
  for (const preset of strongPresets) {
    assert.match(source, new RegExp(`'${preset}': \\[`, 'm'))
    assert.match(source, new RegExp(`'${preset}': '/audio/order-alerts/${preset}\\.wav'`))
  }
  assert.match(source, /catch \{[\s\S]*await playTones\(context, preset, volume\)/)
})
