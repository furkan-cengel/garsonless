import { cache } from 'react'
import { createDashboardServerClient } from './supabase-server'
import {
  createServiceClient, listTeamMembers, isCollectedOrderRow, normalizeTimeZone,
  rangeWindow, startOfRestaurantDay, startOfDayNDaysAgo,
  restaurantDayKey, restaurantHour, restaurantWeekday,
  type Tables,
} from '@garsonless/db'
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
  /** Resolved table label ("Masa 5"); null for manual/takeaway orders (no table). */
  tableLabel: string | null
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
  /** Share of the COLLECTED (tahsilat) base. İkram/comp is never part of this base. */
  pct: number
}

export interface PaymentReport {
  /**
   * Collected (tahsilat) buckets read from the REAL orders.payment_method:
   * iyzico / cash / pos / unknown (legacy null-method paid). pct = share of
   * collectedTotal. Sorted by amount desc.
   */
  collected: PaymentBreakdown[]
  /**
   * İkram (comp): paid_at set but ₺0 COLLECTED — reported as its own metric and
   * NEVER folded into the collected base or its percentages.
   */
  comp: { amount: number; count: number }
  collectedTotal: number
  collectedCount: number
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
  /** Sessions CLOSED in range (completed turns). Open sessions are NOT counted. */
  turnover: number
  /** Mean(closed_at − opened_at) in minutes over range-closed sessions; null if none.
      Still-open sessions are excluded (no end time — counting them would fabricate). */
  avgDwellMinutes: number | null
  /** Has a currently-open session ("şu an dolu"). */
  openNow: boolean
}

export interface PanoSnapshot {
  kpis: DashboardKPIs
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
  heatmap: HeatmapCell[]
  paymentStatus: PaymentStatus | null
}

export interface ThemeEditorCategory {
  id: string
  name: string
  parent_id: string | null
}

export interface ThemeEditorItem {
  id: string
  name: string
  category_id: string
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

export const getThemeEditorMenuRefs = cache(async function getThemeEditorMenuRefs(restaurantId: string) {
  const supabase = await createDashboardServerClient()
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name, parent_id')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('position')

  const categoryIds = ((categories ?? []) as ThemeEditorCategory[]).map((category) => category.id)
  if (categoryIds.length === 0) {
    return {
      categories: [] as ThemeEditorCategory[],
      items: [] as ThemeEditorItem[],
    }
  }

  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, category_id')
    .in('category_id', categoryIds)
    .is('deleted_at', null)
    .order('position')

  return {
    categories: (categories ?? []) as ThemeEditorCategory[],
    items: (items ?? []) as ThemeEditorItem[],
  }
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

// ── Collected revenue (tahsilat) — ONE definition, used by every ciro query ──
// The predicate itself moved to its client-safe home (packages/db order-client
// `isCollectedOrderRow`, re-exported from the server barrel) so the Orders
// board's Tahsilat chip shares the EXACT same rule. Semantics unchanged:
// paid_at set, not cancelled, IS DISTINCT FROM 'comp' (legacy null stays in).
const COMP_METHOD = 'comp'
const isCollectedOrder = isCollectedOrderRow

// PostgREST equivalent of isCollectedOrderRow, appended to an orders query
// builder. `.or('payment_method.is.null,payment_method.neq.comp')` is
// IS DISTINCT FROM 'comp'. If the rule ever changes, change BOTH here and
// isCollectedOrderRow. Generic so each call site keeps its own result typing.
function collectedOrdersFilter<T extends {
  not: (col: string, op: string, val: unknown) => T
  neq: (col: string, val: string) => T
  or: (filters: string) => T
}>(query: T): T {
  return query
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')
    .or(`payment_method.is.null,payment_method.neq.${COMP_METHOD}`)
}

function sumTotals(rows: Array<{ total?: number | null }>) {
  return rows.reduce((sum, row) => sum + (row.total ?? 0), 0)
}

// Request-scoped restaurant timezone (react cache dedupes it per request). Falls
// back to Europe/Istanbul on a null/garbage value (defensive against a bad direct
// DB edit). P1: defined + exported but NOT yet consumed by any query (zero
// behavior change this phase); P2 migrates every date query onto restaurant-time.
export const getRestaurantTimezone = cache(async function getRestaurantTimezone(restaurantId: string): Promise<string> {
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('restaurants')
    .select('timezone')
    .eq('id', restaurantId)
    .maybeSingle()
  return normalizeTimeZone((data as { timezone?: unknown } | null)?.timezone)
})

// Restaurant-local range window: fetches the restaurant timezone (react-cached →
// deduped per request, so a report with N sub-queries triggers ONE tz lookup) and
// delegates to the shared, DST-correct rangeWindow. Replaces the old server-local
// getRangeWindow across every range-aware query.
async function rangeWindowFor(restaurantId: string, range: string) {
  const tz = await getRestaurantTimezone(restaurantId)
  return rangeWindow(tz, range)
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

function emptyKpis(): DashboardKPIs {
  return {
    revenue: 0,
    revenueYesterday: 0,
    orders: 0,
    ordersYesterday: 0,
    paidOrders: 0,
    paidOrdersYesterday: 0,
    activeOrders: 0,
    avgBasket: 0,
    sessions: 0,
    sessionsYesterday: 0,
  }
}

export async function getDashboardKPIs(restaurantId: string): Promise<DashboardKPIs> {
  const supabase = await createDashboardServerClient()
  const tz = await getRestaurantTimezone(restaurantId)
  const today = startOfRestaurantDay(tz)
  const yesterday = startOfDayNDaysAgo(tz, 1)

  const [todayRes, yRes] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status, session_id, paid_at, payment_method')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today.toISOString())
      .is('deleted_at', null),
    supabase
      .from('orders')
      .select('total, status, session_id, paid_at, payment_method')
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
  const tz = await getRestaurantTimezone(restaurantId)
  const today = startOfRestaurantDay(tz)

  const { data } = await collectedOrdersFilter(
    supabase
      .from('orders')
      .select('total, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', today.toISOString())
      .is('deleted_at', null),
  )

  const byHour: Record<number, number> = {}
  for (let h = 0; h < 24; h++) byHour[h] = 0
  for (const row of (data ?? []) as Tables<'orders'>[]) {
    const h = restaurantHour(row.created_at, tz)
    byHour[h] = (byHour[h] ?? 0) + (row.total ?? 0)
  }
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, total: byHour[h] ?? 0 }))
}

export async function getActivityFeed(restaurantId: string): Promise<ActivityEvent[]> {
  const supabase = await createDashboardServerClient()
  // Scope to TODAY + non-cancelled — the EXACT restaurant-local day boundary
  // getDashboardKPIs uses, so the feed and the KPI cards never disagree.
  const today = startOfRestaurantDay(await getRestaurantTimezone(restaurantId))

  const { data } = await supabase
    .from('orders')
    .select('id, status, total, table_id, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', today.toISOString())
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(7)

  const orders = (data ?? []) as Tables<'orders'>[]

  // Batch-resolve table labels in ONE query (no N+1). Labels are looked up even for
  // soft-deleted tables so a real label always resolves.
  const tableIds = [...new Set(orders.map(o => o.table_id).filter((id): id is string => !!id))]
  const labelById = new Map<string, string>()
  if (tableIds.length > 0) {
    const { data: tbls } = await supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId)
      .in('id', tableIds)
    for (const t of (tbls ?? []) as { id: string; label: string }[]) labelById.set(t.id, t.label)
  }

  return orders.map(r => ({
    id: r.id,
    status: r.status,
    total: r.total,
    tableId: r.table_id,
    tableLabel: r.table_id ? labelById.get(r.table_id) ?? null : null,
    createdAt: r.created_at,
  }))
}

export async function getTopItems(restaurantId: string, range = 'day'): Promise<TopItem[]> {
  const supabase = await createDashboardServerClient()
  const { currentStart } = await rangeWindowFor(restaurantId, range)

  const { data } = await collectedOrdersFilter(
    supabase
      .from('orders')
      .select('items')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', currentStart.toISOString())
      .is('deleted_at', null),
  )

  const counts = foldOrderItems((data ?? []) as Tables<'orders'>[])

  return Array.from(counts.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

// P3 collected-bucket labels. 'unknown' = legacy paid orders with a null method
// (collected money, channel unknown) — kept in the tahsilat base, NOT a comp.
const COLLECTED_METHOD_LABELS: Record<string, string> = {
  iyzico: 'İyzico',
  cash: 'Nakit',
  pos: 'Fiziksel POS',
  unknown: 'Bilinmiyor (eski)',
}

export async function getPaymentBreakdown(restaurantId: string, range = 'week'): Promise<PaymentReport> {
  const empty: PaymentReport = { collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0 }

  // Owner OR a member with 'analytics' (reads order aggregates via the service
  // role — so this app-layer gate, not RLS, is the protection).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return empty

  const { currentStart } = await rangeWindowFor(restaurantId, range)
  const supabase = createServiceClient()

  // P3: read the REAL per-order payment_method — no more İyzico-vs-Manuel
  // inference from order_payment_tokens presence. Paid + non-cancelled in range;
  // comp (İkram) is split out and never enters the collected (tahsilat) base.
  const { data } = await supabase
    .from('orders')
    .select('total, payment_method')
    .eq('restaurant_id', restaurantId)
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')
    .gte('created_at', currentStart.toISOString())
    .is('deleted_at', null)

  const rows = (data ?? []) as Array<{ total: number | null; payment_method: string | null }>

  const collectedGroups: Record<string, { key: string; label: string; amount: number; count: number }> = {
    iyzico: { key: 'iyzico', label: COLLECTED_METHOD_LABELS['iyzico']!, amount: 0, count: 0 },
    cash: { key: 'cash', label: COLLECTED_METHOD_LABELS['cash']!, amount: 0, count: 0 },
    pos: { key: 'pos', label: COLLECTED_METHOD_LABELS['pos']!, amount: 0, count: 0 },
    unknown: { key: 'unknown', label: COLLECTED_METHOD_LABELS['unknown']!, amount: 0, count: 0 },
  }
  const comp = { amount: 0, count: 0 }

  for (const row of rows) {
    const amount = row.total ?? 0
    const method = row.payment_method
    if (method === COMP_METHOD) {
      comp.amount += amount
      comp.count += 1
      continue
    }
    const key = method === 'iyzico' || method === 'cash' || method === 'pos' ? method : 'unknown'
    collectedGroups[key]!.amount += amount
    collectedGroups[key]!.count += 1
  }

  const collectedTotal = Object.values(collectedGroups).reduce((sum, g) => sum + g.amount, 0)
  const collectedCount = Object.values(collectedGroups).reduce((sum, g) => sum + g.count, 0)
  const collected = Object.values(collectedGroups)
    .filter((g) => g.count > 0)
    .map((g) => ({ ...g, pct: collectedTotal > 0 ? Math.round((g.amount / collectedTotal) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount)

  return { collected, comp, collectedTotal, collectedCount }
}

export async function getProductReportData(restaurantId: string, range = 'week'): Promise<ProductReportItem[]> {
  const supabase = await createDashboardServerClient()
  const { currentStart, previousStart } = await rangeWindowFor(restaurantId, range)

  const { data } = await collectedOrdersFilter(
    supabase
      .from('orders')
      .select('items, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', previousStart.toISOString())
      .is('deleted_at', null),
  )

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
  const tz = await getRestaurantTimezone(restaurantId)

  const isHourly = range === 'day'
  const bucketCount = isHourly ? 24 : ({ week: 7, month: 30, quarter: 90, year: 365 } as Record<string, number>)[range] ?? 7

  // Restaurant-local window boundaries (UTC instants).
  const currentStart = isHourly ? startOfRestaurantDay(tz) : startOfDayNDaysAgo(tz, bucketCount - 1)
  const prevStart = isHourly ? startOfDayNDaysAgo(tz, 1) : startOfDayNDaysAgo(tz, 2 * bucketCount - 1)

  const { data } = await collectedOrdersFilter(
    supabase
      .from('orders')
      .select('total, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', prevStart.toISOString())
      .is('deleted_at', null),
  )
  const rows = (data ?? []) as Tables<'orders'>[]

  if (isHourly) {
    const currentMap: Record<number, number> = {}
    const prevMap: Record<number, number> = {}
    for (const row of rows) {
      const map = new Date(row.created_at) >= currentStart ? currentMap : prevMap
      const h = restaurantHour(row.created_at, tz)
      map[h] = (map[h] ?? 0) + (row.total ?? 0)
    }
    return Array.from({ length: 24 }, (_, h) => ({
      date: `${h.toString().padStart(2, '0')}:00`,
      current: currentMap[h] ?? 0,
      prev: prevMap[h] ?? 0,
    }))
  }

  // Daily: row key AND output bucket key now share ONE basis (restaurant-local
  // day) → "today" is never orphaned and the result no longer depends on the
  // server timezone. This is the acute getSalesOverTime bug's fix.
  const currentMap: Record<string, number> = {}
  const prevMap: Record<string, number> = {}
  for (const row of rows) {
    const key = restaurantDayKey(row.created_at, tz)
    const map = new Date(row.created_at) >= currentStart ? currentMap : prevMap
    map[key] = (map[key] ?? 0) + (row.total ?? 0)
  }

  return Array.from({ length: bucketCount }, (_, i) => {
    const daysAgo = bucketCount - 1 - i // i=0 → oldest day … last → today
    const dayStart = startOfDayNDaysAgo(tz, daysAgo)
    const prevDayStart = startOfDayNDaysAgo(tz, daysAgo + bucketCount)
    return {
      date: dayStart.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', timeZone: tz }),
      current: currentMap[restaurantDayKey(dayStart, tz)] ?? 0,
      prev: prevMap[restaurantDayKey(prevDayStart, tz)] ?? 0,
    }
  })
}

export async function getHeatmapData(restaurantId: string): Promise<HeatmapCell[]> {
  const supabase = await createDashboardServerClient()
  const tz = await getRestaurantTimezone(restaurantId)
  const since = startOfDayNDaysAgo(tz, 30)

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
    const day = restaurantWeekday(row.created_at, tz)
    const hour = restaurantHour(row.created_at, tz)
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

export async function getTablesReportData(restaurantId: string, range = 'week'): Promise<TableReportRow[]> {
  const supabase = await createDashboardServerClient()
  const { currentStart } = await rangeWindowFor(restaurantId, range)
  const since = currentStart.toISOString()

  const [tablesRes, ordersRes, closedRes, openRes] = await Promise.all([
    supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('created_at'),
    collectedOrdersFilter(
      supabase
        .from('orders')
        .select('table_id, total, status')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .is('deleted_at', null)
        .not('table_id', 'is', null),
    ),
    // Devir + gerçek oturum süresi: sessions CLOSED in range. NOTE: a true
    // occupancy % needs a business-hours denominator — settings.hours is not
    // reliably populated, so the % is deliberately NOT computed (no fabricated
    // denominator). Dwell/turnover below are fully real.
    supabase
      .from('table_sessions')
      .select('table_id, opened_at, closed_at')
      .eq('restaurant_id', restaurantId)
      .not('closed_at', 'is', null)
      .gte('closed_at', since),
    supabase
      .from('table_sessions')
      .select('table_id')
      .eq('restaurant_id', restaurantId)
      .is('closed_at', null),
  ])

  const tables = (tablesRes.data ?? []) as Tables<'tables'>[]
  const orders = (ordersRes.data ?? []) as Tables<'orders'>[]
  const closedSessions = (closedRes.data ?? []) as Array<{ table_id: string; opened_at: string; closed_at: string }>
  const openTables = new Set(((openRes.data ?? []) as Array<{ table_id: string }>).map((s) => s.table_id))

  type Agg = { revenue: number; orders: number; turnover: number; dwellSum: number }
  const byTable = new Map<string, Agg>()
  const agg = (id: string): Agg => {
    if (!byTable.has(id)) byTable.set(id, { revenue: 0, orders: 0, turnover: 0, dwellSum: 0 })
    return byTable.get(id)!
  }

  for (const order of orders) {
    if (!order.table_id) continue
    const a = agg(order.table_id)
    a.revenue += order.total ?? 0
    a.orders += 1
  }
  for (const s of closedSessions) {
    const mins = (new Date(s.closed_at).getTime() - new Date(s.opened_at).getTime()) / 60_000
    if (!Number.isFinite(mins) || mins < 0) continue
    const a = agg(s.table_id)
    a.turnover += 1
    a.dwellSum += mins
  }

  return tables.map(t => {
    const a = byTable.get(t.id)
    return {
      id: t.id,
      label: t.label,
      revenue: a?.revenue ?? 0,
      orders: a?.orders ?? 0,
      turnover: a?.turnover ?? 0,
      avgDwellMinutes: a && a.turnover > 0 ? Math.round(a.dwellSum / a.turnover) : null,
      openNow: openTables.has(t.id),
    }
  })
}

/* ══════════════════════════════════════════════════════════════════════════
   OPERASYON reports (Wave-1 Phase A) — read-only, range-aware, OWNER-ONLY.
   These are AUDIT reports ("para ve personel kaçağı denetimi"): the staff
   settlement section exposes team emails, per-person cash totals and the
   "yüksek nakit" fraud flag — showing that to the very staff being audited
   defeats the purpose and leaks PII across a privilege boundary. Members with
   'analytics' keep the four business tabs; the Operasyon tab is the owner's.
   Gate lives INSIDE each query (defense in depth: every caller path covered).
   ══════════════════════════════════════════════════════════════════════════ */

// Owner-only gate for the audit reports. Returns false for members (any
// permissions), non-members, cross-tenant callers and anonymous sessions.
async function isOwnerViewer(restaurantId: string): Promise<boolean> {
  const access = await getUserRestaurantAccess(restaurantId)
  return access?.isOwner === true
}

// % change helper: null when there's no prior baseline (>0 now, 0 before) so the
// UI can show "Yeni" instead of a fake +100%; 0 when both are 0.
function pctChange(cur: number, prev: number): number | null {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 1000) / 10
  return cur > 0 ? null : 0
}

// Count timestamps into range buckets (day → 24 hourly; else N daily), current
// window only. Uses the SAME shared restaurant-local helpers as getSalesOverTime
// — one source of truth for day/hour bucketing, not a second (formerly separate,
// server-local) localDateKey implementation.
function bucketCounts(timestamps: string[], range: string, tz: string): Array<{ date: string; count: number }> {
  if (range === 'day') {
    const byHour: Record<number, number> = {}
    for (const t of timestamps) { const h = restaurantHour(t, tz); byHour[h] = (byHour[h] ?? 0) + 1 }
    return Array.from({ length: 24 }, (_, h) => ({ date: `${h.toString().padStart(2, '0')}:00`, count: byHour[h] ?? 0 }))
  }
  const days = ({ week: 7, month: 30, quarter: 90, year: 365 } as Record<string, number>)[range] ?? 7
  const byDay: Record<string, number> = {}
  for (const t of timestamps) { const key = restaurantDayKey(t, tz); byDay[key] = (byDay[key] ?? 0) + 1 }
  return Array.from({ length: days }, (_, i) => {
    const dayStart = startOfDayNDaysAgo(tz, days - 1 - i) // i=0 → oldest … last → today
    return {
      date: dayStart.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', timeZone: tz }),
      count: byDay[restaurantDayKey(dayStart, tz)] ?? 0,
    }
  })
}

// ── 1. İptal raporu ──────────────────────────────────────────────────────────
export interface CancellationReport {
  count: number
  lostAmount: number             // Σ total of cancelled orders (never collected)
  allOrders: number              // denominator = every non-deleted order in window
  rate: number                   // cancelled / all %, current window
  topItems: TopItem[]            // folded from cancelled orders' items JSON
  trend: Array<{ date: string; count: number }>
  deltaCount: number | null      // % vs previous window
  deltaLost: number | null
  deltaRate: number | null       // percentage-POINT delta of the rate
}

export async function getCancellationReport(restaurantId: string, range = 'week'): Promise<CancellationReport> {
  const empty: CancellationReport = { count: 0, lostAmount: 0, allOrders: 0, rate: 0, topItems: [], trend: [], deltaCount: 0, deltaLost: 0, deltaRate: 0 }
  if (!(await isOwnerViewer(restaurantId))) return empty

  const tz = await getRestaurantTimezone(restaurantId)
  const { currentStart, previousStart } = rangeWindow(tz, range)
  const svc = createServiceClient()
  const { data } = await svc
    .from('orders')
    .select('total, status, items, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', previousStart.toISOString())
    .is('deleted_at', null)

  const rows = (data ?? []) as Array<{ total: number | null; status: string; items: unknown; created_at: string }>
  const cur = rows.filter((r) => new Date(r.created_at) >= currentStart)
  const prev = rows.filter((r) => { const d = new Date(r.created_at); return d >= previousStart && d < currentStart })
  const curCancelled = cur.filter((r) => r.status === 'cancelled')
  const prevCancelled = prev.filter((r) => r.status === 'cancelled')

  const count = curCancelled.length
  const lostAmount = sumTotals(curCancelled)
  const allOrders = cur.length
  const rate = allOrders > 0 ? Math.round((count / allOrders) * 1000) / 10 : 0
  const prevAll = prev.length
  const prevRate = prevAll > 0 ? (prevCancelled.length / prevAll) * 100 : 0

  const topItems = Array.from(foldOrderItems(curCancelled).entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    count, lostAmount, allOrders, rate,
    topItems,
    trend: bucketCounts(curCancelled.map((r) => r.created_at), range, tz),
    deltaCount: pctChange(count, prevCancelled.length),
    deltaLost: pctChange(lostAmount, sumTotals(prevCancelled)),
    deltaRate: Math.round((rate - prevRate) * 10) / 10,
  }
}

// ── 2. Anormal kapatma / kaçak ───────────────────────────────────────────────
export interface AbnormalCloseRow {
  sessionId: string
  tableLabel: string
  closedAt: string
  reason: string                 // RAW staff-typed free text (no structured categories exist)
  amount: number                 // unpaid non-cancelled ₺ abandoned in that session
  closedBy: null                 // NOT captured (table_sessions has no closed_by) → UI shows "—"
}
export interface AbnormalCloseReport {
  count: number
  unpaidTotal: number
  rows: AbnormalCloseRow[]
  deltaCount: number | null
  deltaUnpaid: number | null
}

export async function getAbnormalCloseReport(restaurantId: string, range = 'week'): Promise<AbnormalCloseReport> {
  const empty: AbnormalCloseReport = { count: 0, unpaidTotal: 0, rows: [], deltaCount: 0, deltaUnpaid: 0 }
  if (!(await isOwnerViewer(restaurantId))) return empty

  const { currentStart, previousStart } = await rangeWindowFor(restaurantId, range)
  const svc = createServiceClient()

  // Abnormal = close_reason recorded AND not the system 'auto' sweep tag.
  const { data: sessData } = await svc
    .from('table_sessions')
    .select('id, table_id, closed_at, close_reason')
    .eq('restaurant_id', restaurantId)
    .not('close_reason', 'is', null)
    .neq('close_reason', 'auto')
    .not('closed_at', 'is', null)
    .gte('closed_at', previousStart.toISOString())

  const sessions = (sessData ?? []) as Array<{ id: string; table_id: string; closed_at: string; close_reason: string }>
  if (sessions.length === 0) return empty

  const cur = sessions.filter((s) => new Date(s.closed_at) >= currentStart)
  const prev = sessions.filter((s) => { const d = new Date(s.closed_at); return d >= previousStart && d < currentStart })

  // Unpaid money abandoned = Σ total of UNPAID non-cancelled orders in those sessions.
  const unpaidBySession = new Map<string, number>()
  const { data: ordData } = await svc
    .from('orders')
    .select('table_session_id, total')
    .in('table_session_id', sessions.map((s) => s.id))
    .is('paid_at', null)
    .neq('status', 'cancelled')
    .is('deleted_at', null)
  for (const o of (ordData ?? []) as Array<{ table_session_id: string | null; total: number | null }>) {
    if (!o.table_session_id) continue
    unpaidBySession.set(o.table_session_id, (unpaidBySession.get(o.table_session_id) ?? 0) + (o.total ?? 0))
  }

  const labelById = new Map<string, string>()
  const { data: tbls } = await svc
    .from('tables')
    .select('id, label')
    .eq('restaurant_id', restaurantId)
    .in('id', [...new Set(sessions.map((s) => s.table_id))])
  for (const t of (tbls ?? []) as Array<{ id: string; label: string }>) labelById.set(t.id, t.label)

  const rows: AbnormalCloseRow[] = cur
    .map((s) => ({
      sessionId: s.id,
      tableLabel: labelById.get(s.table_id) ?? 'Masa',
      closedAt: s.closed_at,
      reason: s.close_reason,
      amount: unpaidBySession.get(s.id) ?? 0,
      closedBy: null as null,
    }))
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())

  const unpaidTotal = rows.reduce((s, r) => s + r.amount, 0)
  const prevUnpaid = prev.reduce((s, x) => s + (unpaidBySession.get(x.id) ?? 0), 0)

  return {
    count: rows.length,
    unpaidTotal,
    rows,
    deltaCount: pctChange(rows.length, prev.length),
    deltaUnpaid: pctChange(unpaidTotal, prevUnpaid),
  }
}

// ── 3. Personel tahsilat performansı ─────────────────────────────────────────
export interface StaffSettlementRow {
  settledBy: string | null       // user_id, or null for the İyzico system row
  label: string                  // owner/member email, "İyzico (otomatik)", or "Bilinmeyen kullanıcı"
  role: 'owner' | 'member' | 'system' | 'unknown'
  sections: string[] | null      // member's granted sections (permissions); null otherwise
  cash: number
  pos: number
  otherCollected: number         // iyzico + legacy null-method paid (system row)
  compAmount: number             // İkram (₺0 collected)
  compCount: number
  collected: number              // cash + pos + otherCollected
  settledCount: number           // orders THEY SETTLED (not "took")
  highCash: boolean              // cash / (cash + pos) >= 0.8 — skimming audit signal
}
export interface StaffSettlementReport {
  rows: StaffSettlementRow[]
  totalCollected: number
}

export async function getStaffSettlementReport(restaurantId: string, range = 'week'): Promise<StaffSettlementReport> {
  const empty: StaffSettlementReport = { rows: [], totalCollected: 0 }
  // OWNER-ONLY (see block comment above): emails + per-person cash audit + the
  // high-cash flag must never be readable by the audited staff themselves.
  if (!(await isOwnerViewer(restaurantId))) return empty

  const { currentStart } = await rangeWindowFor(restaurantId, range)
  const svc = createServiceClient()
  const { data } = await svc
    .from('orders')
    .select('total, payment_method, settled_by')
    .eq('restaurant_id', restaurantId)
    .not('paid_at', 'is', null)
    .neq('status', 'cancelled')
    .gte('created_at', currentStart.toISOString())
    .is('deleted_at', null)

  const orders = (data ?? []) as Array<{ total: number | null; payment_method: string | null; settled_by: string | null }>

  // Name/permission resolution: owner (restaurants.owner_id) → owner email +
  // "Sahip"; member (restaurant_members.user_id) → email + granted sections;
  // settled_by NULL → İyzico system row; unresolved id → "Bilinmeyen kullanıcı".
  const { data: rest } = await svc.from('restaurants').select('owner_id').eq('id', restaurantId).maybeSingle()
  const ownerId = (rest as { owner_id: string } | null)?.owner_id ?? null
  const members = await listTeamMembers(restaurantId)
  const memberMap = new Map(members.filter((m) => m.userId).map((m) => [m.userId as string, m]))
  let ownerEmail: string | null = null
  if (ownerId) {
    const { data } = await svc.auth.admin.getUserById(ownerId)
    ownerEmail = data.user?.email ?? null
  }

  const SYSTEM = '__system'
  type Agg = { cash: number; pos: number; otherCollected: number; compAmount: number; compCount: number; settledCount: number }
  const bySettler = new Map<string, Agg>()
  for (const o of orders) {
    const key = o.settled_by ?? SYSTEM
    const agg = bySettler.get(key) ?? { cash: 0, pos: 0, otherCollected: 0, compAmount: 0, compCount: 0, settledCount: 0 }
    const amt = o.total ?? 0
    if (o.payment_method === 'cash') agg.cash += amt
    else if (o.payment_method === 'pos') agg.pos += amt
    else if (o.payment_method === COMP_METHOD) { agg.compAmount += amt; agg.compCount += 1 }
    else agg.otherCollected += amt // iyzico or legacy null-method paid
    agg.settledCount += 1
    bySettler.set(key, agg)
  }

  const rows: StaffSettlementRow[] = Array.from(bySettler.entries()).map(([key, agg]) => {
    let label = 'Bilinmeyen kullanıcı'
    let role: StaffSettlementRow['role'] = 'unknown'
    let sections: string[] | null = null
    if (key === SYSTEM) { label = 'İyzico (otomatik)'; role = 'system' }
    else if (key === ownerId) { label = ownerEmail ?? 'Sahip'; role = 'owner' }
    else if (memberMap.has(key)) { const m = memberMap.get(key)!; label = m.email; role = 'member'; sections = m.permissions }
    const cardCash = agg.cash + agg.pos
    return {
      settledBy: key === SYSTEM ? null : key,
      label, role, sections,
      cash: agg.cash, pos: agg.pos, otherCollected: agg.otherCollected,
      compAmount: agg.compAmount, compCount: agg.compCount,
      collected: agg.cash + agg.pos + agg.otherCollected,
      settledCount: agg.settledCount,
      highCash: cardCash > 0 && agg.cash / cardCash >= 0.8,
    }
  }).sort((a, b) => b.collected - a.collected)

  return { rows, totalCollected: rows.reduce((s, r) => s + r.collected, 0) }
}

/* ══════════════════════════════════════════════════════════════════════════
   SADAKAT report (Wave-1 Phase B) — loyalty_transactions aggregates, range-
   scoped. AGGREGATES ONLY (no customer identity/PII), so the regular
   analytics gate applies (owner OR member with 'analytics') — unlike the
   owner-only Operasyon audit tab. İkram ₺ is NOT a ledger row: it is reused
   from getPaymentBreakdown's comp figure (orders.payment_method='comp') and
   merged in by the action layer, so both tabs show the same number.
   ══════════════════════════════════════════════════════════════════════════ */
export interface LoyaltyReport {
  /** Σ delta, type='points', direction='earn' (includes welcome bonuses). */
  pointsIssued: number
  /** Σ |delta|, type='points', direction='redeem'. */
  pointsRedeemed: number
  /** redeemed / issued %, 0 when nothing issued. */
  redeemRate: number
  /** Σ delta, type='points', direction='refund' (cancel refunds return points). */
  pointsRefunded: number
  stampsIssued: number
  stampsRedeemed: number
  stampsRefunded: number
  /** Visit credits (type='visit', direction='earn') — one per member per closed session. */
  visits: number
  welcomeCount: number
  welcomePoints: number
  /** Redemptions grouped by the ledger's RAW reason string (no invented categories). */
  redemptionsByReason: Array<{ reason: string; count: number; points: number; stamps: number }>
  /** İkram (comp) — merged from getPaymentBreakdown by the action; ₺0 collected. */
  comp: { amount: number; count: number }
}

export async function getLoyaltyReport(restaurantId: string, range = 'week'): Promise<LoyaltyReport> {
  const empty: LoyaltyReport = {
    pointsIssued: 0, pointsRedeemed: 0, redeemRate: 0, pointsRefunded: 0,
    stampsIssued: 0, stampsRedeemed: 0, stampsRefunded: 0,
    visits: 0, welcomeCount: 0, welcomePoints: 0,
    redemptionsByReason: [], comp: { amount: 0, count: 0 },
  }
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return empty

  const { currentStart } = await rangeWindowFor(restaurantId, range)
  const svc = createServiceClient()
  const { data } = await svc
    .from('loyalty_transactions')
    .select('type, direction, delta, reason, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', currentStart.toISOString())

  const rows = (data ?? []) as Array<{ type: string; direction: string; delta: number; reason: string }>
  const out = { ...empty, redemptionsByReason: [] as LoyaltyReport['redemptionsByReason'] }
  const byReason = new Map<string, { count: number; points: number; stamps: number }>()

  for (const r of rows) {
    const mag = Math.abs(r.delta ?? 0)
    if (r.type === 'points') {
      if (r.direction === 'earn') {
        out.pointsIssued += mag
        if (r.reason === 'welcome') { out.welcomeCount += 1; out.welcomePoints += mag }
      } else if (r.direction === 'redeem') out.pointsRedeemed += mag
      else if (r.direction === 'refund') out.pointsRefunded += mag
    } else if (r.type === 'stamp') {
      if (r.direction === 'earn') out.stampsIssued += mag
      else if (r.direction === 'redeem') out.stampsRedeemed += mag
      else if (r.direction === 'refund') out.stampsRefunded += mag
    } else if (r.type === 'visit' && r.direction === 'earn') {
      out.visits += mag
    }
    if (r.direction === 'redeem') {
      const key = r.reason || 'redeem'
      const g = byReason.get(key) ?? { count: 0, points: 0, stamps: 0 }
      g.count += 1
      if (r.type === 'points') g.points += mag
      if (r.type === 'stamp') g.stamps += mag
      byReason.set(key, g)
    }
  }

  out.redeemRate = out.pointsIssued > 0
    ? Math.round((out.pointsRedeemed / out.pointsIssued) * 1000) / 10
    : 0
  out.redemptionsByReason = Array.from(byReason.entries())
    .map(([reason, g]) => ({ reason, ...g }))
    .sort((a, b) => b.count - a.count)

  return out
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

export interface PaymentStatus {
  configured: boolean
  /** 'live' | 'sandbox' | null (null when not configured). */
  mode: string | null
}

/**
 * Real İyzico payment status for the Pano system-health panel: does this
 * restaurant have payment credentials configured, and in which mode. Owner-scoped
 * via RLS (payment_credentials is owner-only) — call only for the owner.
 */
export async function getPaymentStatus(restaurantId: string): Promise<PaymentStatus> {
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('payment_credentials')
    .select('mode')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (!data) return { configured: false, mode: null }
  return { configured: true, mode: (data as { mode: string | null }).mode ?? null }
}

export async function getPanoSnapshot(restaurantId: string, isOwner: boolean): Promise<PanoSnapshot> {
  const supabase = await createDashboardServerClient()

  const tz = await getRestaurantTimezone(restaurantId)
  const today = startOfRestaurantDay(tz)
  const yesterday = startOfDayNDaysAgo(tz, 1)
  const heatmapStart = startOfDayNDaysAgo(tz, 30)

  const [
    ordersRes,
    topItemsRes,
    tablesRes,
    sessionsRes,
    paymentRes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, status, session_id, paid_at, payment_method, table_id, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', heatmapStart.toISOString())
      .is('deleted_at', null),
    collectedOrdersFilter(
      supabase
        .from('orders')
        .select('items')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', today.toISOString())
        .is('deleted_at', null),
    ),
    supabase
      .from('tables')
      .select('id, label, deleted_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at'),
    supabase
      .from('table_sessions')
      .select('id, table_id, opened_at')
      .eq('restaurant_id', restaurantId)
      .is('closed_at', null),
    isOwner
      ? supabase
          .from('payment_credentials')
          .select('mode')
          .eq('restaurant_id', restaurantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const orders = (ordersRes.data ?? []) as Array<{
    id: string
    total: number | null
    status: string
    session_id: string | null
    paid_at: string | null
    payment_method: string | null
    table_id: string | null
    created_at: string
  }>
  const todayRows = orders.filter((row) => new Date(row.created_at) >= today)
  const yesterdayRows = orders.filter((row) => {
    const created = new Date(row.created_at)
    return created >= yesterday && created < today
  })
  const todayVolumeRows = todayRows.filter(isOrderVolumeRow)
  const yesterdayVolumeRows = yesterdayRows.filter(isOrderVolumeRow)
  const todayCollectedRows = todayRows.filter(isCollectedOrder)
  const yesterdayCollectedRows = yesterdayRows.filter(isCollectedOrder)

  const revenue = sumTotals(todayCollectedRows)
  const paidOrders = todayCollectedRows.length
  const kpis: DashboardKPIs = {
    ...emptyKpis(),
    revenue,
    revenueYesterday: sumTotals(yesterdayCollectedRows),
    orders: todayVolumeRows.length,
    ordersYesterday: yesterdayVolumeRows.length,
    paidOrders,
    paidOrdersYesterday: yesterdayCollectedRows.length,
    activeOrders: todayVolumeRows.filter((row) => ACTIVE_STATUSES.includes(row.status)).length,
    avgBasket: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
    sessions: new Set(todayVolumeRows.map((row) => row.session_id).filter(Boolean)).size,
    sessionsYesterday: new Set(yesterdayVolumeRows.map((row) => row.session_id).filter(Boolean)).size,
  }

  const byHour: Record<number, number> = {}
  for (let h = 0; h < 24; h++) byHour[h] = 0
  for (const row of todayCollectedRows) {
    const h = restaurantHour(row.created_at, tz)
    byHour[h] = (byHour[h] ?? 0) + (row.total ?? 0)
  }
  const hourlySales: HourlySale[] = Array.from({ length: 24 }, (_, hour) => ({ hour, total: byHour[hour] ?? 0 }))

  const allTables = (tablesRes.data ?? []) as Array<{ id: string; label: string; deleted_at: string | null }>
  const labelByTable = new Map(allTables.map((table) => [table.id, table.label]))
  const initialFeed: ActivityEvent[] = todayVolumeRows
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 7)
    .map((row) => ({
      id: row.id,
      status: row.status,
      total: row.total ?? 0,
      tableId: row.table_id,
      tableLabel: row.table_id ? labelByTable.get(row.table_id) ?? null : null,
      createdAt: row.created_at,
    }))

  const topItems = Array.from(foldOrderItems((topItemsRes.data ?? []) as Array<{ items?: unknown }>).entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const heatGrid: Record<string, number> = {}
  for (const row of orders.filter(isOrderVolumeRow)) {
    const day = restaurantWeekday(row.created_at, tz)
    const hour = restaurantHour(row.created_at, tz)
    const k = `${day}-${hour}`
    heatGrid[k] = (heatGrid[k] ?? 0) + 1
  }
  const heatmap: HeatmapCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 8; hour <= 22; hour++) {
      heatmap.push({ day, hour, count: heatGrid[`${day}-${hour}`] ?? 0 })
    }
  }

  const sessions = (sessionsRes.data ?? []) as Array<{ id: string; table_id: string; opened_at: string }>
  const sessionIds = sessions.map((session) => session.id)
  let sessionOrders: Array<{
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
    sessionOrders = (data ?? []) as typeof sessionOrders
  }

  const ordersBySession = new Map<string, typeof sessionOrders>()
  for (const order of sessionOrders) {
    if (!order.table_session_id) continue
    const list = ordersBySession.get(order.table_session_id) ?? []
    list.push(order)
    ordersBySession.set(order.table_session_id, list)
  }

  const sessionByTable = new Map(sessions.map((session) => [session.table_id, session]))
  const tableStatuses: TableStatusData[] = allTables
    .filter((table) => table.deleted_at === null)
    .map((table) => {
      const session = sessionByTable.get(table.id)
      if (!session) {
        return {
          id: table.id,
          label: table.label,
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

      const activeOrders = (ordersBySession.get(session.id) ?? []).filter((order) => order.status !== 'cancelled')
      if (activeOrders.length === 0) {
        return {
          id: table.id,
          label: table.label,
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
        id: table.id,
        label: table.label,
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

  const paymentData = paymentRes.data as { mode?: string | null } | null
  const paymentStatus = isOwner
    ? paymentData
      ? { configured: true, mode: paymentData.mode ?? null }
      : { configured: false, mode: null }
    : null

  return { kpis, hourlySales, initialFeed, topItems, tableStatuses, heatmap, paymentStatus }
}
