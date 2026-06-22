'use client'

import { createContext, useContext } from 'react'

export interface ShellContextValue {
  openStoreSwitcher: () => void
  openNotifications: () => void
  openHelp: () => void
  openProfile: () => void
  /** Register a message to confirm before in-app navigation (null = no guard). */
  setNavigationGuard: (message: string | null) => void
  /** Read the current guard message at click time. */
  getNavigationGuard: () => string | null
  /** Live unread count (pending waiter calls + new orders today); not persisted. */
  notificationCount: number
}

export const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used within RestaurantShell')
  return ctx
}
