'use client'

import { createContext, useContext } from 'react'
import type { DashboardSectionEntitlements } from './auth/dashboard-entitlements'

export type ShellOverlay = 'store' | 'notif' | 'help' | 'profile' | null

export const SHELL_OVERLAY_IDS = {
  help: 'dashboard-help-dialog',
  profile: 'dashboard-profile-menu',
} as const

export interface ShellContextValue {
  overlay: ShellOverlay
  toggleOverlay: (overlay: Exclude<ShellOverlay, null>) => void
  closeOverlay: () => void
  openStoreSwitcher: () => void
  openNotifications: () => void
  openHelp: () => void
  openProfile: () => void
  /** Register a message to confirm before in-app navigation (null = no guard). */
  setNavigationGuard: (message: string | null) => void
  /** Read the current guard message at click time. */
  getNavigationGuard: () => string | null
  /** Start feedback for an internal URL. Same-route and external URLs are ignored. */
  beginNavigation: (targetHref: string) => string | null
  /** Cancel the active navigation, optionally only when the operation id matches. */
  cancelNavigation: (operationId?: string) => void
  /** Durable per-user unread notification count. */
  notificationCount: number
  navigation: {
    pathname: string
    userDisplayName: string
    userInitials: string
    userAvatarUrl: string | null
    ordersBadge: number
    permissions: string[]
    isOwner: boolean
    sectionEntitlements: DashboardSectionEntitlements
    tableOperationsAllowed: boolean
  }
}

export const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used within RestaurantShell')
  return ctx
}
