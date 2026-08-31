'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Order } from '../orders/useOrdersRealtime'
import OrderToast from '../orders/OrderToast'
import type { NotificationPrefs } from '../../lib/notification-prefs'
import { playOrderAlertSound, preloadOrderAlertSounds } from './order-alert-audio'
import { useDashboardPushSubscription } from './useDashboardPushSubscription'
import { formatCurrency } from '../../lib/utils'
import { enqueueOrderAlert, isPendingCustomerOrder, resolveOrderAlert } from './order-alert-policy'

type AlertMessage =
  | { type: 'enqueue'; restaurantId: string; order: Order }
  | { type: 'resolved'; restaurantId: string; orderId: string }

const CHANNEL_NAME = 'masabu-order-alerts'
const STORAGE_MESSAGE_KEY = 'masabu:order-alert-message'
const AUDIO_RECEIPT_PREFIX = 'masabu:order-audio'
const AUDIO_LOCK_PREFIX = 'masabu:order-audio-lock'
const AUDIO_GROUP_LOCK_PREFIX = 'masabu:order-audio-group'
const AUDIO_LOCK_TTL_MS = 5_000
const AUDIO_GROUP_LOCK_TTL_MS = 2_500

function receiptKey(restaurantId: string, orderId: string, attempt: number) {
  return `${AUDIO_RECEIPT_PREFIX}:${restaurantId}:${orderId}:${attempt}`
}

function lockKey(restaurantId: string, orderId: string, attempt: number) {
  return `${AUDIO_LOCK_PREFIX}:${restaurantId}:${orderId}:${attempt}`
}

async function claimAudioLease(key: string, ttlMs: number): Promise<boolean> {
  try {
    const current = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { token?: string; at?: number } | null
    if (current?.at && Date.now() - current.at < ttlMs) return false
    const claim = { token: crypto.randomUUID(), at: Date.now() }
    const serialized = JSON.stringify(claim)
    window.localStorage.setItem(key, serialized)
    // Let competing tabs publish their claim, then only the final writer wins.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    return window.localStorage.getItem(key) === serialized
  } catch {
    // Storage-disabled browsers still receive same-tab coalescing from the
    // shared audio engine.
    return true
  }
}

export function useGlobalOrderAlerts(input: {
  restaurantId: string
  prefs: NotificationPrefs
  browserNotificationsEnabled: boolean
}) {
  const { restaurantId, prefs, browserNotificationsEnabled } = input
  const subscription = useDashboardPushSubscription(restaurantId, browserNotificationsEnabled)
  const [queue, setQueue] = useState<Order[]>([])
  const [audioBlocked, setAudioBlocked] = useState(false)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const repeatTimersRef = useRef(new Map<string, number>())

  useEffect(() => {
    void preloadOrderAlertSounds()
  }, [])

  const remove = useCallback((orderId: string) => {
    setQueue((current) => resolveOrderAlert(current, orderId))
    const timer = repeatTimersRef.current.get(orderId)
    if (timer) window.clearTimeout(timer)
    repeatTimersRef.current.delete(orderId)
    void navigator.serviceWorker?.ready.then((registration) => {
      registration.active?.postMessage({ type: 'ORDER_RESOLVED', orderId })
    }).catch(() => {})
  }, [])

  const playAttempt = useCallback(async (order: Order, attempt: number) => {
    if (!prefs.newOrderSound) return
    const key = receiptKey(restaurantId, order.id, attempt)
    const lock = lockKey(restaurantId, order.id, attempt)
    try {
      if (window.localStorage.getItem(key) === '1') return
    } catch { /* in-memory delivery still proceeds */ }
    if (!await claimAudioLease(lock, AUDIO_LOCK_TTL_MS)) return

    const groupLock = `${AUDIO_GROUP_LOCK_PREFIX}:${restaurantId}`
    if (!await claimAudioLease(groupLock, AUDIO_GROUP_LOCK_TTL_MS)) {
      try {
        window.localStorage.setItem(key, '1')
        window.localStorage.removeItem(lock)
      } catch { /* privacy mode */ }
      return
    }

    const played = await playOrderAlertSound(prefs.newOrderSoundPreset, prefs.newOrderSoundVolume)
    if (!played) {
      try { window.localStorage.removeItem(lock) } catch { /* privacy mode */ }
      setAudioBlocked(true)
      return
    }
    setAudioBlocked(false)
    try {
      window.localStorage.setItem(key, '1')
      window.localStorage.removeItem(lock)
    } catch { /* privacy mode */ }
  }, [prefs.newOrderSound, prefs.newOrderSoundPreset, prefs.newOrderSoundVolume, restaurantId])

  const scheduleRepeats = useCallback((order: Order) => {
    if (!prefs.newOrderSound || prefs.newOrderRepeatSeconds === 0) return
    if (repeatTimersRef.current.has(order.id)) return
    const startedAt = Date.now()
    let attempt = 1
    const run = () => {
      if (Date.now() - startedAt >= prefs.newOrderRepeatMaxMinutes * 60_000) {
        repeatTimersRef.current.delete(order.id)
        return
      }
      void playAttempt(order, attempt++)
      repeatTimersRef.current.set(order.id, window.setTimeout(run, prefs.newOrderRepeatSeconds * 1000))
    }
    repeatTimersRef.current.set(order.id, window.setTimeout(run, prefs.newOrderRepeatSeconds * 1000))
  }, [playAttempt, prefs.newOrderRepeatMaxMinutes, prefs.newOrderRepeatSeconds, prefs.newOrderSound])

  const accept = useCallback((order: Order) => {
    if (!isPendingCustomerOrder(order)) return
    setQueue((current) => enqueueOrderAlert(current, order))
    void playAttempt(order, 0)
    scheduleRepeats(order)
    if (
      browserNotificationsEnabled
      && prefs.newOrderPush
      && subscription.status !== 'subscribed'
      && typeof Notification !== 'undefined'
      && Notification.permission === 'granted'
    ) {
      void navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: 'NEW_ORDER',
          orderId: order.id,
          url: `/dashboard/${restaurantId}/orders`,
          title: 'Yeni sipariş!',
          body: formatCurrency(order.total),
        })
      }).catch(() => {})
    }
  }, [browserNotificationsEnabled, playAttempt, prefs.newOrderPush, restaurantId, scheduleRepeats, subscription.status])

  const publish = useCallback((message: AlertMessage) => {
    channelRef.current?.postMessage(message)
    try { window.localStorage.setItem(STORAGE_MESSAGE_KEY, JSON.stringify({ ...message, nonce: crypto.randomUUID() })) } catch { /* optional fallback */ }
  }, [])

  useEffect(() => {
    const repeatTimers = repeatTimersRef.current
    const receive = (message: AlertMessage) => {
      if (message.restaurantId !== restaurantId) return
      if (message.type === 'enqueue') accept(message.order)
      else remove(message.orderId)
    }
    if ('BroadcastChannel' in window) {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME)
      channelRef.current.addEventListener('message', (event: MessageEvent<AlertMessage>) => receive(event.data))
    }
    const storage = (event: StorageEvent) => {
      if (event.key !== STORAGE_MESSAGE_KEY || !event.newValue) return
      try { receive(JSON.parse(event.newValue) as AlertMessage) } catch { /* ignore malformed peer data */ }
    }
    window.addEventListener('storage', storage)
    return () => {
      channelRef.current?.close()
      channelRef.current = null
      window.removeEventListener('storage', storage)
      for (const timer of repeatTimers.values()) window.clearTimeout(timer)
      repeatTimers.clear()
    }
  }, [accept, remove, restaurantId])

  const onInsert = useCallback((order: Order) => {
    accept(order)
    publish({ type: 'enqueue', restaurantId, order })
  }, [accept, publish, restaurantId])

  const onUpdate = useCallback((order: Order) => {
    if (isPendingCustomerOrder(order)) return
    remove(order.id)
    publish({ type: 'resolved', restaurantId, orderId: order.id })
  }, [publish, remove, restaurantId])

  const active = queue[0] ?? null
  const ui = useMemo(() => (
    <>
      <OrderToast
        order={active}
        enabled={prefs.newOrderToast}
        onDismiss={() => active && setQueue((current) => current.filter((order) => order.id !== active.id))}
      />
      {audioBlocked && prefs.newOrderSound && (
        <button
          type="button"
          onClick={() => { if (active) void playAttempt(active, 0) }}
          style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 210, border: 0, borderRadius: 9, padding: '10px 13px', background: 'var(--warning)', color: 'var(--on-action)', fontWeight: 700, cursor: 'pointer' }}
        >
          Sipariş sesini etkinleştir
        </button>
      )}
    </>
  ), [active, audioBlocked, playAttempt, prefs.newOrderSound, prefs.newOrderToast])

  return { onInsert, onUpdate, ui, queued: queue.length }
}
