'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { isWebVitalName } from '@garsonless/application/web-vitals'

const SAMPLE_KEY = 'masabu:menu-web-vitals-sampled:v1'

function routeFamily(pathname: string): 'menu/home' | 'menu/catalog' | 'menu/table' | 'menu/system' {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'api' || segments[0] === 'auth' || segments[0] === 'theme-preview') return 'menu/system'
  if (segments.includes('table')) return 'menu/table'
  return segments.at(-1) === 'menu' ? 'menu/catalog' : 'menu/home'
}

function sessionIsSampled(sampleRate: number): boolean {
  try {
    const stored = window.sessionStorage.getItem(SAMPLE_KEY)
    if (stored === '1') return true
    if (stored === '0') return false
    const sampled = Math.random() < sampleRate
    window.sessionStorage.setItem(SAMPLE_KEY, sampled ? '1' : '0')
    return sampled
  } catch {
    return Math.random() < sampleRate
  }
}

export default function WebVitalsReporter({ sampleRate }: { sampleRate: number }) {
  const pathname = usePathname()
  const sampledRef = useRef<boolean | null>(null)

  useReportWebVitals((metric) => {
    if (!isWebVitalName(metric.name)) return
    sampledRef.current ??= sessionIsSampled(sampleRate)
    if (!sampledRef.current) return
    void fetch('/api/internal/web-vitals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({
        schemaVersion: 1,
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        navigationType: metric.navigationType,
        routeFamily: routeFamily(pathname),
      }),
    }).catch(() => undefined)
  })
  return null
}
