'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { OPEN_ORDER_STATUSES } from '@garsonless/domain/orders'
import { ShellContext } from '../../lib/shell-context'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { readNotificationPrefs } from '../../lib/notification-prefs'
import { useGlobalOrderAlerts } from '../notifications/useGlobalOrderAlerts'
import type { Order } from '../orders/useOrdersRealtime'

import { Skeleton } from '../../lib/ui'
import IconRail from './IconRail'
import ServiceRequestToast from './ServiceRequestToast'
import StoreSwitcher from '../overlays/StoreSwitcher'
import NotificationsPanel from '../overlays/NotificationsPanel'
import { getUnreadInboxCount, syncDashboardInboxEvent } from '../../lib/actions/notifications'
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

const MOBILE_RAIL_SHELL_CSS = `
@media (max-width: 760px) {
  .restaurant-shell--mobile-rail {
    height: 100dvh !important;
    flex-direction: column !important;
  }
  .restaurant-shell--mobile-rail .restaurant-main {
    order: 1;
    width: 100%;
    height: calc(100dvh - 58px);
    flex: none !important;
  }
  .restaurant-shell--mobile-rail .restaurant-rail {
    order: 2;
    width: 100% !important;
    height: 58px;
    flex-direction: row !important;
    align-items: center !important;
    gap: 2px !important;
    padding: 6px 8px !important;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: 0 !important;
    border-top: 1px solid var(--border);
    scrollbar-width: none;
  }
  .restaurant-shell--mobile-rail .restaurant-rail::-webkit-scrollbar { display: none; }
  .restaurant-shell--mobile-rail .restaurant-rail .rail-secondary {
    margin-top: 0 !important;
    margin-left: auto;
    flex-direction: row !important;
  }
}
`

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
  const isOrdersRoute = pathname.endsWith('/orders')
  const usesMobileRail = isOrdersRoute || pathname.endsWith('/settings')
  const isCustomersRoute = pathname.includes('/customers')
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
  const notificationPrefs = readNotificationPrefs(currentRestaurant?.settings ?? null)
  const orderAlerts = useGlobalOrderAlerts({
    restaurantId,
    prefs: notificationPrefs,
    browserNotificationsEnabled,
  })
  const { onInsert: onOrderInsert, onUpdate: onOrderUpdate } = orderAlerts

  // The bell badge is the durable notification model: unread entries in the
  // per-user inbox, across all categories. It behaves like every other
  // notification centre — it rises when a new notification lands and falls as
  // the user reads them. (`newOrderCount`/`pendingReqCount` still drive the
  // operational rail badge + waiter toast; they are NOT the bell count.)
  const notificationCount = inboxUnread

  const isFullScreen = pathname.includes('/tables')

  const refreshInboxUnread = useCallback(() => {
    void getUnreadInboxCount(restaurantId).then((result) => {
      if ('unread' in result) setInboxUnread(result.unread)
    })
  }, [restaurantId])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false

    const refreshCount = async () => {
      // Same operational scope as the Orders board: every order that still
      // needs action, including work carried across restaurant-day rollover.
      const { data } = await supabase
        .from('orders')
        .select('id, restaurant_id, table_id, status, source, items, total, created_at')
        .eq('restaurant_id', restaurantId)
        .in('status', [...OPEN_ORDER_STATUSES])
        .is('deleted_at', null)
      const rows = (data ?? []) as Order[]
      if (!cancelled) {
        setOrdersBadge(rows.length)
        const recentCutoff = Date.now() - 10 * 60_000
        for (const order of rows) {
          if (
            order.source !== 'staff'
            && (order.status === 'pending' || order.status === 'pending_approval')
            && new Date(order.created_at).getTime() >= recentCutoff
          ) {
            onOrderInsert(order)
            void syncDashboardInboxEvent(restaurantId, order.id).then((result) => {
              if ('unread' in result) setInboxUnread(result.unread)
            })
          }
        }
      }
    }

    void refreshCount()

    // A new order also produces an inbox notification via the async outbox
    // consumer. Repair only that exact aggregate when the optional worker
    // callback is unavailable; never backfill unrelated historical orders.
    const syncInboxForOrder = (orderId: string | null) => {
      if (!orderId) return
      void syncDashboardInboxEvent(restaurantId, orderId).then((result) => {
        if ('unread' in result) setInboxUnread(result.unread)
      })
    }

    // Global anon order reads were retired. Realtime also honours RLS, so the
    // socket must carry the dashboard session JWT before this channel starts.
    const subscribe = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return null
      if (data.session) await supabase.realtime.setAuth(data.session.access_token)
      return supabase
        .channel(`orders-badge:${restaurantId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
          (payload: { new: Record<string, unknown> }) => {
            void refreshCount()
            onOrderInsert(payload.new as Order)
            syncInboxForOrder(typeof payload.new['id'] === 'string' ? payload.new['id'] : null)
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
          (payload: { new: Record<string, unknown> }) => {
            void refreshCount()
            onOrderUpdate(payload.new as Order)
          },
        )
        .subscribe()
    }
    const channelPromise = subscribe()
    // Reconnects can miss a change that occurred while the socket was down.
    // Keep the operational badge eventually consistent without depending on
    // a page refresh; Realtime remains the instant path.
    const interval = setInterval(() => { void refreshCount() }, 45_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      void channelPromise.then((channel) => { if (channel) void supabase.removeChannel(channel) })
    }
  }, [restaurantId, onOrderInsert, onOrderUpdate])

  // Unread notification inbox count drives the bell badge. Refreshed on mount,
  // whenever the notifications overlay closes (entries may have just been
  // read), and live via a realtime subscription on the user's own inbox rows
  // (RLS scopes the stream to the signed-in user). In production the outbox
  // inbox consumer inserts these rows; locally they arrive once the consumer
  // is dispatched.
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
      if (data.session) await supabase.realtime.setAuth(data.session.access_token)
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
        {orderAlerts.ui}
      </ShellContext.Provider>
    )
  }

  return (
    <ShellContext.Provider value={ctx}>
      <style>{MOBILE_RAIL_SHELL_CSS}</style>
      <div className={`restaurant-shell${usesMobileRail ? ' restaurant-shell--mobile-rail' : ''}`} style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <IconRail
          className="restaurant-rail"
          restaurantId={restaurantId}
          userInitials={userInitials}
          pathname={pathname}
          ordersBadge={ordersBadge}
          permissions={permissions}
          isOwner={isOwner}
        />
        <main
          className={`restaurant-main${isCustomersRoute ? ' restaurant-main--customers' : ''}`}
          style={{
            flex: 1,
            overflow: isCustomersRoute ? 'auto' : 'hidden',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overscrollBehaviorY: isCustomersRoute ? 'contain' : 'auto',
          }}
        >
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
        {orderAlerts.ui}
    </ShellContext.Provider>
  )
}
