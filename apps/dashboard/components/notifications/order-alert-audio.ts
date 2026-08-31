import type { OrderSoundPreset } from '../../lib/notification-prefs'

type Tone = {
  frequency: number
  startsAt: number
  duration: number
  gain?: number
  type?: OscillatorType
}

const STRONG_PRESET_URLS: Partial<Record<OrderSoundPreset, string>> = {
  'masabu-alert': '/audio/order-alerts/masabu-alert.wav',
  'kitchen-pulse': '/audio/order-alerts/kitchen-pulse.wav',
  'double-strike': '/audio/order-alerts/double-strike.wav',
  'urgent-triple': '/audio/order-alerts/urgent-triple.wav',
}

// These Web Audio patterns are also the resilient fallback when a static WAV
// cannot be fetched or decoded (offline cache corruption, proxy errors, etc.).
const PRESET_TONES: Record<OrderSoundPreset, Tone[]> = {
  classic: [
    { frequency: 880, startsAt: 0, duration: 0.18 },
    { frequency: 1175, startsAt: 0.2, duration: 0.28 },
  ],
  'kitchen-bell': [
    { frequency: 1320, startsAt: 0, duration: 0.16, type: 'triangle' },
    { frequency: 1760, startsAt: 0.04, duration: 0.42, gain: 0.55, type: 'triangle' },
  ],
  'double-chime': [
    { frequency: 740, startsAt: 0, duration: 0.2 },
    { frequency: 988, startsAt: 0.28, duration: 0.24 },
    { frequency: 1318, startsAt: 0.56, duration: 0.32 },
  ],
  'soft-ping': [
    { frequency: 660, startsAt: 0, duration: 0.35, gain: 0.45 },
  ],
  'masabu-alert': [
    { frequency: 740, startsAt: 0, duration: 0.28, gain: 0.9, type: 'square' },
    { frequency: 988, startsAt: 0.3, duration: 0.34, gain: 0.9, type: 'square' },
    { frequency: 1318, startsAt: 0.66, duration: 0.48, gain: 0.9, type: 'triangle' },
  ],
  'kitchen-pulse': [
    { frequency: 920, startsAt: 0, duration: 0.34, gain: 0.95, type: 'square' },
    { frequency: 1380, startsAt: 0.05, duration: 0.5, gain: 0.8, type: 'triangle' },
  ],
  'double-strike': [
    { frequency: 820, startsAt: 0, duration: 0.3, gain: 0.95, type: 'square' },
    { frequency: 820, startsAt: 0.42, duration: 0.42, gain: 0.95, type: 'square' },
  ],
  'urgent-triple': [
    { frequency: 980, startsAt: 0, duration: 0.22, gain: 0.95, type: 'square' },
    { frequency: 1120, startsAt: 0.27, duration: 0.22, gain: 0.95, type: 'square' },
    { frequency: 1320, startsAt: 0.54, duration: 0.42, gain: 0.95, type: 'square' },
  ],
}

let sharedContext: AudioContext | null = null
let activePlayback: Promise<boolean> | null = null
let lastPlaybackStartedAt = 0
const COALESCE_WINDOW_MS = 900
const encodedAssetCache = new Map<string, Promise<ArrayBuffer>>()
const decodedAssetCache = new Map<string, Promise<AudioBuffer>>()

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new window.AudioContext()
  return sharedContext
}

function fetchEncodedAsset(url: string): Promise<ArrayBuffer> {
  const cached = encodedAssetCache.get(url)
  if (cached) return cached
  const request = fetch(url, { cache: 'force-cache' }).then(async (response) => {
    if (!response.ok) throw new Error(`Order alert asset returned ${response.status}`)
    return response.arrayBuffer()
  })
  encodedAssetCache.set(url, request)
  request.catch(() => encodedAssetCache.delete(url))
  return request
}

function decodeAsset(context: AudioContext, url: string): Promise<AudioBuffer> {
  const cached = decodedAssetCache.get(url)
  if (cached) return cached
  const request = fetchEncodedAsset(url).then((encoded) => context.decodeAudioData(encoded.slice(0)))
  decodedAssetCache.set(url, request)
  request.catch(() => decodedAssetCache.delete(url))
  return request
}

/** Warm the four static alarms after the dashboard mounts without playing them. */
export async function preloadOrderAlertSounds(): Promise<void> {
  if (typeof window === 'undefined') return
  await Promise.allSettled(Object.values(STRONG_PRESET_URLS).map(fetchEncodedAsset))
}

function playBuffer(context: AudioContext, buffer: AudioBuffer, volume: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const source = context.createBufferSource()
      const master = context.createGain()
      master.gain.value = Math.min(1, Math.max(0, volume / 100))
      source.buffer = buffer
      source.connect(master)
      master.connect(context.destination)
      source.addEventListener('ended', () => {
        source.disconnect()
        master.disconnect()
        resolve()
      }, { once: true })
      source.start()
    } catch (error) {
      reject(error)
    }
  })
}

async function playTones(context: AudioContext, preset: OrderSoundPreset, volume: number): Promise<void> {
  const master = context.createGain()
  master.gain.value = Math.min(1, Math.max(0, volume / 100))
  master.connect(context.destination)
  const now = context.currentTime
  const tones = PRESET_TONES[preset]

  for (const tone of tones) {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = tone.type ?? 'sine'
    oscillator.frequency.value = tone.frequency
    envelope.gain.setValueAtTime(0.0001, now + tone.startsAt)
    envelope.gain.exponentialRampToValueAtTime(tone.gain ?? 0.8, now + tone.startsAt + 0.015)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + tone.startsAt + tone.duration)
    oscillator.connect(envelope)
    envelope.connect(master)
    oscillator.start(now + tone.startsAt)
    oscillator.stop(now + tone.startsAt + tone.duration)
  }

  const total = Math.max(...tones.map((tone) => tone.startsAt + tone.duration))
  await new Promise<void>((resolve) => window.setTimeout(resolve, Math.ceil(total * 1000) + 30))
  master.disconnect()
}

async function startPlayback(preset: OrderSoundPreset, volume: number): Promise<boolean> {
  const context = getAudioContext()
  if (!context) return false
  try {
    if (context.state === 'suspended') await context.resume()
    if (context.state !== 'running') return false

    const assetUrl = STRONG_PRESET_URLS[preset]
    if (assetUrl) {
      try {
        await playBuffer(context, await decodeAsset(context, assetUrl), volume)
        return true
      } catch {
        // Preserve alarms even if a deployment/CDN returns a broken asset.
      }
    }
    await playTones(context, preset, volume)
    return true
  } catch {
    return false
  }
}

/**
 * Resolves true after playback, or immediately when the request was grouped
 * into an already-running/recent alarm. A single AudioContext is intentionally
 * retained for the dashboard lifetime to avoid cold-start latency.
 */
export function playOrderAlertSound(preset: OrderSoundPreset, volume: number): Promise<boolean> {
  if (activePlayback) return activePlayback
  if (Date.now() - lastPlaybackStartedAt < COALESCE_WINDOW_MS) return Promise.resolve(true)

  lastPlaybackStartedAt = Date.now()
  const playback = startPlayback(preset, volume)
  activePlayback = playback
  void playback.finally(() => {
    if (activePlayback === playback) activePlayback = null
  })
  return playback
}
