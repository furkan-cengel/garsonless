'use server'

import { createDashboardServerClient } from '../supabase-server'
import { assertMember } from '../auth/access'

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// Phase 3 coarse gate: the new-order bell badge is visible to any active member
// (owner or member of any section), not section-specific.
async function assertRestaurantOwner(
  _supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  _userId: string,
) {
  const gate = await assertMember(restaurantId)
  return !('error' in gate)
}

export interface NotificationItem {
  id: string
  type: 'waiter' | 'order'
  title: string
  subtitle: string
  createdAt: string
  /** Present for waiter-call items (resolvable). */
  requestId: string | null
}

const ORDER_NOTIF_STATUSES = ['pending', 'pending_approval', 'ready']

/** Live notification feed merged from pending waiter calls + recent active orders. */
export async function getNotifications(
  restaurantId: string,
): Promise<NotificationItem[] | { error: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()

  const [reqRes, tablesRes, ordersRes] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, table_id, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null),
    supabase
      .from('orders')
      .select('id, status, total, table_id, created_at')
      .eq('restaurant_id', restaurantId)
      .in('status', ORDER_NOTIF_STATUSES)
      .gte('created_at', twoHoursAgo)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const labels: Record<string, string> = {}
  for (const t of (tablesRes.data ?? []) as Array<{ id: string; label: string }>) {
    labels[t.id] = t.label
  }

  const waiterItems: NotificationItem[] = (
    (reqRes.data ?? []) as Array<{ id: string; table_id: string; created_at: string }>
  ).map((r) => ({
    id: `req-${r.id}`,
    type: 'waiter',
    title: `${labels[r.table_id] ?? 'Masa'} garson çağırıyor`,
    subtitle: 'Garson çağrısı bekliyor',
    createdAt: r.created_at,
    requestId: r.id,
  }))

  const orderItems: NotificationItem[] = (
    (ordersRes.data ?? []) as Array<{
      id: string; status: string; total: number; table_id: string | null; created_at: string
    }>
  ).map((o) => {
    const where = o.table_id ? (labels[o.table_id] ?? 'Masa') : 'Gel-al'
    const ready = o.status === 'ready'
    return {
      id: `order-${o.id}`,
      type: 'order' as const,
      title: ready ? `${where} · servise hazır` : `${where} · yeni sipariş`,
      subtitle: `₺${Number(o.total).toLocaleString('tr-TR')}`,
      createdAt: o.created_at,
      requestId: null,
    }
  })

  return [...waiterItems, ...orderItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
