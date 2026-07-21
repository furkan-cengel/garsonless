'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Order } from './useOrdersRealtime'
import { formatCurrency } from '../../lib/utils'
import { claimOrderNotificationDelivery } from '../notifications/notification-delivery'

interface NewOrderChannels {
  /** Web Audio beep on a new order. */
  sound: boolean
  /** Desktop Web Notification via the service worker. */
  push: boolean
  /** Server-resolved SaaS entitlement; client preferences cannot bypass it. */
  browserNotificationsEnabled: boolean
}

export function useNotificationSW(restaurantId: string, newOrder: Order | null, channels: NewOrderChannels) {
  const { sound, push, browserNotificationsEnabled } = channels
  const deliveredReceipts = useRef(new Set<string>())
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  )

  const requestPermission = useCallback(async () => {
    if (!browserNotificationsEnabled || !('Notification' in window)) return
    setPermission(await Notification.requestPermission())
  }, [browserNotificationsEnabled])

  // Register ServiceWorker on mount (cheap, fires no notification by itself).
  useEffect(() => {
    if (!browserNotificationsEnabled || !push) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // SW registration failures are non-fatal
      })
  }, [browserNotificationsEnabled, push])

  // Fire the enabled channels on a new order — each gated by its saved setting.
  useEffect(() => {
    if (!newOrder) return
    if (typeof window === 'undefined') return
    if (!claimOrderNotificationDelivery(restaurantId, newOrder.id, deliveredReceipts.current, window.sessionStorage)) return

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
        osc.addEventListener('ended', () => { void ctx.close() }, { once: true })
      } catch {
        // AudioContext not available (e.g. no user gesture yet) — silent fail
      }
    }

    // Desktop Web Notification via the ServiceWorker
    if (browserNotificationsEnabled && push && 'serviceWorker' in navigator) {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({
            type: 'NEW_ORDER',
            orderId: newOrder.id,
            url: `/dashboard/${restaurantId}/orders`,
            title: 'Yeni sipariş!',
            body: `${formatCurrency(newOrder.total)} · ${
              (newOrder.items as unknown as { name: string }[])[0]?.name ?? 'Yeni sipariş'
            }`,
          })
        })
        .catch(() => {})
    }
  }, [browserNotificationsEnabled, newOrder, push, restaurantId, sound])

  return { permission, requestPermission }
}
