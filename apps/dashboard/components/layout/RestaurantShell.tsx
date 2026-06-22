'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { Tables } from '@garsonless/db'
import { ShellContext } from '../../lib/shell-context'
import { createDashboardBrowserClient } from '../../lib/supabase'

const ACTIVE_ORDER_STATUSES = ['pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'paid']
import { Skeleton } from '../../lib/ui'
import IconRail from './IconRail'
import ServiceRequestToast from './ServiceRequestToast'
import StoreSwitcher from '../overlays/StoreSwitcher'
import NotificationsPanel from '../overlays/NotificationsPanel'
import HelpModal from '../overlays/HelpModal'
import ProfileMenu from '../overlays/ProfileMenu'

export function RestaurantShellSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 24px', height: '100%' }}>
      <Skeleton height={44} width="100%" />
      <div style={{ display: 'flex', gap: 16 }}>
        <Skeleton height={90} style={{ flex: 1 }} />
        <Skeleton height={90} style={{ flex: 1 }} />
        <Skeleton height={90} style={{ flex: 1 }} />
      </div>
      <Skeleton height="100%" style={{ flex: 1, minHeight: 320 }} />
    </div>
  )
}

type Overlay = 'store' | 'notif' | 'help' | 'profile' | null

interface Props {
  restaurantId: string
  restaurants: Tables<'restaurants'>[]
  userEmail: string
  userInitials: string
  children: ReactNode
}

export default function RestaurantShell({
  restaurantId,
  restaurants,
  userEmail,
  userInitials,
  children,
}: Props) {
  const pathname = usePathname()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [ordersBadge, setOrdersBadge] = useState(0)
  const [newOrderCount, setNewOrderCount] = useState(0)
  const [pendingReqCount, setPendingReqCount] = useState(0)
  const [waiterToastLabel, setWaiterToastLabel] = useState<string | null>(null)
  const tableLabelsRef = useRef<Record<string, string>>({})
  const navigationGuardRef = useRef<string | null>(null)

  // Live unread = pending waiter calls + new orders today (derived, not persisted).
  const notificationCount = newOrderCount + pendingReqCount

  const isFullScreen = pathname.includes('/tables')

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false

    const refreshCount = async () => {
      // Same scope as the Orders page: today's orders only — stale test
      // orders from previous days must not inflate the badge.
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ACTIVE_ORDER_STATUSES)
        .gte('created_at', todayStart.toISOString())
        .is('deleted_at', null)
      if (!cancelled) setOrdersBadge(count ?? 0)

      // Notification unread share: only brand-new orders awaiting action.
      const { count: newCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'pending_approval'])
        .gte('created_at', todayStart.toISOString())
        .is('deleted_at', null)
      if (!cancelled) setNewOrderCount(newCount ?? 0)
    }

    void refreshCount()

    const channel = supabase
      .channel(`orders-badge:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => { void refreshCount() },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => { void refreshCount() },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [restaurantId])

  // Waiter-call notifications: load table labels once, then toast on each new request.
  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false

    const loadLabels = async () => {
      const { data } = await supabase
        .from('tables')
        .select('id, label')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const row of (data ?? []) as Array<{ id: string; label: string }>) {
        map[row.id] = row.label
      }
      tableLabelsRef.current = map
    }
    void loadLabels()

    const refreshPendingCount = async () => {
      const { count } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
      if (!cancelled) setPendingReqCount(count ?? 0)
    }
    void refreshPendingCount()

    const channel = supabase
      .channel(`service-requests:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests', filter: `restaurant_id=eq.${restaurantId}` },
        (payload: { new: Record<string, unknown> }) => {
          const tableId = payload.new['table_id'] as string | undefined
          const label = (tableId && tableLabelsRef.current[tableId]) || 'Masa'
          setWaiterToastLabel(label)
          void refreshPendingCount()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `restaurant_id=eq.${restaurantId}` },
        () => { void refreshPendingCount() },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [restaurantId])

  const ctx = {
    openStoreSwitcher: () => setOverlay('store'),
    openNotifications:  () => setOverlay('notif'),
    openHelp:           () => setOverlay('help'),
    openProfile:        () => setOverlay('profile'),
    setNavigationGuard: (message: string | null) => { navigationGuardRef.current = message },
    getNavigationGuard: () => navigationGuardRef.current,
    notificationCount,
  }

  if (isFullScreen) {
    return (
      <ShellContext.Provider value={ctx}>
        {children}
        {overlay === 'notif' && (
          <NotificationsPanel restaurantId={restaurantId} onClose={() => setOverlay(null)} />
        )}
        <ServiceRequestToast tableLabel={waiterToastLabel} onDismiss={() => setWaiterToastLabel(null)} />
      </ShellContext.Provider>
    )
  }

  return (
    <ShellContext.Provider value={ctx}>
      <div style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <IconRail
          restaurantId={restaurantId}
          userInitials={userInitials}
          pathname={pathname}
          ordersBadge={ordersBadge}
        />
        <main style={{ flex: 1, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>

      {overlay === 'store' && (
        <StoreSwitcher
          restaurants={restaurants}
          currentRestaurantId={restaurantId}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === 'notif' && (
        <NotificationsPanel restaurantId={restaurantId} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'help' && (
        <HelpModal onClose={() => setOverlay(null)} />
      )}
      {overlay === 'profile' && (
        <ProfileMenu
          userEmail={userEmail}
          userInitials={userInitials}
          restaurants={restaurants}
          currentRestaurantId={restaurantId}
          onClose={() => setOverlay(null)}
        />
      )}

      <ServiceRequestToast tableLabel={waiterToastLabel} onDismiss={() => setWaiterToastLabel(null)} />
    </ShellContext.Provider>
  )
}
