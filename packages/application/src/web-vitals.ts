export const WEB_VITAL_NAMES = ['LCP', 'INP', 'CLS', 'TTFB'] as const

export type WebVitalName = (typeof WEB_VITAL_NAMES)[number]

export function isWebVitalName(value: string): value is WebVitalName {
  return WEB_VITAL_NAMES.some((name) => name === value)
}

export function normalizeWebVitalsSampleRate(value: string | undefined, fallback = 0.05): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback
}
