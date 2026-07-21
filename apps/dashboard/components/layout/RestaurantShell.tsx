'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { ShellContext } from '../../lib/shell-context'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { readNotificationPrefs } from '../../lib/notification-prefs'

const ACTIVE_ORDER_STATUSES = ['pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'paid']
import { Skeleton } from '../../lib/ui'
import IconRail from './IconRail'
import ServiceRequestToast from './ServiceRequestToast'
import StoreSwitcher from '../overlays/StoreSwitcher'
import NotificationsPanel from '../overlays/NotificationsPanel'
import { getUnreadInboxCount } from '../../lib/actions/notifications'
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
  /** Sections the user may access (owner → all 8); drives the slim nav. */
  permissions: string[]
  isOwner: boolean
  browserNotificationsEnabled: boolean
  children: ReactNode
}

export default function RestaurantShell({
  restaurantId,
  restaurants,
  userEmail,
  userInitials,
  permissions,
  isOwner,
  browserNotificationsEnabled,
  children,
}: Props) {
  const pathname = usePathname()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [ordersBadge, setOrdersBadge] = useState(0)
  const [inboxUnread, setInboxUnread] = useState(0)
  const [waiterToast, setWaiterToast] = useState<{ tableLabel: string; label: string } | null>(null)
  const tableLabelsRef = useRef<Record<string, string>>({})
  const navigationGuardRef = useRef<string | null>(null)

  // "Garson çağrısı uyarısı" toggle. Read via a ref so the realtime effect
  // (keyed only on restaurantId) always sees the current setting without
  // resubscribing the channel.
  const currentRestaurant = restaurants.find(r => r.id === restaurantId)
  const serviceRequestAlert = readNotificationPrefs(currentRestaurant?.settings ?? null).serviceRequestAlert
  const serviceAlertRef = useRef(serviceRequestAlert)
  useEffect(() => { serviceAlertRef.current = serviceRequestAlert }, [serviceRequestAlert])

  // The bell badge is the durable notification model: unread entries in the
  // per-user inbox, across all categories. It behaves like every other
  // notification centre — it rises when a new notification lands and falls as
  // the user reads them. (`newOrderCount`/`pendingReqCount` still drive the
  // operational rail badge + waiter toast; they are NOT the bell count.)
  const notificationCount = inboxUnread

  const isFullScreen = pathname.includes('/tables')

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false

    const refreshCount = async () => {
      // Same scope as the Orders page: today's orders only — stale test
      // orders from previous days must not inflate the badge.
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('orders')
        .select('status')
        .eq('restaurant_id', restaurantId)
        .in('status', ACTIVE_ORDER_STATUSES)
        .gte('created_at', todayStart.toISOString())
        .is('deleted_at', null)
      const rows = (data ?? []) as Array<{ status: string }>
      if (!cancelled) setOrdersBadge(rows.length)
    }

    void refreshCount()

    // A new order also produces an inbox notification via the async outbox
    // consumer. This channel is anon-visible and therefore always fires, so
    // piggyback a delayed unread refresh to catch the consumer's write even
    // when the authenticated inbox stream is unavailable.
    let inboxTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleInboxRefresh = () => {
      if (inboxTimer) clearTimeout(inboxTimer)
      inboxTimer = setTimeout(() => { refreshInboxUnread() }, 4_000)
    }

    const channel = supabase
      .channel(`orders-badge:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => { void refreshCount(); scheduleInboxRefresh() },
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

  // Unread notification inbox count drives the bell badge. Refreshed on mount,
  // whenever the notifications overlay closes (entries may have just been
  // read), and live via a realtime subscription on the user's own inbox rows
  // (RLS scopes the stream to the signed-in user). In production the outbox
  // inbox consumer inserts these rows; locally they arrive once the consumer
  // is dispatched.
  const refreshInboxUnread = useCallback(() => {
    void getUnreadInboxCount(restaurantId).then((result) => {
      if ('unread' in result) setInboxUnread(result.unread)
    })
  }, [restaurantId])

  useEffect(() => {
    if (overlay === 'notif') return
    refreshInboxUnread()
  }, [refreshInboxUnread, overlay])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false

    // notification_inbox is fully closed to anon, so the realtime socket MUST
    // carry the authenticated JWT or RLS silently drops every event. Set it
    // explicitly before subscribing (the anon-readable tables never needed
    // this, which is why the other badges worked without it).
    const subscribe = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return null
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
      return supabase
        .channel(`inbox-badge:${restaurantId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notification_inbox', filter: `restaurant_id=eq.${restaurantId}` },
          () => { refreshInboxUnread() },
        )
        .subscribe()
    }
    const channelPromise = subscribe()

    // Safety net: the inbox row is written by an async outbox consumer, so a
    // slow/absent realtime path must not leave the bell stale. Cheap head
    // count every 45s.
    const interval = setInterval(() => { refreshInboxUnread() }, 45_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      void channelPromise.then((channel) => { if (channel) void supabase.removeChannel(channel) })
    }
  }, [restaurantId, refreshInboxUnread])

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

    const channel = supabase
      .channel(`service-requests:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_requests', filter: `restaurant_id=eq.${restaurantId}` },
        (payload: { new: Record<string, unknown> }) => {
          const tableId = payload.new['table_id'] as string | undefined
          const label = (tableId && tableLabelsRef.current[tableId]) || 'Masa'
          const requestLabel = serviceRequestLabel(payload.new['request_type'])
          // The waiter toast respects the alert toggle; the bell badge is fed
          // by the durable inbox, not this live count.
          if (serviceAlertRef.current) setWaiterToast({ tableLabel: label, label: requestLabel })
        },
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
    navigation: {
      pathname,
      userInitials,
      ordersBadge,
      permissions,
      isOwner,
    },
  }

  if (isFullScreen) {
    return (
      <ShellContext.Provider value={ctx}>
        {children}
        {overlay === 'notif' && (
          <NotificationsPanel
            restaurantId={restaurantId}
            browserNotificationsEnabled={browserNotificationsEnabled}
            onClose={() => setOverlay(null)}
          />
        )}
        <ServiceRequestToast request={waiterToast} onDismiss={() => setWaiterToast(null)} />
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
          permissions={permissions}
          isOwner={isOwner}
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
        <NotificationsPanel
          restaurantId={restaurantId}
          browserNotificationsEnabled={browserNotificationsEnabled}
          onClose={() => setOverlay(null)}
        />
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

        <ServiceRequestToast request={waiterToast} onDismiss={() => setWaiterToast(null)} />
    </ShellContext.Provider>
  )
}
