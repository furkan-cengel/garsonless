'use client'

import { useEffect } from 'react'
import type { Order } from './useOrdersRealtime'
import { formatCurrency } from '../../lib/utils'

interface NewOrderChannels {
  /** Web Audio beep on a new order. */
  sound: boolean
  /** Desktop Web Notification via the service worker. */
  push: boolean
}

export function useNotificationSW(newOrder: Order | null, channels: NewOrderChannels) {
  const { sound, push } = channels

  // Register ServiceWorker on mount (cheap, fires no notification by itself).
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // SW registration failures are non-fatal
      })
  }, [])

  // Fire the enabled channels on a new order — each gated by its saved setting.
  useEffect(() => {
    if (!newOrder) return
    if (typeof window === 'undefined') return

    // Web Audio API beep — no external dependency
    if (sound) {
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
    }

    // Desktop Web Notification via the ServiceWorker
    if (push && 'serviceWorker' in navigator) {
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({
            type: 'NEW_ORDER',
            title: 'Yeni sipariş!',
            body: `${formatCurrency(newOrder.total)} · ${
              (newOrder.items as unknown as { name: string }[])[0]?.name ?? 'Yeni sipariş'
            }`,
          })
        })
        .catch(() => {})
    }
  }, [newOrder, sound, push])
}
