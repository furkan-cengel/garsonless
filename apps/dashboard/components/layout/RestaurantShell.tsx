'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { OPEN_ORDER_STATUSES } from '@garsonless/domain/orders'
import { ShellContext, type ShellOverlay } from '../../lib/shell-context'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type { NotificationPrefs } from '../../lib/notification-prefs'
import { useGlobalOrderAlerts } from '../notifications/useGlobalOrderAlerts'
import type { Order } from '../orders/useOrdersRealtime'
import type { RestaurantSwitcherItem } from './restaurant-shell-model'

import { Skeleton } from '../../lib/ui'
import IconRail from './IconRail'
import ServiceRequestToast from './ServiceRequestToast'
import { getUnreadInboxCount, syncDashboardInboxEvent } from '../../lib/actions/notifications'
import NavigationFeedback, { useNavigationFeedback } from './NavigationFeedback'

const HelpModal = dynamic(() => import('../overlays/HelpModal'), { ssr: false })
const NotificationsPanel = dynamic(() => import('../overlays/NotificationsPanel'), { ssr: false })
const ProfileMenu = dynamic(() => import('../overlays/ProfileMenu'), { ssr: false })
const StoreSwitcher = dynamic(() => import('../overlays/StoreSwitcher'), { ssr: false })

export function RestaurantShellSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Dashboard hazırlanıyor" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 24px', height: '100%' }}>
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
    overflow-x: hidden;
    overflow-y: hidden;
    border-right: 0 !important;
    border-top: 1px solid var(--border);
    scrollbar-width: none;
  }
  .restaurant-shell--mobile-rail .restaurant-rail::-webkit-scrollbar { display: none; }
  .restaurant-shell--mobile-rail .restaurant-rail .rail-primary {
    min-width: 0;
    flex: 1;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .restaurant-shell--mobile-rail .restaurant-rail .rail-primary::-webkit-scrollbar { display: none; }
  .restaurant-shell--mobile-rail .restaurant-rail .rail-secondary {
    margin-top: 0 !important;
    margin-left: auto;
    flex-direction: row !important;
    flex-shrink: 0;
    background: var(--surface);
  }
  .restaurant-shell--mobile-rail .restaurant-rail .rail-tooltip { display: none; }
}
`

interface Props {
  restaurantId: string
  restaurants: RestaurantSwitcherItem[]
  userEmail: string
  userDisplayName: string
  userInitials: string
  userAvatarUrl: string | null
  planLabel: string
  /** Sections the user may access (owner → all 8); drives the slim nav. */
  permissions: string[]
  isOwner: boolean
  browserNotificationsEnabled: boolean
  notificationPrefs: NotificationPrefs
  children: ReactNode
}

export default function RestaurantShell({
  restaurantId,
  restaurants,
  userEmail,
  userDisplayName,
  userInitials,
  userAvatarUrl,
  planLabel,
  permissions,
  isOwner,
  browserNotificationsEnabled,
  notificationPrefs,
  children,
}: Props) {
  const pathname = usePathname()
  const isCustomersRoute = pathname.includes('/customers')
  const [overlay, setOverlay] = useState<ShellOverlay>(null)
  const [ordersBadge, setOrdersBadge] = useState(0)
  const [inboxUnread, setInboxUnread] = useState(0)
  const [waiterToast, setWaiterToast] = useState<{ tableLabel: string; label: string } | null>(null)
  const tableLabelsRef = useRef<Record<string, string>>({})
  const navigationGuardRef = useRef<string | null>(null)
  const navigationFeedback = useNavigationFeedback()

  const closeOverlay = useCallback(() => setOverlay(null), [])
  const toggleOverlay = useCallback((next: Exclude<ShellOverlay, null>) => {
    setOverlay((current) => current === next ? null : next)
  }, [])
  const openStoreSwitcher = useCallback(() => setOverlay('store'), [])
  const openNotifications = useCallback(() => setOverlay('notif'), [])
  const openHelp = useCallback(() => setOverlay('help'), [])
  const openProfile = useCallback(() => setOverlay('profile'), [])
  const setNavigationGuard = useCallback((message: string | null) => { navigationGuardRef.current = message }, [])
  const getNavigationGuard = useCallback(() => navigationGuardRef.current, [])

  useEffect(() => closeOverlay(), [closeOverlay, pathname])

  // Read via a ref so the realtime effect always sees server-resolved prefs
  // without serializing the restaurant settings blob into the client shell.
  const serviceAlertRef = useRef(notificationPrefs.serviceRequestAlert)
  useEffect(() => {
    serviceAlertRef.current = notificationPrefs.serviceRequestAlert
  }, [notificationPrefs.serviceRequestAlert])
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
    if (document.visibilityState !== 'visible') return
    void getUnreadInboxCount(restaurantId).then((result) => {
      if ('unread' in result) setInboxUnread(result.unread)
    })
  }, [restaurantId])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false
    let reconcileTimeout: ReturnType<typeof setTimeout> | null = null

    const refreshCount = async () => {
      if (document.visibilityState !== 'visible') return
      // Same operational scope as the Orders board: every order that still
      // needs action, including work carried across restaurant-day rollover.
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', [...OPEN_ORDER_STATUSES])
        .is('deleted_at', null)
      if (!cancelled) setOrdersBadge(count ?? 0)
    }

    const scheduleReconciliation = () => {
      if (reconcileTimeout) clearTimeout(reconcileTimeout)
      reconcileTimeout = setTimeout(() => { void refreshCount() }, 250)
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
            scheduleReconciliation()
            onOrderInsert(payload.new as Order)
            syncInboxForOrder(typeof payload.new['id'] === 'string' ? payload.new['id'] : null)
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
          (payload: { new: Record<string, unknown> }) => {
            scheduleReconciliation()
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleReconciliation()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(interval)
      if (reconcileTimeout) clearTimeout(reconcileTimeout)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshInboxUnread()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void channelPromise.then((channel) => { if (channel) void supabase.removeChannel(channel) })
    }
  }, [restaurantId, refreshInboxUnread])

  // Waiter-call notifications: resolve a table label only after the first
  // request for that table, then retain it in a restaurant-scoped client cache.
  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false

    const resolveTableLabel = async (tableId: string): Promise<string> => {
      const cached = tableLabelsRef.current[tableId]
      if (cached) return cached
      const { data } = await supabase
        .from('tables')
        .select('label')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .maybeSingle()
      const label = (data as { label?: string } | null)?.label ?? 'Masa'
      tableLabelsRef.current[tableId] = label
      return label
    }

    const subscribe = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return null
      if (data.session) await supabase.realtime.setAuth(data.session.access_token)
      return supabase
        .channel(`service-requests:${restaurantId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'service_requests', filter: `restaurant_id=eq.${restaurantId}` },
          (payload: { new: Record<string, unknown> }) => {
            if (!serviceAlertRef.current) return
            const tableId = typeof payload.new['table_id'] === 'string' ? payload.new['table_id'] : null
            const requestLabel = serviceRequestLabel(payload.new['request_type'])
            void (tableId ? resolveTableLabel(tableId) : Promise.resolve('Masa')).then((label) => {
              if (!cancelled) setWaiterToast({ tableLabel: label, label: requestLabel })
            })
          },
        )
        .subscribe()
    }
    const channelPromise = subscribe()

    return () => {
      cancelled = true
      tableLabelsRef.current = {}
      void channelPromise.then((channel) => { if (channel) void supabase.removeChannel(channel) })
    }
  }, [restaurantId])

  const ctx = useMemo(() => ({
    overlay,
    toggleOverlay,
    closeOverlay,
    openStoreSwitcher,
    openNotifications,
    openHelp,
    openProfile,
    setNavigationGuard,
    getNavigationGuard,
    beginNavigation: navigationFeedback.beginNavigation,
    cancelNavigation: navigationFeedback.cancelNavigation,
    notificationCount,
    navigation: { pathname, userDisplayName, userInitials, userAvatarUrl, ordersBadge, permissions, isOwner },
  }), [
    closeOverlay,
    getNavigationGuard,
    navigationFeedback.beginNavigation,
    navigationFeedback.cancelNavigation,
    isOwner,
    notificationCount,
    openHelp,
    openNotifications,
    openProfile,
    openStoreSwitcher,
    ordersBadge,
    overlay,
    pathname,
    permissions,
    setNavigationGuard,
    toggleOverlay,
    userAvatarUrl,
    userDisplayName,
    userInitials,
  ])

  if (isFullScreen) {
    return (
      <ShellContext.Provider value={ctx}>
        <NavigationFeedback
          snapshot={navigationFeedback.snapshot}
          onRetry={navigationFeedback.retryNavigation}
          onDismiss={navigationFeedback.cancelNavigation}
        />
        {children}
        {overlay === 'notif' && (
          <NotificationsPanel
            restaurantId={restaurantId}
            browserNotificationsEnabled={browserNotificationsEnabled}
            onClose={closeOverlay}
          />
        )}
        {overlay === 'store' && (
          <StoreSwitcher
            restaurants={restaurants}
            currentRestaurantId={restaurantId}
            isOwner={isOwner}
            onClose={closeOverlay}
          />
        )}
        {overlay === 'help' && (
          <HelpModal restaurantId={restaurantId} permissions={permissions} isOwner={isOwner} onClose={closeOverlay} />
        )}
        {overlay === 'profile' && (
          <ProfileMenu
            userEmail={userEmail}
            displayName={userDisplayName}
            userInitials={userInitials}
            avatarUrl={userAvatarUrl}
            planLabel={planLabel}
            unreadCount={notificationCount}
            restaurants={restaurants}
            currentRestaurantId={restaurantId}
            onOpenNotifications={openNotifications}
            onOpenStoreSwitcher={openStoreSwitcher}
            onClose={closeOverlay}
          />
        )}
        <ServiceRequestToast request={waiterToast} onDismiss={() => setWaiterToast(null)} />
        {orderAlerts.ui}
      </ShellContext.Provider>
    )
  }

  return (
    <ShellContext.Provider value={ctx}>
      <NavigationFeedback
        snapshot={navigationFeedback.snapshot}
        onRetry={navigationFeedback.retryNavigation}
        onDismiss={navigationFeedback.cancelNavigation}
      />
      <style>{MOBILE_RAIL_SHELL_CSS}</style>
      <div className="restaurant-shell restaurant-shell--mobile-rail" style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <IconRail
          className="restaurant-rail"
          restaurantId={restaurantId}
          userDisplayName={userDisplayName}
          userInitials={userInitials}
          userAvatarUrl={userAvatarUrl}
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
          isOwner={isOwner}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'notif' && (
        <NotificationsPanel
          restaurantId={restaurantId}
          browserNotificationsEnabled={browserNotificationsEnabled}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'help' && (
        <HelpModal restaurantId={restaurantId} permissions={permissions} isOwner={isOwner} onClose={closeOverlay} />
      )}
      {overlay === 'profile' && (
        <ProfileMenu
          userEmail={userEmail}
          displayName={userDisplayName}
          userInitials={userInitials}
          avatarUrl={userAvatarUrl}
          planLabel={planLabel}
          unreadCount={notificationCount}
          restaurants={restaurants}
          currentRestaurantId={restaurantId}
          onOpenNotifications={openNotifications}
          onOpenStoreSwitcher={openStoreSwitcher}
          onClose={closeOverlay}
        />
      )}

        <ServiceRequestToast request={waiterToast} onDismiss={() => setWaiterToast(null)} />
        {orderAlerts.ui}
    </ShellContext.Provider>
  )
}
