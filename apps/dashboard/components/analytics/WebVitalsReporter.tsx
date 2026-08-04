'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import {
  dashboardRouteFamily,
  isDashboardWebVitalName,
} from './web-vitals-model'

const SAMPLE_KEY = 'masabu:web-vitals-sampled:v1'

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
    if (!isDashboardWebVitalName(metric.name)) return
    sampledRef.current ??= sessionIsSampled(sampleRate)
    if (!sampledRef.current) return

    const body = JSON.stringify({
      schemaVersion: 1,
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      navigationType: metric.navigationType,
      routeFamily: dashboardRouteFamily(pathname),
    })
    void fetch('/api/internal/web-vitals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => undefined)
  })

  return null
}
