'use client'

import { createDashboardBrowserClient } from './supabase'
import { setDashboardLoggingOut } from './auth/logout-state'
export { isDashboardLoggingOut } from './auth/logout-state'

async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return await registration?.pushManager.getSubscription() ?? null
  } catch {
    return null
  }
}

type LogoutResult = { success: true } | { error: string }
let pendingLogout: Promise<LogoutResult> | null = null

/** One exit operation across all callers; a failed attempt can be retried. */
export function logoutCurrentBrowser(): Promise<LogoutResult> {
  if (pendingLogout) return pendingLogout
  setDashboardLoggingOut(true)
  pendingLogout = performLogout().catch(() => ({ error: 'Çıkış yapılamadı. Bağlantını kontrol edip tekrar dene.' }))
  void pendingLogout.then(result => {
    if ('error' in result) {
      pendingLogout = null
      setDashboardLoggingOut(false)
    }
  })
  return pendingLogout
}

/** Retires the current browser session and its one push endpoint. */
async function performLogout(): Promise<LogoutResult> {
  const subscription = await currentPushSubscription()
  try {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription?.endpoint ?? null }),
    })
    const result: unknown = await response.json()
    if (!response.ok || !result || typeof result !== 'object' || !('success' in result) || result.success !== true) {
      return { error: 'Çıkış yapılamadı. Bağlantını kontrol edip tekrar dene.' }
    }
  } catch {
    return { error: 'Çıkış yapılamadı. Bağlantını kontrol edip tekrar dene.' }
  }

  try {
    await subscription?.unsubscribe()
    await createDashboardBrowserClient().removeAllChannels()
  } catch {
    // Server-side auth and endpoint cleanup already succeeded. Any stale local
    // browser state is reconciled when another dashboard session is created.
  }
  return { success: true }
}
