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

export function useDashboardPushSubscription(restaurantId: string, entitled: boolean) {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? ''
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    supported() ? Notification.permission : 'unsupported',
  )
  const [status, setStatus] = useState<DashboardPushStatus>(() => {
    if (!supported()) return 'unsupported'
    if (!publicKey) return 'unconfigured'
    if (Notification.permission === 'denied') return 'denied'
    return 'idle'
  })
  const [error, setError] = useState<string | null>(null)

  const persist = useCallback(async (subscription: PushSubscription) => {
    const serialized = subscription.toJSON()
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
      throw new Error('Tarayıcı geçerli bir bildirim aboneliği üretmedi.')
    }
    const result = await subscribeDashboardPush(restaurantId, serialized)
    if ('error' in result) throw new Error(`${result.error} (${result.publicCode})`)
  }, [restaurantId])

  // Reconcile an existing browser subscription with the current authenticated
  // restaurant. This restores the server row after a previous logout without
  // prompting the browser for permission again.
  useEffect(() => {
    if (!entitled || !publicKey || !supported() || Notification.permission !== 'granted') return
    let cancelled = false
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (cancelled || !subscription) return
        if (!hasApplicationServerKey(subscription, applicationServerKey(publicKey))) {
          await subscription.unsubscribe()
          if (!cancelled) {
            setStatus('idle')
            setError('Bildirim anahtarı yenilendi. Bu cihazı yeniden etkinleştirin.')
          }
          return
        }
        await persist(subscription)
        if (!cancelled) setStatus('subscribed')
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
      const registration = await navigator.serviceWorker.register('/sw.js')
      const key = applicationServerKey(publicKey)
      let existing = await registration.pushManager.getSubscription()
      if (existing && !hasApplicationServerKey(existing, key)) {
        await existing.unsubscribe()
        existing = null
      }
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
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
