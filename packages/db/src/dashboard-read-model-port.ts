import type {
  AnalyticsReadModelPort,
  DashboardInsightsReadModelPort,
  OrdersBoardReadModelPort,
  PanoMetricsSource,
  PanoTableDetailReadModelPort,
} from '@garsonless/application/read-models'
import { OPEN_ORDER_STATUSES, err, isServiceRequestType, ok } from '@garsonless/domain'
import { createServiceClient } from './client'
import { DASHBOARD_INSIGHTS_PROJECTIONS } from './dashboard-read-model-contract'
import {
  createStructuredDashboardInsightsObserver,
  withDashboardInsightsObservability,
  type DashboardInsightsObservabilityOptions,
} from './dashboard-read-model-observability'
import { applyCollectedOrderFilter } from './order-query-spec'
import {
  ANALYTICS_SOURCE_SENTINEL,
  boundedAnalyticsRows,
} from './analytics-source-budget'
import { listTeamMembers } from './team'
import {
  normalizeDashboardOrderReadRow,
  type DashboardOrderReadRow,
  type DashboardOrderStorageRow,
} from './dashboard-order-read-model'
import {
  aggregateOpenTableSessions,
  type OpenSessionOrderRow,
  type OpenSessionRow,
  type OpenSessionShareRow,
} from './table-session-aggregation'

export type { DashboardOrderReadRow } from './dashboard-order-read-model'

const BOARD_ORDER_SELECT = 'id, restaurant_id, table_id, table_session_id, session_id, customer_id, status, source, items, total, discount_breakdown, customer_tier, paid_at, payment_method, created_at, sent_to_kitchen_at, ready_at, served_at, cancel_reason, cancelled_by, settled_by, updated_at'

export function createOrdersBoardReadModelPort(): OrdersBoardReadModelPort<DashboardOrderReadRow> {
  return {
    async readBoard({ restaurantId, since, pageSize = 500 }) {
      const service = createServiceClient()
      const orders: DashboardOrderReadRow[] = []

      const appendPages = async (statuses: readonly string[], updatedSince?: string) => {
        for (let from = 0; ; from += pageSize) {
          let query = service
            .from('orders')
            .select(BOARD_ORDER_SELECT)
            .eq('restaurant_id', restaurantId)
            .in('status', [...statuses])
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
          if (updatedSince) query = query.gte('updated_at', updatedSince)
          const { data, error } = await query.range(from, from + pageSize - 1)
          if (error) return error.message
          let page: DashboardOrderReadRow[]
          try {
            page = ((data ?? []) as DashboardOrderStorageRow[]).map(normalizeDashboardOrderReadRow)
          } catch {
            return 'Sipariş veri sözleşmesi geçersiz'
          }
          orders.push(...page)
          if (page.length < pageSize) break
        }
        return null
      }

      // Open work is not a daily report: it must survive midnight. Terminal
      // rows are bounded by their last transition so "Kapanan" remains a
      // restaurant-local daily view.
      const openError = await appendPages(OPEN_ORDER_STATUSES)
      if (openError) return err(`Siparişler yüklenemedi: ${openError}`)
      const terminalError = await appendPages(['served', 'cancelled'], since)
      if (terminalError) return err(`Kapanan siparişler yüklenemedi: ${terminalError}`)
      orders.sort((a, b) => b.created_at.localeCompare(a.created_at))

      const { data: liveTables, error: tablesError } = await service
        .from('tables')
        .select('id, label')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
      if (tablesError) return err(`Masa etiketleri yüklenemedi: ${tablesError.message}`)

      const tables = (liveTables ?? []) as Array<{ id: string; label: string }>
      const knownIds = new Set(tables.map((table) => table.id))
      const missingIds = [...new Set(orders
        .map((order) => order.table_id)
        .filter((id): id is string => Boolean(id) && !knownIds.has(id as string)))]

      if (missingIds.length > 0) {
        const { data: deletedTables, error: deletedError } = await service
          .from('tables')
          .select('id, label')
          .eq('restaurant_id', restaurantId)
          .in('id', missingIds)
        if (deletedError) return err(`Eski masa etiketleri yüklenemedi: ${deletedError.message}`)
        tables.push(...((deletedTables ?? []) as Array<{ id: string; label: string }>))
      }

      const { data: credential, error: credentialError } = await service
        .from('kitchen_credentials')
        .select('restaurant_id')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (credentialError) return err(`Mutfak erişimi yüklenemedi: ${credentialError.message}`)

      return ok({
        orders,
        tables,
        hasKitchenAccess: credential !== null,
      })
    },
  }
}

export function createPanoTableDetailReadModelPort(): PanoTableDetailReadModelPort {
  return {
    async readTableDetail({ restaurantId, tableId }) {
      const service = createServiceClient()
      const { data: session, error: sessionError } = await service
        .from('table_sessions')
        .select('id, opened_at')
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .is('closed_at', null)
        .maybeSingle()
      if (sessionError) return err(sessionError.message)
      if (!session) return err('Bu masada açık adisyon yok.')

      const { data, error } = await service
        .from('orders')
        .select('id, status, total, paid_at, payment_method, created_at, items')
        .eq('restaurant_id', restaurantId)
        .eq('table_session_id', session.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true })
      if (error) return err(error.message)

      return ok({
        sessionId: session.id,
        openedAt: session.opened_at,
        orders: ((data ?? []) as Array<{
          id: string
          status: string
          total: number | null
          paid_at: string | null
          payment_method: string | null
          created_at: string
          items: unknown
        }>).map((order) => ({
          id: order.id,
          status: order.status,
          total: Number(order.total ?? 0),
          paidAt: order.paid_at,
          paymentMethod: order.payment_method,
          createdAt: order.created_at,
          items: order.items,
        })),
      })
    },
  }
}

export function createAnalyticsReadModelPort(): AnalyticsReadModelPort {
  return {
    async readPaymentOrders({ restaurantId, since, before, filters }) {
      let query = createServiceClient()
        .from('orders')
        .select('total, payment_method, items')
        .eq('restaurant_id', restaurantId)
        .not('paid_at', 'is', null)
        .gte('paid_at', since)
        .is('deleted_at', null)
      if (before) query = query.lt('paid_at', before)
      if (filters?.source) query = query.eq('source', filters.source)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.paymentMethod === 'unknown') query = query.is('payment_method', null)
      else if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
      const { data, error } = await query.limit(ANALYTICS_SOURCE_SENTINEL)
      if (error) return err(error.message)
      const rows = boundedAnalyticsRows((data ?? []) as Array<{
        total: number | null; payment_method: string | null; items: unknown
      }>)
      if (!rows) return err('Ödeme raporu kaynak satır bütçesini aştı.')
      return ok(rows.map((row) => ({
        total: row.total,
        paymentMethod: row.payment_method,
        items: row.items,
      })))
    },

    async readRefunds({ restaurantId, since, before, filters }) {
      if (filters?.paymentMethod && !['cash', 'pos', 'iyzico'].includes(filters.paymentMethod)) return ok([])
      const service = createServiceClient()
      let query = service.from('order_refunds')
        .select('order_id, amount, payment_method, kind, refunded_at')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'succeeded')
        .gte('refunded_at', since)
      if (before) query = query.lt('refunded_at', before)
      if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
      const { data, error } = await query.limit(ANALYTICS_SOURCE_SENTINEL)
      if (error) return err(error.message)
      const rows = boundedAnalyticsRows((data ?? []) as Array<{
        order_id: string; amount: number; payment_method: string; kind: string; refunded_at: string
      }>)
      if (!rows) return err('İade raporu kaynak satır bütçesini aştı.')
      let allowedOrderIds: Set<string> | null = null
      if ((filters?.source || filters?.status) && rows.length > 0) {
        let orderQuery = service.from('orders')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .in('id', [...new Set(rows.map((row) => row.order_id))])
        if (filters.source) orderQuery = orderQuery.eq('source', filters.source)
        if (filters.status) orderQuery = orderQuery.eq('status', filters.status)
        const { data: orderData, error: orderError } = await orderQuery
        if (orderError) return err(orderError.message)
        allowedOrderIds = new Set(((orderData ?? []) as Array<{ id: string }>).map((row) => row.id))
      }
      return ok(rows.flatMap((row) => {
        if ((row.payment_method !== 'cash' && row.payment_method !== 'pos' && row.payment_method !== 'iyzico')
            || (row.kind !== 'full' && row.kind !== 'partial') || !row.refunded_at
            || (allowedOrderIds && !allowedOrderIds.has(row.order_id))) return []
        return [{
          orderId: row.order_id,
          amount: Number(row.amount),
          paymentMethod: row.payment_method,
          kind: row.kind,
          refundedAt: row.refunded_at,
        }]
      }))
    },

    async readCancellationOrders({ restaurantId, since, before, filters }) {
      let query = createServiceClient()
        .from('orders')
        .select('total, status, items, created_at, paid_at, payment_method')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .is('deleted_at', null)
      if (before) query = query.lt('created_at', before)
      if (filters?.source) query = query.eq('source', filters.source)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.paymentMethod === 'unknown') query = query.is('payment_method', null)
      else if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
      const { data, error } = await query.limit(ANALYTICS_SOURCE_SENTINEL)
      if (error) return err(error.message)
      const rows = boundedAnalyticsRows((data ?? []) as Array<{
        total: number | null
        status: string
        items: unknown
        created_at: string
        paid_at: string | null
        payment_method: string | null
      }>)
      if (!rows) return err('İptal raporu kaynak satır bütçesini aştı.')
      return ok(rows.map((row) => ({
        total: row.total,
        status: row.status,
        items: row.items,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        paymentMethod: row.payment_method,
      })))
    },

    async readAbnormalCloseData({ restaurantId, since, before }) {
      const service = createServiceClient()
      let sessionQuery = service
        .from('table_sessions')
        .select('id, table_id, closed_at, close_reason')
        .eq('restaurant_id', restaurantId)
        .not('close_reason', 'is', null)
        .neq('close_reason', 'auto')
        .not('closed_at', 'is', null)
        .gte('closed_at', since)
      if (before) sessionQuery = sessionQuery.lt('closed_at', before)
      const { data: sessionData, error: sessionError } = await sessionQuery.limit(ANALYTICS_SOURCE_SENTINEL)
      if (sessionError) return err(sessionError.message)
      const sessionRows = boundedAnalyticsRows((sessionData ?? []) as Array<{
        id: string; table_id: string; closed_at: string; close_reason: string
      }>)
      if (!sessionRows) return err('Anormal kapanış raporu kaynak satır bütçesini aştı.')
      const sessions = sessionRows.map((row) => ({
        id: row.id,
        tableId: row.table_id,
        closedAt: row.closed_at,
        closeReason: row.close_reason,
      }))
      if (sessions.length === 0) return ok({ sessions: [], unpaidOrders: [], tableLabels: {} })

      const [{ data: orderData, error: orderError }, { data: tableData, error: tableError }] = await Promise.all([
        service.from('orders')
          .select('table_session_id, total')
          .eq('restaurant_id', restaurantId)
          .in('table_session_id', sessions.map((session) => session.id))
          .is('paid_at', null)
          .neq('status', 'cancelled')
          .is('deleted_at', null)
          .limit(ANALYTICS_SOURCE_SENTINEL),
        service.from('tables')
          .select('id, label')
          .eq('restaurant_id', restaurantId)
          .in('id', [...new Set(sessions.map((session) => session.tableId))]),
      ])
      if (orderError) return err(orderError.message)
      if (tableError) return err(tableError.message)
      const unpaidRows = boundedAnalyticsRows((orderData ?? []) as Array<{
        table_session_id: string | null; total: number | null
      }>)
      if (!unpaidRows) return err('Anormal kapanış sipariş bütçesini aştı.')

      return ok({
        sessions,
        unpaidOrders: unpaidRows.map((row) => ({ tableSessionId: row.table_session_id, total: row.total })),
        tableLabels: Object.fromEntries(((tableData ?? []) as Array<{ id: string; label: string }>)
          .map((row) => [row.id, row.label])),
      })
    },

    async readStaffSettlementData({ restaurantId, since, before, filters }) {
      const service = createServiceClient()
      let ordersQuery = service.from('orders')
        .select('total, payment_method, settled_by')
        .eq('restaurant_id', restaurantId)
        .not('paid_at', 'is', null)
        .neq('status', 'cancelled')
        .gte('paid_at', since)
        .is('deleted_at', null)
      if (before) ordersQuery = ordersQuery.lt('paid_at', before)
      if (filters?.source) ordersQuery = ordersQuery.eq('source', filters.source)
      if (filters?.status) ordersQuery = ordersQuery.eq('status', filters.status)
      if (filters?.paymentMethod === 'unknown') ordersQuery = ordersQuery.is('payment_method', null)
      else if (filters?.paymentMethod) ordersQuery = ordersQuery.eq('payment_method', filters.paymentMethod)
      const [{ data: orderData, error: orderError }, { data: restaurant, error: restaurantError }] = await Promise.all([
        ordersQuery.limit(ANALYTICS_SOURCE_SENTINEL),
        service.from('restaurants').select('owner_id').eq('id', restaurantId).maybeSingle(),
      ])
      if (orderError) return err(orderError.message)
      if (restaurantError) return err(restaurantError.message)
      const staffOrderRows = boundedAnalyticsRows((orderData ?? []) as Array<{
        total: number | null; payment_method: string | null; settled_by: string | null
      }>)
      if (!staffOrderRows) return err('Personel tahsilat raporu kaynak satır bütçesini aştı.')

      const ownerId = (restaurant as { owner_id: string } | null)?.owner_id ?? null
      const [members, ownerResult] = await Promise.all([
        listTeamMembers(restaurantId),
        ownerId ? service.auth.admin.getUserById(ownerId) : Promise.resolve(null),
      ])
      if (ownerResult?.error) return err(ownerResult.error.message)

      return ok({
        orders: staffOrderRows.map((row) => ({
          total: row.total,
          paymentMethod: row.payment_method,
          settledBy: row.settled_by,
        })),
        ownerId,
        ownerEmail: ownerResult?.data.user?.email ?? null,
        members: members.map((member) => ({
          userId: member.userId,
          email: member.email,
          permissions: member.permissions,
        })),
      })
    },

    async readLoyaltyRows({ restaurantId, since, before }) {
      let query = createServiceClient()
        .from('loyalty_transactions')
        .select('type, direction, delta, reason, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
      if (before) query = query.lt('created_at', before)
      const { data, error } = await query.limit(ANALYTICS_SOURCE_SENTINEL)
      if (error) return err(error.message)
      const rows = boundedAnalyticsRows((data ?? []) as Array<{
        type: string; direction: string; delta: number; reason: string
      }>)
      if (!rows) return err('Sadakat raporu kaynak satır bütçesini aştı.')
      return ok(rows.map((row) => ({
        type: row.type,
        direction: row.direction,
        delta: row.delta,
        reason: row.reason,
      })))
    },
  }
}

type JsonRecord = Record<string, unknown>

function jsonRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function analyticsPeriod(value: unknown): 'current' | 'previous' | null {
  return value === 'current' || value === 'previous' ? value : null
}

function nonnegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : null
}

function parseStrictArray<T>(value: unknown, parseRow: (row: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  const parsed: T[] = []
  for (const row of value) {
    const item = parseRow(row)
    if (item === null) return null
    parsed.push(item)
  }
  return parsed
}

export function parseAnalyticsCoreMetrics(value: unknown) {
  const source = jsonRecord(value)
  if (!source || source.productOverflow !== false) return null

  const sales = parseStrictArray(source.sales, (value) => {
    const row = jsonRecord(value)
    const period = row ? analyticsPeriod(row.period) : null
    const day = row ? stringValue(row.day) : ''
    const hour = row ? boundedInteger(row.hour, 0, 23) : null
    const total = row ? nonnegativeNumber(row.total) : null
    return row && period && /^\d{4}-\d{2}-\d{2}$/.test(day) && hour !== null && total !== null
      ? { period, day, hour, total }
      : null
  })
  const products = parseStrictArray(source.products, (value) => {
    const row = jsonRecord(value)
    const period = row ? analyticsPeriod(row.period) : null
    const name = row ? stringValue(row.name) : ''
    const count = row ? nonnegativeNumber(row.count) : null
    const revenue = row ? nonnegativeNumber(row.revenue) : null
    return row && period && name.trim() && count !== null && revenue !== null
      ? { period, name, count, revenue }
      : null
  })
  const heatmap = parseStrictArray(source.heatmap, (value) => {
    const row = jsonRecord(value)
    const day = row ? boundedInteger(row.day, 0, 6) : null
    const hour = row ? boundedInteger(row.hour, 0, 23) : null
    const count = row ? boundedInteger(row.count, 0, Number.MAX_SAFE_INTEGER) : null
    return row && day !== null && hour !== null && count !== null
      ? { day, hour, count }
      : null
  })

  const currentOrders = boundedInteger(source.currentOrders, 0, Number.MAX_SAFE_INTEGER)
  const previousOrders = boundedInteger(source.previousOrders, 0, Number.MAX_SAFE_INTEGER)
  const currentSessions = boundedInteger(source.currentSessions, 0, Number.MAX_SAFE_INTEGER)
  const previousSessions = boundedInteger(source.previousSessions, 0, Number.MAX_SAFE_INTEGER)
  const currentRevenue = nonnegativeNumber(source.currentRevenue)
  const previousRevenue = nonnegativeNumber(source.previousRevenue)
  const currentPaidOrders = boundedInteger(source.currentPaidOrders, 0, Number.MAX_SAFE_INTEGER)
  const previousPaidOrders = boundedInteger(source.previousPaidOrders, 0, Number.MAX_SAFE_INTEGER)

  if (sales === null || products === null || heatmap === null
    || currentOrders === null || previousOrders === null
    || currentSessions === null || previousSessions === null
    || currentRevenue === null || previousRevenue === null
    || currentPaidOrders === null || previousPaidOrders === null) return null

  return {
    currentOrders,
    previousOrders,
    currentSessions,
    previousSessions,
    currentRevenue,
    previousRevenue,
    currentPaidOrders,
    previousPaidOrders,
    sales,
    heatmap,
    products,
  }
}

function parsePanoMetrics(value: unknown): PanoMetricsSource | null {
  const source = jsonRecord(value)
  if (!source) return null

  return {
    revenue: numberValue(source.revenue),
    revenueYesterday: numberValue(source.revenueYesterday),
    orders: numberValue(source.orders),
    ordersYesterday: numberValue(source.ordersYesterday),
    paidOrders: numberValue(source.paidOrders),
    paidOrdersYesterday: numberValue(source.paidOrdersYesterday),
    activeOrders: numberValue(source.activeOrders),
    pendingOrders: numberValue(source.pendingOrders),
    preparingOrders: numberValue(source.preparingOrders),
    sessions: numberValue(source.sessions),
    sessionsYesterday: numberValue(source.sessionsYesterday),
    hourlySales: arrayValue(source.hourlySales).flatMap((value) => {
      const row = jsonRecord(value)
      return row ? [{ hour: numberValue(row.hour), total: numberValue(row.total) }] : []
    }),
    recentOrders: arrayValue(source.recentOrders).flatMap((value) => {
      const row = jsonRecord(value)
      const id = row ? stringValue(row.id) : ''
      const createdAt = row ? stringValue(row.createdAt) : ''
      if (!row || !id || !createdAt) return []
      return [{
        id,
        status: stringValue(row.status),
        total: numberValue(row.total),
        tableId: nullableStringValue(row.tableId),
        tableLabel: nullableStringValue(row.tableLabel),
        createdAt,
      }]
    }),
    topItems: arrayValue(source.topItems).flatMap((value) => {
      const row = jsonRecord(value)
      const name = row ? stringValue(row.name) : ''
      return row && name
        ? [{ name, count: numberValue(row.count), revenue: numberValue(row.revenue) }]
        : []
    }),
    heatmap: arrayValue(source.heatmap).flatMap((value) => {
      const row = jsonRecord(value)
      return row
        ? [{ day: numberValue(row.day), hour: numberValue(row.hour), count: numberValue(row.count) }]
        : []
    }),
  }
}

export function createDashboardInsightsReadModelPort(
  observability: DashboardInsightsObservabilityOptions = {},
): DashboardInsightsReadModelPort {
  const port: DashboardInsightsReadModelPort = {
    async readAnalyticsCoreMetrics({ restaurantId, since, currentStart, before, timezone, filters }) {
      const { data, error } = await createServiceClient().rpc('read_analytics_core_metrics', {
        p_restaurant_id: restaurantId,
        p_since: since,
        p_current_start: currentStart,
        p_before: before,
        p_timezone: timezone,
        p_source: filters?.source ?? null,
        p_payment_method: filters?.paymentMethod ?? null,
        p_status: filters?.status ?? null,
      })
      if (error) return err(error.message)
      const metrics = parseAnalyticsCoreMetrics(data)
      return metrics
        ? ok(metrics)
        : err('Analytics aggregate yanıtı doğrulanamadı veya ürün boyutu bütçeyi aştı.')
    },
    async readOrderVolume({ restaurantId, since, before, limit, excludeCancelled, filters }) {
      let query = createServiceClient()
        .from('orders')
        .select(DASHBOARD_INSIGHTS_PROJECTIONS.orderVolume)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (before) query = query.lt('created_at', before)
      if (excludeCancelled) query = query.neq('status', 'cancelled')
      if (filters?.source) query = query.eq('source', filters.source)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.paymentMethod === 'unknown') query = query.is('payment_method', null)
      else if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
      query = query.limit(limit ? Math.min(limit, ANALYTICS_SOURCE_SENTINEL) : ANALYTICS_SOURCE_SENTINEL)
      const { data, error } = await query
      if (error) return err(error.message)
      const rows = (data ?? []) as Array<{
        id: string
        total: number | null
        status: string
        session_id: string | null
        table_id: string | null
        created_at: string
      }>
      if (!limit && !boundedAnalyticsRows(rows)) return err('Sipariş hacmi kaynak satır bütçesini aştı.')
      return ok(rows.map((row) => ({
        id: row.id,
        total: Number(row.total ?? 0),
        status: row.status,
        sessionId: row.session_id,
        tableId: row.table_id,
        createdAt: row.created_at,
      })))
    },

    async readCollectedOrders({ restaurantId, since, before, filters }) {
      let query = applyCollectedOrderFilter(
        createServiceClient()
          .from('orders')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.collectedOrders)
          .eq('restaurant_id', restaurantId)
          .gte('paid_at', since)
          .is('deleted_at', null),
      )
      if (before) query = query.lt('paid_at', before)
      if (filters?.source) query = query.eq('source', filters.source)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.paymentMethod === 'unknown') query = query.is('payment_method', null)
      else if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
      const { data, error } = await query.limit(ANALYTICS_SOURCE_SENTINEL)
      if (error) return err(error.message)
      const rows = boundedAnalyticsRows((data ?? []) as Array<{
        total: number | null
        paid_at: string
        payment_method: string | null
        created_at: string
        table_id: string | null
        items: unknown
      }>)
      if (!rows) return err('Tahsilat raporu kaynak satır bütçesini aştı.')
      return ok(rows.map((row) => ({
        total: Number(row.total ?? 0),
        paidAt: row.paid_at,
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
        tableId: row.table_id,
        items: row.items,
      })))
    },

    async readTableRefs({ restaurantId, includeDeleted = false }) {
      let query = createServiceClient()
        .from('tables')
        .select(DASHBOARD_INSIGHTS_PROJECTIONS.tableRefs)
        .eq('restaurant_id', restaurantId)
        .order('created_at')
      if (!includeDeleted) query = query.is('deleted_at', null)
      const { data, error } = await query
      if (error) return err(error.message)
      return ok(((data ?? []) as Array<{
        id: string; label: string; deleted_at: string | null
      }>).map((row) => ({ id: row.id, label: row.label, deletedAt: row.deleted_at })))
    },

    async readTablePerformance({ restaurantId, since, before, filters }) {
      const service = createServiceClient()
      let ordersQuery = applyCollectedOrderFilter(
        service.from('orders')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.tablePerformanceOrders)
          .eq('restaurant_id', restaurantId)
          .gte('paid_at', since)
          .is('deleted_at', null)
          .not('table_id', 'is', null),
      )
      if (filters?.source) ordersQuery = ordersQuery.eq('source', filters.source)
      if (filters?.status) ordersQuery = ordersQuery.eq('status', filters.status)
      if (filters?.paymentMethod === 'unknown') ordersQuery = ordersQuery.is('payment_method', null)
      else if (filters?.paymentMethod) ordersQuery = ordersQuery.eq('payment_method', filters.paymentMethod)
      let closedSessionsQuery = service.from('table_sessions')
        .select(DASHBOARD_INSIGHTS_PROJECTIONS.tablePerformanceClosedSessions)
        .eq('restaurant_id', restaurantId)
        .not('closed_at', 'is', null)
        .gte('closed_at', since)
      if (before) {
        ordersQuery = ordersQuery.lt('paid_at', before)
        closedSessionsQuery = closedSessionsQuery.lt('closed_at', before)
      }
      const [tablesResult, ordersResult, closedResult, openResult] = await Promise.all([
        service.from('tables')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.tablePerformanceTables)
          .eq('restaurant_id', restaurantId)
          .is('deleted_at', null)
          .order('created_at'),
        ordersQuery.limit(ANALYTICS_SOURCE_SENTINEL),
        closedSessionsQuery.limit(ANALYTICS_SOURCE_SENTINEL),
        service.from('table_sessions')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.tablePerformanceOpenSessions)
          .eq('restaurant_id', restaurantId)
          .is('closed_at', null),
      ])
      const error = tablesResult.error ?? ordersResult.error ?? closedResult.error ?? openResult.error
      if (error) return err(error.message)
      const performanceOrders = boundedAnalyticsRows((ordersResult.data ?? []) as Array<{
        table_id: string | null; total: number | null
      }>)
      const performanceSessions = boundedAnalyticsRows((closedResult.data ?? []) as Array<{
        table_id: string; opened_at: string; closed_at: string
      }>)
      if (!performanceOrders || !performanceSessions) {
        return err('Masa performansı kaynak satır bütçesini aştı.')
      }
      return ok({
        tables: ((tablesResult.data ?? []) as Array<{ id: string; label: string }>),
        orders: performanceOrders
          .filter((row): row is { table_id: string; total: number | null } => row.table_id !== null)
          .map((row) => ({ tableId: row.table_id, total: Number(row.total ?? 0) })),
        closedSessions: performanceSessions
          .map((row) => ({ tableId: row.table_id, openedAt: row.opened_at, closedAt: row.closed_at })),
        openTableIds: ((openResult.data ?? []) as Array<{ table_id: string }>).map((row) => row.table_id),
      })
    },

    async readPanoMetrics({ restaurantId, todayStart, yesterdayStart, heatmapStart, timezone }) {
      const { data, error } = await createServiceClient().rpc('read_dashboard_pano_metrics', {
        p_restaurant_id: restaurantId,
        p_today_start: todayStart,
        p_yesterday_start: yesterdayStart,
        p_heatmap_start: heatmapStart,
        p_timezone: timezone,
      })
      if (error) return err(error.message)
      const metrics = parsePanoMetrics(data)
      return metrics ? ok(metrics) : err('Pano metrik yanıtı doğrulanamadı.')
    },

    async readPanoOperationalSource({ restaurantId, includePaymentStatus }) {
      const service = createServiceClient()
      const [tablesResult, sessionsResult, requestsResult, paymentResult] = await Promise.all([
        service.from('tables')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.panoTables)
          .eq('restaurant_id', restaurantId)
          .order('created_at'),
        service.from('table_sessions')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.panoOpenSessions)
          .eq('restaurant_id', restaurantId)
          .is('closed_at', null),
        service.from('service_requests')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.panoOpenServiceRequests)
          .eq('restaurant_id', restaurantId)
          .eq('status', 'pending')
          .is('resolved_at', null)
          .order('created_at', { ascending: true }),
        includePaymentStatus
          ? service.from('payment_credential_status')
            .select(DASHBOARD_INSIGHTS_PROJECTIONS.panoPaymentStatus)
            .eq('restaurant_id', restaurantId)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const errors: string[] = []
      const record = (label: string, error: { message: string } | null | undefined) => {
        if (error) errors.push(`${label}: ${error.message}`)
      }
      record('Masalar', tablesResult.error)
      record('Açık oturumlar', sessionsResult.error)
      record('Servis istekleri', requestsResult.error)
      record('Ödeme durumu', paymentResult.error)

      const openSessions = (sessionsResult.data ?? []) as OpenSessionRow[]
      let openTableSessions = aggregateOpenTableSessions(openSessions, [], [])
      if (openSessions.length > 0) {
        const sessionIds = openSessions.map((session) => session.id)
        const [ordersResult, sharesResult] = await Promise.all([
          service.from('orders')
            .select(DASHBOARD_INSIGHTS_PROJECTIONS.panoOpenSessionOrders)
            .eq('restaurant_id', restaurantId)
            .in('table_session_id', sessionIds)
            .is('deleted_at', null),
          service.from('payment_shares')
            .select(DASHBOARD_INSIGHTS_PROJECTIONS.panoOpenSessionShares)
            .eq('restaurant_id', restaurantId)
            .in('table_session_id', sessionIds)
            .neq('status', 'void'),
        ])
        record('Açık oturum siparişleri', ordersResult.error)
        record('Ödeme payları', sharesResult.error)
        openTableSessions = aggregateOpenTableSessions(
          openSessions,
          (ordersResult.data ?? []) as OpenSessionOrderRow[],
          (sharesResult.data ?? []) as OpenSessionShareRow[],
        )
      }

      const payment = paymentResult.data as { mode?: string | null } | null
      return ok({
        errors,
        tables: ((tablesResult.data ?? []) as Array<{
          id: string; label: string; deleted_at: string | null
        }>).map((row) => ({ id: row.id, label: row.label, deletedAt: row.deleted_at })),
        openTableSessions,
        pendingServiceRequests: ((requestsResult.data ?? []) as Array<{
          id: string; table_id: string; created_at: string; request_type: string
        }>).flatMap((row) => isServiceRequestType(row.request_type) ? [{
          id: row.id,
          tableId: row.table_id,
          createdAt: row.created_at,
          requestType: row.request_type,
        }] : []),
        paymentMode: payment?.mode ?? null,
        paymentConfigured: includePaymentStatus && payment !== null,
      })
    },
  }

  return withDashboardInsightsObservability(port, {
    ...observability,
    observer: observability.observer ?? createStructuredDashboardInsightsObserver(),
  })
}
