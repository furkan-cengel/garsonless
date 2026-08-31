import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_RATE = 44_100
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio', 'order-alerts')

function envelope(time, duration, attack = 0.008, release = 0.22) {
  const fadeIn = Math.min(1, time / attack)
  const fadeOut = Math.min(1, Math.max(0, duration - time) / release)
  return fadeIn * fadeOut
}

function addTone(samples, { start, duration, frequency, gain, harmonics = [1], vibrato = 0 }) {
  const first = Math.floor(start * SAMPLE_RATE)
  const count = Math.floor(duration * SAMPLE_RATE)
  for (let index = 0; index < count && first + index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE
    const phase = 2 * Math.PI * frequency * time + vibrato * Math.sin(2 * Math.PI * 7 * time)
    let value = 0
    for (let harmonic = 0; harmonic < harmonics.length; harmonic += 1) {
      value += Math.sin(phase * (harmonic + 1)) * harmonics[harmonic]
    }
    samples[first + index] += value * gain * envelope(time, duration)
  }
}

function addStrike(samples, { start, gain = 0.32, duration = 0.055 }) {
  const first = Math.floor(start * SAMPLE_RATE)
  const count = Math.floor(duration * SAMPLE_RATE)
  let noiseState = 0x6d2b79f5 ^ first
  for (let index = 0; index < count && first + index < samples.length; index += 1) {
    noiseState = Math.imul(noiseState ^ (noiseState >>> 15), 1 | noiseState)
    noiseState ^= noiseState + Math.imul(noiseState ^ (noiseState >>> 7), 61 | noiseState)
    const noise = ((noiseState ^ (noiseState >>> 14)) >>> 0) / 4_294_967_296 * 2 - 1
    const time = index / SAMPLE_RATE
    samples[first + index] += noise * gain * Math.exp(-time * 54)
  }
}

function render(duration, build) {
  const samples = new Float64Array(Math.ceil(duration * SAMPLE_RATE))
  build(samples)

  // Gentle soft clipping adds density on small phone speakers without allowing
  // unsafe digital peaks. Each file is then normalized to -1 dBFS (0.89 peak).
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.tanh(samples[index] * 1.35)
    peak = Math.max(peak, Math.abs(samples[index]))
  }
  const scale = peak > 0 ? 0.89 / peak : 1
  return Float32Array.from(samples, (sample) => sample * scale)
}

function wavBuffer(samples) {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    buffer.writeInt16LE(Math.round(sample * 32_767), 44 + index * bytesPerSample)
  }
  return buffer
}

const alerts = {
  'masabu-alert': render(1.72, (samples) => {
    for (const [start, frequency] of [[0, 740], [0.34, 988], [0.72, 1318]]) {
      addStrike(samples, { start })
      addTone(samples, { start, duration: start === 0.72 ? 0.88 : 0.42, frequency, gain: 0.68, harmonics: [1, 0.42, 0.22], vibrato: 0.018 })
      addTone(samples, { start, duration: 0.32, frequency: frequency / 2, gain: 0.28, harmonics: [1, 0.25] })
    }
  }),
  'kitchen-pulse': render(1.42, (samples) => {
    for (const start of [0, 0.6]) {
      addStrike(samples, { start, gain: 0.42 })
      addTone(samples, { start, duration: 0.62, frequency: 920, gain: 0.7, harmonics: [1, 0.5, 0.28, 0.13] })
      addTone(samples, { start: start + 0.018, duration: 0.7, frequency: 1380, gain: 0.38, harmonics: [1, 0.3] })
    }
  }),
  'double-strike': render(1.34, (samples) => {
    for (const start of [0, 0.48]) {
      addStrike(samples, { start, gain: 0.5, duration: 0.07 })
      addTone(samples, { start, duration: 0.66, frequency: 820, gain: 0.76, harmonics: [1, 0.52, 0.31, 0.18] })
      addTone(samples, { start, duration: 0.42, frequency: 410, gain: 0.3, harmonics: [1, 0.35] })
    }
  }),
  'urgent-triple': render(1.48, (samples) => {
    for (const [start, frequency] of [[0, 980], [0.3, 1120], [0.6, 1320]]) {
      addStrike(samples, { start, gain: 0.38 })
      addTone(samples, { start, duration: start === 0.6 ? 0.72 : 0.3, frequency, gain: 0.74, harmonics: [1, 0.46, 0.24], vibrato: 0.012 })
      addTone(samples, { start, duration: 0.28, frequency: frequency / 2, gain: 0.24, harmonics: [1, 0.25] })
    }
  }),
}

await mkdir(OUTPUT_DIR, { recursive: true })
await Promise.all(Object.entries(alerts).map(([name, samples]) => (
  writeFile(join(OUTPUT_DIR, `${name}.wav`), wavBuffer(samples))
)))

console.log(`Generated ${Object.keys(alerts).length} mono order alerts in ${OUTPUT_DIR}`)
