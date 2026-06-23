import { cache } from 'react'
import { createDashboardServerClient } from './supabase-server'
import { createServiceClient, type Tables } from '@garsonless/db'
import { getUserRestaurantAccess, assertAccess } from './auth/access'

export interface DashboardKPIs {
  revenue: number
  revenueYesterday: number
  orders: number
  ordersYesterday: number
  paidOrders: number
  paidOrdersYesterday: number
  activeOrders: number
  avgBasket: number
  sessions: number
  sessionsYesterday: number
}

export interface HourlySale {
  hour: number
  total: number
}

export interface ActivityEvent {
  id: string
  status: string
  total: number
  tableId: string | null
  createdAt: string
}

export interface TopItem {
  name: string
  count: number
  revenue: number
}

export interface PaymentBreakdown {
  key: string
  label: string
  amount: number
  count: number
  pct: number
}

export interface ProductReportItem {
  name: string
  count: number
  revenue: number
  sharePct: number
  cumulativePct: number
  abcClass: 'A' | 'B' | 'C'
  deltaPct: number | null
}

export interface TableStatusData {
  id: string
  label: string
  status: 'empty' | 'active' | 'new' | 'late' | 'paid'
  time: number
  total: number
  sessionId: string | null
  openedAt: string | null
  unpaidTotal: number
  orderCount: number
  hasUnfinished: boolean
}

export interface DailySale {
  date: string
  current: number
  prev: number
}

export interface HeatmapCell {
  day: number   // 0=Mon … 6=Sun
  hour: number  // 8–22
  count: number
}

export interface TableReportRow {
  id: string
  label: string
  revenue: number
  orders: number
}

export const getRestaurantsForUser = cache(async function getRestaurantsForUser(): Promise<Tables<'restaurants'>[]> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Restaurants the user OWNS or is an ACTIVE member of. SECURITY: both halves
  // filter EXPLICITLY (owner_id / membership) — the broad `anon_read_restaurants`
  // policy (which returns every row to any authenticated user) is never the gate.
  const { data: owned } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .is('deleted_at', null)
  const ownedList = (owned ?? []) as Tables<'restaurants'>[]
  const ownedIds = new Set(ownedList.map((r) => r.id))

  const { data: memberships } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
  const memberIds = ((memberships ?? []) as Array<{ restaurant_id: string }>)
    .map((m) => m.restaurant_id)
    .filter((id) => !ownedIds.has(id))

  let memberList: Tables<'restaurants'>[] = []
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .in('id', memberIds)
      .is('deleted_at', null)
    memberList = (data ?? []) as Tables<'restaurants'>[]
  }

  return [...ownedList, ...memberList].sort((a, b) => a.created_at.localeCompare(b.created_at))
})

export const getRestaurantById = cache(async function getRestaurantById(id: string): Promise<Tables<'restaurants'> | null> {
  // Authorization is the EXPLICIT resolver (owner OR active member), NOT RLS
  // row-visibility: `anon_read_restaurants` would otherwise let any authenticated
  // user read any restaurant. This gate guards every dashboard SSR page, incl. the
  // customers pages whose PII then loads via the service role. (GAP #4b discipline.)
  const access = await getUserRestaurantAccess(id)
  if (!access) return null
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  return data as Tables<'restaurants'> | null
})

export const getCategoriesForRestaurant = cache(async function getCategoriesForRestaurant(restaurantId: string) {
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position')
  return data ?? []
})

export const getItemsForRestaurant = cache(async function getItemsForRestaurant(restaurantId: string) {
  const supabase = await createDashboardServerClient()
  const categoryResult = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)

  const categoryIds = (categoryResult.data ?? []).map((c) => (c as { id: string }).id)
  if (categoryIds.length === 0) return []

  const { data } = await supabase
    .from('menu_items')
    .select('*')
    .in('category_id', categoryIds)
    .is('deleted_at', null)
    .order('position')
  return data ?? []
})

export const getTablesForRestaurant = cache(async function getTablesForRestaurant(restaurantId: string) {
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at')
  return data ?? []
})

export const getThemeConfigForRestaurant = cache(async function getThemeConfigForRestaurant(restaurantId: string): Promise<Tables<'theme_configs'> | null> {
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('theme_configs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single()
  return data as Tables<'theme_configs'> | null
})

const ACTIVE_STATUSES = ['pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready', 'served']

function isOrderVolumeRow(row: { status?: string | null }) {
  return row.status !== 'cancelled'
}

function isCollectedOrder(row: { status?: string | null; paid_at?: string | null }) {
  return row.paid_at != null && row.status !== 'cancelled'
}

function sumTotals(rows: Array<{ total?: number | null }>) {
  return rows.reduce((sum, row) => sum + (row.total ?? 0), 0)
}

function getRangeWindow(range: string) {
  const now = new Date()
  const currentStart = new Date(now)

  if (range === 'day') {
    currentStart.setHours(0, 0, 0, 0)
    const previousStart = new Date(currentStart)
    previousStart.setDate(previousStart.getDate() - 1)
    return { currentStart, previousStart }
  }

  const daysMap: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365 }
  const days = daysMap[range] ?? 7
  currentStart.setDate(currentStart.getDate() - days + 1)
  currentStart.setHours(0, 0, 0, 0)

  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - days)
  return { currentStart, previousStart }
}

type AnalyticsOrderItem = {
  itemId?: string
  name?: string
  price?: number
  qty?: number
  quantity?: number
  modifiersPriceDelta?: number
}

function foldOrderItems(
  rows: Array<{ items?: unknown; created_at?: string }>,
  since?: Date,
) {
  const counts = new Map<string, { count: number; revenue: number }>()

  for (const row of rows) {
    if (since && row.created_at && new Date(row.created_at) < since) continue
    if (!Array.isArray(row.items)) continue

    for (const item of row.items as AnalyticsOrderItem[]) {
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Ürün'
      const qtyRaw = typeof item.quantity === 'number' ? item.quantity : item.qty
      const qty = typeof qtyRaw === 'number' && Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1
      const basePrice = typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : 0
      const modifierDelta = typeof item.modifiersPriceDelta === 'number' && Number.isFinite(item.modifiersPriceDelta)
        ? item.modifiersPriceDelta
        : 0
      const unitPrice = Math.max(0, basePrice + modifierDelta)
      const current = counts.get(name) ?? { count: 0, revenue: 0 }
      current.count += qty
      current.revenue += unitPrice * qty
      counts.set(name, current)
    }
  }

  return counts
}

export async function getDashboardKPIs(restaurantId: string): Promise<DashboardKPIs> {
  const supabase = await createDashboardServerClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const [todayRes, yRes] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status, session_id, paid_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today.toISOString())
      .is('deleted_at', null),
    supabase
      .from('orders')
      .select('total, status, session_id, paid_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())
      .is('deleted_at', null),
  ])

  const tRows = (todayRes.data ?? []) as Tables<'orders'>[]
  const yRows = (yRes.data ?? []) as Tables<'orders'>[]
  const todayVolumeRows = tRows.filter(isOrderVolumeRow)
  const yesterdayVolumeRows = yRows.filter(isOrderVolumeRow)
  const todayCollectedRows = tRows.filter(isCollectedOrder)
  const yesterdayCollectedRows = yRows.filter(isCollectedOrder)

  const revenue = sumTotals(todayCollectedRows)
  const revenueYesterday = sumTotals(yesterdayCollectedRows)
  const orders = todayVolumeRows.length
  const ordersYesterday = yesterdayVolumeRows.length
  const paidOrders = todayCollectedRows.length
  const paidOrdersYesterday = yesterdayCollectedRows.length
  const activeOrders = todayVolumeRows.filter(r => ACTIVE_STATUSES.includes(r.status)).length
  const avgBasket = paidOrders > 0 ? Math.round(revenue / paidOrders) : 0
  const sessions = new Set(todayVolumeRows.map(r => r.session_id).filter(Boolean)).size
  const sessionsYesterday = new Set(yesterdayVolumeRows.map(r => r.session_id).filter(Boolean)).size

  return { revenue, revenueYesterday, orders, ordersYesterday, paidOrders, paidOrdersYesterday, activeOrders, avgBasket, sessions, sessionsYesterday }
}

export async function getHourlySales(restaurantId: string): Promise<HourlySale[]> {
  const supabase = await createDashboardServerClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('orders')
    .select('total, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', today.toISOString())
    .is('deleted_at', null)
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')

  const byHour: Record<number, number> = {}
  for (let h = 0; h < 24; h++) byHour[h] = 0
  for (const row of (data ?? []) as Tables<'orders'>[]) {
    const h = new Date(row.created_at).getHours()
    byHour[h] = (byHour[h] ?? 0) + (row.total ?? 0)
  }
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, total: byHour[h] ?? 0 }))
}

export async function getActivityFeed(restaurantId: string): Promise<ActivityEvent[]> {
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('orders')
    .select('id, status, total, table_id, created_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(7)

  return ((data ?? []) as Tables<'orders'>[]).map(r => ({
    id: r.id,
    status: r.status,
    total: r.total,
    tableId: r.table_id,
    createdAt: r.created_at,
  }))
}

export async function getTopItems(restaurantId: string, range = 'day'): Promise<TopItem[]> {
  const supabase = await createDashboardServerClient()
  const { currentStart } = getRangeWindow(range)

  const { data } = await supabase
    .from('orders')
    .select('items')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', currentStart.toISOString())
    .is('deleted_at', null)
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')

  const counts = foldOrderItems((data ?? []) as Tables<'orders'>[])

  return Array.from(counts.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export async function getPaymentBreakdown(restaurantId: string, range = 'week'): Promise<PaymentBreakdown[]> {
  // Owner OR a member with 'analytics' (reads payment-token aggregates via the
  // service role — so this app-layer gate, not RLS, is the protection).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return []

  const { currentStart } = getRangeWindow(range)
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('orders')
    .select('id, total')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', currentStart.toISOString())
    .is('deleted_at', null)
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')

  const orders = ((data ?? []) as Array<{ id: string; total: number | null }>)
  if (orders.length === 0) return []

  const ids = orders.map((o) => o.id)
  const { data: tokenRows } = await supabase
    .from('order_payment_tokens')
    .select('order_id')
    .in('order_id', ids)

  const onlineOrderIds = new Set(((tokenRows ?? []) as Array<{ order_id: string }>).map((r) => r.order_id))
  const groups: Record<string, { key: string; label: string; amount: number; count: number }> = {
    iyzico: { key: 'iyzico', label: 'İyzico online', amount: 0, count: 0 },
    manual: { key: 'manual', label: 'Manuel tahsilat', amount: 0, count: 0 },
  }

  for (const order of orders) {
    const key = onlineOrderIds.has(order.id) ? 'iyzico' : 'manual'
    groups[key]!.amount += order.total ?? 0
    groups[key]!.count += 1
  }

  const total = Object.values(groups).reduce((sum, group) => sum + group.amount, 0)
  return Object.values(groups)
    .filter((group) => group.count > 0)
    .map((group) => ({
      ...group,
      pct: total > 0 ? Math.round((group.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export async function getProductReportData(restaurantId: string, range = 'week'): Promise<ProductReportItem[]> {
  const supabase = await createDashboardServerClient()
  const { currentStart, previousStart } = getRangeWindow(range)

  const { data } = await supabase
    .from('orders')
    .select('items, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', previousStart.toISOString())
    .is('deleted_at', null)
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')

  const rows = (data ?? []) as Tables<'orders'>[]
  const current = foldOrderItems(rows, currentStart)
  const previous = foldOrderItems(rows.filter((row) => new Date(row.created_at) < currentStart))
  const totalRevenue = Array.from(current.values()).reduce((sum, item) => sum + item.revenue, 0)

  let cumulative = 0
  return Array.from(current.entries())
    .map(([name, value]) => {
      const prevRevenue = previous.get(name)?.revenue ?? 0
      const deltaPct = prevRevenue > 0
        ? Math.round(((value.revenue - prevRevenue) / prevRevenue) * 1000) / 10
        : value.revenue > 0 ? null : 0
      return { name, ...value, deltaPct }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .map((item) => {
      const sharePct = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 1000) / 10 : 0
      const cumulativeBefore = cumulative
      cumulative += sharePct
      const cumulativePct = Math.min(100, Math.round(cumulative * 10) / 10)
      const abcClass: ProductReportItem['abcClass'] = cumulativeBefore < 80 ? 'A' : cumulativeBefore < 95 ? 'B' : 'C'
      return { ...item, sharePct, cumulativePct, abcClass }
    })
}

export async function getSalesOverTime(restaurantId: string, range: string): Promise<DailySale[]> {
  const supabase = await createDashboardServerClient()
  const now = new Date()

  let bucketCount: number
  let isHourly = false

  if (range === 'day') {
    isHourly = true
    bucketCount = 24
  } else {
    const daysMap: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365 }
    bucketCount = daysMap[range] ?? 7
  }

  const periodStart = new Date(now)
  if (isHourly) {
    periodStart.setHours(0, 0, 0, 0)
  } else {
    periodStart.setDate(periodStart.getDate() - bucketCount + 1)
    periodStart.setHours(0, 0, 0, 0)
  }

  const prevStart = new Date(periodStart)
  if (isHourly) {
    prevStart.setDate(prevStart.getDate() - 1)
  } else {
    prevStart.setDate(prevStart.getDate() - bucketCount)
  }

  const { data } = await supabase
    .from('orders')
    .select('total, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', prevStart.toISOString())
    .is('deleted_at', null)
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')

  const rows = (data ?? []) as Tables<'orders'>[]

  if (isHourly) {
    const currentMap: Record<number, number> = {}
    const prevMap: Record<number, number> = {}
    for (const row of rows) {
      const d = new Date(row.created_at)
      const h = d.getHours()
      if (d >= periodStart) {
        currentMap[h] = (currentMap[h] ?? 0) + (row.total ?? 0)
      } else {
        prevMap[h] = (prevMap[h] ?? 0) + (row.total ?? 0)
      }
    }
    return Array.from({ length: 24 }, (_, h) => ({
      date: `${h.toString().padStart(2, '0')}:00`,
      current: currentMap[h] ?? 0,
      prev: prevMap[h] ?? 0,
    }))
  }

  const currentMap: Record<string, number> = {}
  const prevMap: Record<string, number> = {}
  for (const row of rows) {
    const d = new Date(row.created_at)
    const key = d.toISOString().slice(0, 10)
    if (d >= periodStart) {
      currentMap[key] = (currentMap[key] ?? 0) + (row.total ?? 0)
    } else {
      prevMap[key] = (prevMap[key] ?? 0) + (row.total ?? 0)
    }
  }

  return Array.from({ length: bucketCount }, (_, i) => {
    const d = new Date(periodStart)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const pd = new Date(prevStart)
    pd.setDate(pd.getDate() + i)
    const prevKey = pd.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' })
    return { date: label, current: currentMap[key] ?? 0, prev: prevMap[prevKey] ?? 0 }
  })
}

export async function getHeatmapData(restaurantId: string): Promise<HeatmapCell[]> {
  const supabase = await createDashboardServerClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  since.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('orders')
    .select('created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', since.toISOString())
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  const rows = (data ?? []) as Tables<'orders'>[]
  const grid: Record<string, number> = {}

  for (const row of rows) {
    const d = new Date(row.created_at)
    const jsDay = d.getDay()
    const day = jsDay === 0 ? 6 : jsDay - 1
    const hour = d.getHours()
    const k = `${day}-${hour}`
    grid[k] = (grid[k] ?? 0) + 1
  }

  const cells: HeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 8; hour <= 22; hour++) {
      cells.push({ day, hour, count: grid[`${day}-${hour}`] ?? 0 })
    }
  }
  return cells
}

export async function getTablesReportData(restaurantId: string): Promise<TableReportRow[]> {
  const supabase = await createDashboardServerClient()
  const since = new Date()
  since.setDate(since.getDate() - 7)
  since.setHours(0, 0, 0, 0)

  const [tablesRes, ordersRes] = await Promise.all([
    supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('created_at'),
    supabase
      .from('orders')
      .select('table_id, total, status')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', since.toISOString())
      .is('deleted_at', null)
      .not('table_id', 'is', null)
      .not('paid_at', 'is', null)
      .neq('status', 'cancelled'),
  ])

  const tables = (tablesRes.data ?? []) as Tables<'tables'>[]
  const orders = (ordersRes.data ?? []) as Tables<'orders'>[]

  type Agg = { revenue: number; orders: number }
  const byTable = new Map<string, Agg>()

  for (const order of orders) {
    if (!order.table_id) continue
    if (!byTable.has(order.table_id)) byTable.set(order.table_id, { revenue: 0, orders: 0 })
    const agg = byTable.get(order.table_id)!
    agg.revenue += order.total ?? 0
    agg.orders += 1
  }

  return tables.map(t => {
    const agg = byTable.get(t.id)
    return { id: t.id, label: t.label, revenue: agg?.revenue ?? 0, orders: agg?.orders ?? 0 }
  })
}

export async function getTableStatuses(restaurantId: string): Promise<TableStatusData[]> {
  const supabase = await createDashboardServerClient()

  const [tablesRes, sessionsRes] = await Promise.all([
    supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('created_at'),
    supabase
      .from('table_sessions')
      .select('id, table_id, opened_at')
      .eq('restaurant_id', restaurantId)
      .is('closed_at', null),
  ])

  const tables = (tablesRes.data ?? []) as Tables<'tables'>[]
  const sessions = (sessionsRes.data ?? []) as Array<{ id: string; table_id: string; opened_at: string }>
  const sessionIds = sessions.map((session) => session.id)

  let orders: Array<{
    table_session_id: string | null
    status: string
    total: number | null
    paid_at: string | null
    created_at: string
  }> = []

  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from('orders')
      .select('table_session_id, status, total, paid_at, created_at')
      .in('table_session_id', sessionIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    orders = (data ?? []) as typeof orders
  }

  const ordersBySession = new Map<string, typeof orders>()
  for (const order of orders) {
    if (!order.table_session_id) continue
    const list = ordersBySession.get(order.table_session_id) ?? []
    list.push(order)
    ordersBySession.set(order.table_session_id, list)
  }

  const sessionByTable = new Map(sessions.map((session) => [session.table_id, session]))

  return tables.map(t => {
    const session = sessionByTable.get(t.id)
    if (!session) {
      return {
        id: t.id,
        label: t.label,
        status: 'empty' as const,
        time: 0,
        total: 0,
        sessionId: null,
        openedAt: null,
        unpaidTotal: 0,
        orderCount: 0,
        hasUnfinished: false,
      }
    }

    const sessionOrders = ordersBySession.get(session.id) ?? []
    const activeOrders = sessionOrders.filter((order) => order.status !== 'cancelled')
    if (activeOrders.length === 0) {
      return {
        id: t.id,
        label: t.label,
        status: 'empty' as const,
        time: 0,
        total: 0,
        sessionId: session.id,
        openedAt: session.opened_at,
        unpaidTotal: 0,
        orderCount: 0,
        hasUnfinished: false,
      }
    }

    const total = activeOrders.reduce((sum, order) => sum + (order.total ?? 0), 0)
    const unpaidTotal = activeOrders
      .filter((order) => order.paid_at === null)
      .reduce((sum, order) => sum + (order.total ?? 0), 0)
    const unfinished = activeOrders.filter((order) => order.status !== 'served')
    const hasUnfinished = unfinished.length > 0
    const lastOrderAt = activeOrders
      .map((order) => new Date(order.created_at).getTime())
      .reduce((max, ts) => Math.max(max, ts), 0)
    const oldestUnfinishedAt = unfinished
      .map((order) => new Date(order.created_at).getTime())
      .reduce((min, ts) => Math.min(min, ts), Number.POSITIVE_INFINITY)
    const lastMins = lastOrderAt > 0 ? Math.max(0, Math.round((Date.now() - lastOrderAt) / 60000)) : 0
    const oldestUnfinishedMins = Number.isFinite(oldestUnfinishedAt)
      ? Math.max(0, Math.round((Date.now() - oldestUnfinishedAt) / 60000))
      : 0

    let status: TableStatusData['status'] = 'active'
    let time = lastMins
    if (hasUnfinished && oldestUnfinishedMins > 20) {
      status = 'late'
      time = oldestUnfinishedMins
    } else if (hasUnfinished && lastMins < 5) {
      status = 'new'
    } else if (!hasUnfinished && unpaidTotal <= 0) {
      status = 'paid'
      time = 0
    }

    return {
      id: t.id,
      label: t.label,
      status,
      time,
      total: unpaidTotal > 0 ? unpaidTotal : total,
      sessionId: session.id,
      openedAt: session.opened_at,
      unpaidTotal,
      orderCount: activeOrders.length,
      hasUnfinished,
    }
  })
}
