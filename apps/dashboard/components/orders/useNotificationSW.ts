'use client'

import { useEffect } from 'react'
import type { Order } from './useOrdersRealtime'
import { formatCurrency } from '../../lib/utils'

export function useNotificationSW(newOrder: Order | null) {
  // Register ServiceWorker on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // SW registration failures are non-fatal
      })

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  // Post new order event to SW
  useEffect(() => {
    if (!newOrder) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Web Audio API beep — no external dependency
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch {
      // AudioContext not available (e.g. no user gesture yet) — silent fail
    }

    // Post to ServiceWorker for Web Notification
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({
          type: 'NEW_ORDER',
          title: 'New Order!',
          body: `${formatCurrency(newOrder.total)} · ${
            (newOrder.items as unknown as { name: string }[])[0]?.name ?? 'New order'
          }`,
        })
      })
      .catch(() => {})
  }, [newOrder])
}
