import type { OrderSoundPreset } from '../../lib/notification-prefs'

type Tone = { frequency: number; startsAt: number; duration: number; gain?: number }

const PRESET_TONES: Record<OrderSoundPreset, Tone[]> = {
  classic: [
    { frequency: 880, startsAt: 0, duration: 0.18 },
    { frequency: 1175, startsAt: 0.2, duration: 0.28 },
  ],
  'kitchen-bell': [
    { frequency: 1320, startsAt: 0, duration: 0.16 },
    { frequency: 1760, startsAt: 0.04, duration: 0.42, gain: 0.55 },
  ],
  'double-chime': [
    { frequency: 740, startsAt: 0, duration: 0.2 },
    { frequency: 988, startsAt: 0.28, duration: 0.24 },
    { frequency: 1318, startsAt: 0.56, duration: 0.32 },
  ],
  'soft-ping': [
    { frequency: 660, startsAt: 0, duration: 0.35, gain: 0.45 },
  ],
}
/** Resolves true only after the browser accepted and started the sound. */
export async function playOrderAlertSound(preset: OrderSoundPreset, volume: number): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return false

  let context: AudioContext | null = null
  try {
    context = new AudioContextClass()
    if (context.state === 'suspended') await context.resume()
    if (context.state !== 'running') {
      await context.close()
      return false
    }

    const master = context.createGain()
    master.gain.value = Math.min(1, Math.max(0, volume / 100))
    master.connect(context.destination)
    const now = context.currentTime
    const tones = PRESET_TONES[preset]

    for (const tone of tones) {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      oscillator.type = preset === 'kitchen-bell' ? 'triangle' : 'sine'
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
    await context.close()
    return true
  } catch {
    if (context && context.state !== 'closed') await context.close().catch(() => {})
    return false
  }
}
