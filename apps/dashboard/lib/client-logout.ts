'use client'

import { signOut } from './actions/auth'
import { createDashboardBrowserClient } from './supabase'

async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return await registration?.pushManager.getSubscription() ?? null
  } catch {
    return null
  }
}

/** Retires the current browser session and its one push endpoint. */
export async function logoutCurrentBrowser(): Promise<{ success: true } | { error: string }> {
  const subscription = await currentPushSubscription()
  const result = await signOut(subscription?.endpoint ?? null)
  if ('error' in result) return result

  try {
    await subscription?.unsubscribe()
    await createDashboardBrowserClient().removeAllChannels()
  } catch {
    // Server-side auth and endpoint cleanup already succeeded. Any stale local
    // browser state is reconciled when another dashboard session is created.
  }
  return { success: true }
}
