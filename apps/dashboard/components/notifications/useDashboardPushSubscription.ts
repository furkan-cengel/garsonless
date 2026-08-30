'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  subscribeDashboardPush,
  unsubscribeDashboardPush,
} from '../../lib/actions/push-subscriptions'

export type DashboardPushStatus =
  | 'unsupported'
  | 'unconfigured'
  | 'idle'
  | 'subscribing'
  | 'subscribed'
  | 'denied'
  | 'error'

let browserSubscriptionTask: Promise<PushSubscription> | null = null

function applicationServerKey(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - normalized.length % 4) % 4)
  const raw = window.atob(normalized + padding)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function hasApplicationServerKey(subscription: PushSubscription, expected: Uint8Array) {
  const current = subscription.options.applicationServerKey
  if (!current) return false
  const bytes = new Uint8Array(current)
  return bytes.length === expected.length && bytes.every((byte, index) => byte === expected[index])
}

function supported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
}

function ensureBrowserSubscription(publicKey: string) {
  if (browserSubscriptionTask) return browserSubscriptionTask
  const task = (async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    const registration = await navigator.serviceWorker.ready
    const key = applicationServerKey(publicKey)
    let subscription = await registration.pushManager.getSubscription()
    if (subscription && !hasApplicationServerKey(subscription, key)) {
      await subscription.unsubscribe()
      subscription = null
    }
    return subscription ?? registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
  })()
  browserSubscriptionTask = task
  void task.finally(() => {
    if (browserSubscriptionTask === task) browserSubscriptionTask = null
  }).catch(() => {})
  return task
}

export function useDashboardPushSubscription(restaurantId: string, entitled: boolean) {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? ''
  // The first render must be identical on the server and in the browser. Browser
  // capability and permission are reconciled after hydration.
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [status, setStatus] = useState<DashboardPushStatus>(publicKey ? 'idle' : 'unconfigured')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported()) {
      setPermission('unsupported')
      setStatus('unsupported')
      return
    }
    const browserPermission = Notification.permission
    setPermission(browserPermission)
    if (!publicKey) setStatus('unconfigured')
    else if (browserPermission === 'denied') setStatus('denied')
    else setStatus('idle')
  }, [publicKey])

  const persist = useCallback(async (subscription: PushSubscription) => {
    const serialized = subscription.toJSON()
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
      throw new Error('Tarayıcı geçerli bir bildirim aboneliği üretmedi.')
    }
    const result = await subscribeDashboardPush(restaurantId, serialized)
    if ('error' in result) throw new Error(`${result.error} (${result.publicCode})`)
  }, [restaurantId])

  // A granted origin permission is not itself a Web Push subscription. Repair
  // or create the browser endpoint and persist it for this tenant without
  // showing a second permission prompt. This also heals installed Android PWAs
  // whose OS permission survived a logout, reinstall or VAPID key rotation.
  useEffect(() => {
    if (!entitled || !publicKey || !supported() || Notification.permission !== 'granted') return
    let cancelled = false
    ensureBrowserSubscription(publicKey)
      .then(async (subscription) => {
        if (cancelled) return
        await persist(subscription)
        if (!cancelled) {
          setError(null)
          setStatus('subscribed')
        }
      })
      .catch((cause) => {
        if (cancelled) return
        setStatus('error')
        setError(cause instanceof Error ? cause.message : 'Bildirim aboneliği doğrulanamadı.')
      })
    return () => { cancelled = true }
  }, [entitled, persist, publicKey])

  const subscribe = useCallback(async () => {
    if (!entitled || !supported()) return
    if (!publicKey) {
      setStatus('unconfigured')
      setError('Web Push anahtarı bu ortamda yapılandırılmamış.')
      return
    }
    setStatus('subscribing')
    setError(null)
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        setStatus(nextPermission === 'denied' ? 'denied' : 'idle')
        return
      }
      const subscription = await ensureBrowserSubscription(publicKey)
      await persist(subscription)
      setStatus('subscribed')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error ? cause.message : 'Bildirim aboneliği başlatılamadı.')
    }
  }, [entitled, persist, publicKey])

  const unsubscribe = useCallback(async () => {
    if (!supported()) return
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const result = await unsubscribeDashboardPush(restaurantId, subscription.endpoint)
        if ('error' in result) throw new Error(`${result.error} (${result.publicCode})`)
        await subscription.unsubscribe()
      }
      setStatus('idle')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error ? cause.message : 'Bildirim aboneliği kapatılamadı.')
    }
  }, [restaurantId])

  return { permission, status, error, subscribe, unsubscribe }
}
