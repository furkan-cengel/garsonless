import { notFound } from 'next/navigation'
import { createDashboardServerClient } from '../../../../lib/supabase-server'
import { getRestaurantById, getTablesForRestaurant, getRestaurantTimezone } from '../../../../lib/queries'
import { startOfRestaurantDay } from '@garsonless/db'
import OrderBoard from '../../../../components/orders/OrderBoard'
import type { Order } from '../../../../components/orders/useOrdersRealtime'
import { readNotificationPrefs } from '../../../../lib/notification-prefs'
import { readLateThresholdMin } from '../../../../lib/orders-prefs'
import { requireSection } from '../../../../lib/auth/access'
import type { Tables } from '@garsonless/db'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function OrdersPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'orders')
  const [restaurant, tables] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
  ])
  if (!restaurant) notFound()

  const supabase = await createDashboardServerClient()
  // Restaurant-local "today" — the board scopes to the café's own day, not the
  // server's (consistent with every reporting query).
  const today = startOfRestaurantDay(await getRestaurantTimezone(restaurantId))

  // Newest-first cap: a >LIMIT day clips the OLDEST orders (likely served) —
  // the board shows a truncation banner instead of hiding them silently.
  const ORDERS_LIMIT = 500

  const { data } = await supabase
    .from('orders')
    .select('id, restaurant_id, table_id, table_session_id, status, items, total, customer_tier, paid_at, payment_method, created_at, sent_to_kitchen_at, ready_at, served_at, cancel_reason')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', today.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(ORDERS_LIMIT)

  const initialOrders = (data ?? []) as Order[]

  // Label map must resolve SOFT-DELETED tables too (same discipline as the Pano
  // activity feed) — an order on a since-deleted table must show its real label,
  // not a generic "Masa". Live tables + any order-referenced deleted ones.
  const liveTables = (tables as Tables<'tables'>[]).map((t) => ({ id: t.id, label: t.label }))
  const knownIds = new Set(liveTables.map((t) => t.id))
  const missingIds = [...new Set(
    initialOrders.map((o) => o.table_id).filter((id): id is string => !!id && !knownIds.has(id)),
  )]
  let tableRefs = liveTables
  if (missingIds.length > 0) {
    const { data: deletedTables } = await supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId)
      .in('id', missingIds) // deliberately NO deleted_at filter
    tableRefs = [...liveTables, ...((deletedTables ?? []) as Array<{ id: string; label: string }>)]
  }
  // GAP #1: kitchen token now lives in kitchen_credentials (owner-scoped, no anon).
  const { data: kc } = await supabase
    .from('kitchen_credentials')
    .select('token')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  const kitchenToken = (kc as { token: string } | null)?.token ?? null

  return (
    <OrderBoard
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initialOrders={initialOrders}
      tables={tableRefs}
      kitchenToken={kitchenToken}
      notifPrefs={readNotificationPrefs(restaurant.settings)}
      lateThresholdMin={readLateThresholdMin(restaurant.settings)}
      initialTruncated={initialOrders.length === ORDERS_LIMIT}
    />
  )
}
