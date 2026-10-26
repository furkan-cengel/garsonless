'use client'

import { useSyncExternalStore } from 'react'

/* GuidedSetup publishes its progress here so the navigation rail can offer the guide in a fixed place. */
export interface GuidedSetupStatus { visible: boolean; completed: number; total: number }

const HIDDEN: GuidedSetupStatus = { visible: false, completed: 0, total: 0 }
let current = HIDDEN
const listeners = new Set<() => void>()

export function publishGuidedSetupStatus(next: GuidedSetupStatus) {
  if (next.visible === current.visible && next.completed === current.completed && next.total === current.total) return
  current = next
  for (const listener of listeners) listener()
}

export function useGuidedSetupStatus(): GuidedSetupStatus {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => HIDDEN,
  )
}
