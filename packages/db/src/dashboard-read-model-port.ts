import type {
  AnalyticsReadModelPort,
  AnalyticsCancellationAggregate,
  AnalyticsPaymentAggregate,
  DashboardTablePerformanceSource,
  DashboardInsightsReadModelPort,
  OrdersBoardReadModelPort,
  PanoBusinessSource,
  PanoMetricsSource,
  PanoTableDetailReadModelPort,
} from '@garsonless/application/read-models'
import { OPEN_ORDER_STATUSES, err, isServiceRequestType, ok } from '@garsonless/domain'
import { createServiceClient } from './service-client'
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

function parseAnalyticsCancellationAggregate(value: unknown): AnalyticsCancellationAggregate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const current = source['current']
  const previous = source['previous']
  if (!current || typeof current !== 'object' || Array.isArray(current)
      || !previous || typeof previous !== 'object' || Array.isArray(previous)
      || !Array.isArray(source['topItems']) || !Array.isArray(source['trend'])) return null
  const finite = (input: unknown): input is number => typeof input === 'number' && Number.isFinite(input) && input >= 0
  const currentRow = current as Record<string, unknown>
  const previousRow = previous as Record<string, unknown>
  const currentKeys = ['allOrders', 'cancelledCount', 'lostAmount', 'collectedCancelledCount', 'collectedCancelledAmount', 'compCancelledCount', 'compCancelledAmount'] as const
  const previousKeys = ['allOrders', 'cancelledCount', 'lostAmount'] as const
  if (!currentKeys.every((key) => finite(currentRow[key])) || !previousKeys.every((key) => finite(previousRow[key]))) return null
  const topItems = source['topItems'].flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return typeof row['name'] === 'string' && finite(row['count']) && finite(row['revenue'])
      ? [{ name: row['name'], count: row['count'], revenue: row['revenue'] }]
      : []
  })
  const trend = source['trend'].flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return typeof row['day'] === 'string' && finite(row['hour']) && row['hour'] <= 23 && finite(row['count'])
      ? [{ day: row['day'], hour: row['hour'], count: row['count'] }]
      : []
  })
  if (topItems.length !== source['topItems'].length || trend.length !== source['trend'].length) return null
  return {
    current: Object.fromEntries(currentKeys.map((key) => [key, currentRow[key]])) as AnalyticsCancellationAggregate['current'],
    previous: Object.fromEntries(previousKeys.map((key) => [key, previousRow[key]])) as AnalyticsCancellationAggregate['previous'],
    topItems,
    trend,
  }
}

function parseAnalyticsPaymentAggregate(value: unknown): AnalyticsPaymentAggregate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const financials = source['financials']
  const refunds = source['refunds']
  if (!Array.isArray(source['groups']) || !financials || typeof financials !== 'object' || Array.isArray(financials)
      || !refunds || typeof refunds !== 'object' || Array.isArray(refunds)) return null
  const finite = (input: unknown): input is number => typeof input === 'number' && Number.isFinite(input) && input >= 0
  const groups = source['groups'].flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return (row['paymentMethod'] === null || typeof row['paymentMethod'] === 'string')
      && finite(row['amount']) && finite(row['count'])
      ? [{ paymentMethod: row['paymentMethod'] as string | null, amount: row['amount'], count: row['count'] }]
      : []
  })
  const financial = financials as Record<string, unknown>
  const financialKeys = ['grossSales', 'discountTotal', 'netSales', 'vatTotal', 'netOfVatTotal', 'unknownVatGross', 'unattributedAmount'] as const
  if (!financialKeys.every((key) => finite(financial[key]))) return null
  const refund = refunds as Record<string, unknown>
  if (!finite(refund['total']) || !finite(refund['count']) || !finite(refund['fullCount'])
      || !finite(refund['partialCount']) || !Array.isArray(refund['groups'])) return null
  const refundGroups = refund['groups'].flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return (row['paymentMethod'] === 'cash' || row['paymentMethod'] === 'pos' || row['paymentMethod'] === 'iyzico')
      && finite(row['amount']) && finite(row['count'])
      ? [{
          paymentMethod: row['paymentMethod'] as 'cash' | 'pos' | 'iyzico',
          amount: row['amount'],
          count: row['count'],
        }]
      : []
  })
  if (groups.length !== source['groups'].length || refundGroups.length !== refund['groups'].length) return null
  return {
    groups,
    financials: Object.fromEntries(financialKeys.map((key) => [key, financial[key]])) as AnalyticsPaymentAggregate['financials'],
    refunds: {
      total: refund['total'], count: refund['count'], fullCount: refund['fullCount'],
      partialCount: refund['partialCount'], groups: refundGroups,
    },
  }
}

function parseAnalyticsTablePerformance(value: unknown): DashboardTablePerformanceSource | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if (!Array.isArray(source['tables']) || !Array.isArray(source['orders'])
      || !Array.isArray(source['closedSessions']) || !Array.isArray(source['openTableIds'])) return null

  const tables = source['tables'].flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return typeof row['id'] === 'string' && typeof row['label'] === 'string'
      ? [{ id: row['id'], label: row['label'] }]
      : []
  })
  const orders = source['orders'].flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return typeof row['tableId'] === 'string' && typeof row['total'] === 'number'
      && Number.isFinite(row['total']) && typeof row['count'] === 'number' && Number.isFinite(row['count'])
      ? [{ tableId: row['tableId'], total: row['total'], count: row['count'] }]
      : []
  })
  const closedSessions = source['closedSessions'].flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    return typeof row['tableId'] === 'string' && typeof row['turnover'] === 'number'
      && Number.isFinite(row['turnover']) && typeof row['dwellSumMinutes'] === 'number'
      && Number.isFinite(row['dwellSumMinutes'])
      ? [{
          tableId: row['tableId'],
          turnover: row['turnover'],
          dwellSumMinutes: row['dwellSumMinutes'],
        }]
      : []
  })
  const openTableIds = source['openTableIds'].filter((entry): entry is string => typeof entry === 'string')
  if (tables.length !== source['tables'].length || orders.length !== source['orders'].length
      || closedSessions.length !== source['closedSessions'].length
      || openTableIds.length !== source['openTableIds'].length) return null
  return { tables, orders, closedSessions, openTableIds }
}

export function createOrdersBoardReadModelPort(): OrdersBoardReadModelPort<DashboardOrderReadRow> {
  return {
    async readBoard({ restaurantId, since, pageSize = 500 }) {
      const service = createServiceClient()

      const appendPages = async (statuses: readonly string[], updatedSince?: string) => {
        const rows: DashboardOrderReadRow[] = []
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
          if (error) return { rows: null, error: error.message }
          let page: DashboardOrderReadRow[]
          try {
            page = ((data ?? []) as DashboardOrderStorageRow[]).map(normalizeDashboardOrderReadRow)
          } catch {
            return { rows: null, error: 'Sipariş veri sözleşmesi geçersiz' }
          }
          rows.push(...page)
          if (page.length < pageSize) break
        }
        return { rows, error: null }
      }

      // Open work is not a daily report: it must survive midnight. Terminal
      // rows are bounded by their last transition so "Kapanan" remains a
      // restaurant-local daily view.
      const [openResult, terminalResult, tablesResult, credentialResult] = await Promise.all([
        appendPages(OPEN_ORDER_STATUSES),
        appendPages(['served', 'cancelled'], since),
        service.from('tables').select('id, label').eq('restaurant_id', restaurantId).is('deleted_at', null),
        service.from('kitchen_credentials').select('restaurant_id').eq('restaurant_id', restaurantId).maybeSingle(),
      ])
      if (openResult.error || !openResult.rows) return err(`Siparişler yüklenemedi: ${openResult.error}`)
      if (terminalResult.error || !terminalResult.rows) return err(`Kapanan siparişler yüklenemedi: ${terminalResult.error}`)
      const orders = [...openResult.rows, ...terminalResult.rows]
      orders.sort((a, b) => b.created_at.localeCompare(a.created_at))

      const { data: liveTables, error: tablesError } = tablesResult
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

      const { data: credential, error: credentialError } = credentialResult
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
    async readActiveOrderCount({ restaurantId }) {
      const { count, error } = await createServiceClient()
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', [...OPEN_ORDER_STATUSES])
        .is('deleted_at', null)
      return error ? err(error.message) : ok(count ?? 0)
    },

    async readPaymentAggregate({ restaurantId, since, before, filters }) {
      const { data, error } = await createServiceClient().rpc('read_analytics_payment_aggregate', {
        p_restaurant_id: restaurantId,
        p_since: since,
        p_before: before ?? new Date().toISOString(),
        p_source: filters?.source ?? null,
        p_payment_method: filters?.paymentMethod ?? null,
        p_status: filters?.status ?? null,
      })
      if (error) return err(error.message)
      const aggregate = parseAnalyticsPaymentAggregate(data)
      return aggregate ? ok(aggregate) : err('Ödeme aggregate yanıtı doğrulanamadı.')
    },

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

    async readCancellationAggregate({ restaurantId, since, currentStart, before, timezone, filters }) {
      const { data, error } = await createServiceClient().rpc('read_analytics_cancellation_aggregate', {
        p_restaurant_id: restaurantId,
        p_since: since,
        p_current_start: currentStart,
        p_before: before ?? new Date().toISOString(),
        p_timezone: timezone,
        p_source: filters?.source ?? null,
        p_payment_method: filters?.paymentMethod ?? null,
      })
      if (error) return err(error.message)
      const aggregate = parseAnalyticsCancellationAggregate(data)
      return aggregate ? ok(aggregate) : err('İptal aggregate yanıtı doğrulanamadı.')
    },

    async readAbnormalCloseData({ restaurantId, since, before }) {
      const service = createServiceClient()
      const { data, error } = await service.rpc('read_analytics_abnormal_close_aggregate', {
        p_restaurant_id: restaurantId,
        p_since: since,
        p_before: before ?? new Date().toISOString(),
      })
      if (error) return err(error.message)
      if (!data || typeof data !== 'object' || Array.isArray(data)) return err('Anormal kapanış aggregate yanıtı geçersiz.')
      const source = data as Record<string, unknown>
      if (source['overflow'] === true) return err('Anormal kapanış raporu güvenli ayrıntı sınırını aştı.')
      if (!Array.isArray(source['sessions'])) return err('Anormal kapanış aggregate yanıtı geçersiz.')
      const rows = source['sessions'].flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
        const row = entry as Record<string, unknown>
        return typeof row['id'] === 'string' && typeof row['tableId'] === 'string'
          && typeof row['closedAt'] === 'string' && typeof row['closeReason'] === 'string'
          && typeof row['tableLabel'] === 'string' && typeof row['unpaidTotal'] === 'number'
          && Number.isFinite(row['unpaidTotal']) && row['unpaidTotal'] >= 0
          ? [row as {
              id: string; tableId: string; closedAt: string; closeReason: string
              tableLabel: string; unpaidTotal: number
            }]
          : []
      })
      if (rows.length !== source['sessions'].length) return err('Anormal kapanış aggregate yanıtı geçersiz.')
      return ok({
        sessions: rows.map((row) => ({
          id: row.id, tableId: row.tableId, closedAt: row.closedAt, closeReason: row.closeReason,
        })),
        unpaidOrders: rows.map((row) => ({ tableSessionId: row.id, total: row.unpaidTotal })),
        tableLabels: Object.fromEntries(rows.map((row) => [row.tableId, row.tableLabel])),
      })
    },

    async readStaffSettlementData({ restaurantId, since, before, filters }) {
      const service = createServiceClient()
      const [{ data: aggregateData, error: aggregateError }, { data: restaurant, error: restaurantError }] = await Promise.all([
        service.rpc('read_analytics_staff_settlement_aggregate', {
          p_restaurant_id: restaurantId,
          p_since: since,
          p_before: before ?? new Date().toISOString(),
          p_source: filters?.source ?? null,
          p_payment_method: filters?.paymentMethod ?? null,
          p_status: filters?.status ?? null,
        }),
        service.from('restaurants').select('owner_id').eq('id', restaurantId).maybeSingle(),
      ])
      if (aggregateError) return err(aggregateError.message)
      if (restaurantError) return err(restaurantError.message)
      if (!aggregateData || typeof aggregateData !== 'object' || Array.isArray(aggregateData)
          || !Array.isArray((aggregateData as Record<string, unknown>)['groups'])) {
        return err('Personel tahsilat aggregate yanıtı geçersiz.')
      }
      const rawGroups = (aggregateData as Record<string, unknown>)['groups'] as unknown[]
      const groups = rawGroups.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
        const row = entry as Record<string, unknown>
        const keys = ['cash', 'pos', 'otherCollected', 'compAmount', 'compCount', 'settledCount'] as const
        if ((row['settledBy'] !== null && typeof row['settledBy'] !== 'string')
            || !keys.every((key) => typeof row[key] === 'number' && Number.isFinite(row[key]) && row[key] >= 0)) return []
        return [{
          settledBy: row['settledBy'] as string | null,
          cash: row['cash'] as number,
          pos: row['pos'] as number,
          otherCollected: row['otherCollected'] as number,
          compAmount: row['compAmount'] as number,
          compCount: row['compCount'] as number,
          settledCount: row['settledCount'] as number,
        }]
      })
      if (groups.length !== rawGroups.length) return err('Personel tahsilat aggregate yanıtı geçersiz.')

      const ownerId = (restaurant as { owner_id: string } | null)?.owner_id ?? null
      const [members, ownerResult] = await Promise.all([
        listTeamMembers(restaurantId),
        ownerId ? service.auth.admin.getUserById(ownerId) : Promise.resolve(null),
      ])
      if (ownerResult?.error) return err(ownerResult.error.message)

      return ok({
        orders: [],
        groups,
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

/** "2× Latte, Tiramisu +2" from an order's item snapshot. */
function summarizeOrderItems(items: unknown): string {
  const lines = (Array.isArray(items) ? items : []).flatMap((item) => {
    const row = jsonRecord(item)
    const name = typeof row?.['name'] === 'string' ? row['name'].trim() : ''
    const quantity = Number(row?.['quantity'] ?? row?.['qty'] ?? 1)
    return name ? [quantity > 1 ? `${quantity}× ${name}` : name] : []
  })
  return lines.length > 3 ? `${lines.slice(0, 3).join(', ')} +${lines.length - 3}` : lines.join(', ')
}

const isRecord = (value: unknown): value is JsonRecord => jsonRecord(value) !== null

function parsePanoBusiness(value: unknown): PanoBusinessSource | null {
  if (!isRecord(value)) return null
  const record = (key: string) => (isRecord(value[key]) ? value[key] as Record<string, unknown> : {})
  const numbers = (input: unknown, length: number) => {
    const list = Array.isArray(input) ? input.map(numberValue) : []
    return list.length === length ? list : null
  }
  const today = record('today')
  const yesterday = record('yesterday')
  const lastWeekDay = record('lastWeekDay')
  const hourly = record('hourly')
  const period = record('period')
  const food = record('foodCost')
  const hourlyToday = numbers(hourly['today'], 24)
  const hourlyLastWeek = numbers(hourly['lastWeekDay'], 24)
  const days = period['days'] === 30 ? 30 : period['days'] === 7 ? 7 : null
  if (!hourlyToday || !hourlyLastWeek || days === null || !Array.isArray(period['daily'])) return null
  return {
    today: {
      revenue: numberValue(today['revenue']), paidOrders: numberValue(today['paidOrders']), cash: numberValue(today['cash']),
      comp: numberValue(today['comp']), cancelledCount: numberValue(today['cancelledCount']), cancelledTotal: numberValue(today['cancelledTotal']),
    },
    yesterday: {
      revenue: numberValue(yesterday['revenue']), paidOrders: numberValue(yesterday['paidOrders']),
      sameTimeRevenue: numberValue(yesterday['sameTimeRevenue']), sameTimePaidOrders: numberValue(yesterday['sameTimePaidOrders']),
    },
    lastWeekDay: { revenue: numberValue(lastWeekDay['revenue']), sameTimeRevenue: numberValue(lastWeekDay['sameTimeRevenue']) },
    hourly: { today: hourlyToday, lastWeekDay: hourlyLastWeek },
    peakHour: typeof value['peakHour'] === 'number' ? value['peakHour'] : null,
    period: {
      days,
      revenue: numberValue(period['revenue']),
      paidOrders: numberValue(period['paidOrders']),
      previousRevenue: numberValue(period['previousRevenue']),
      previousPaidOrders: numberValue(period['previousPaidOrders']),
      daily: period['daily'].flatMap((row) => (isRecord(row) && typeof row['date'] === 'string'
        ? [{ date: row['date'], current: numberValue(row['current']), previous: numberValue(row['previous']) }]
        : [])),
    },
    lowItems: Array.isArray(value['lowItems'])
      ? value['lowItems'].flatMap((row) => (isRecord(row) && typeof row['name'] === 'string' ? [{ name: row['name'], count: numberValue(row['count']) }] : []))
      : [],
    foodCost: {
      consumption: numberValue(food['consumption']), revenue: numberValue(food['revenue']),
      hasSales: food['hasSales'] === true, missingCost: food['missingCost'] === true,
    },
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
        // The SQL function deliberately accepts null as "no filter"; the
        // generated Supabase type cannot infer nullable function parameters.
        p_source: (filters?.source ?? null) as unknown as string,
        p_payment_method: (filters?.paymentMethod ?? null) as unknown as string,
        p_status: (filters?.status ?? null) as unknown as string,
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
      const { data, error } = await createServiceClient().rpc('read_analytics_table_performance', {
        p_restaurant_id: restaurantId,
        p_since: since,
        p_before: before ?? new Date().toISOString(),
        p_source: filters?.source ?? null,
        p_payment_method: filters?.paymentMethod ?? null,
        p_status: filters?.status ?? null,
      })
      if (error) return err(error.message)
      const source = parseAnalyticsTablePerformance(data)
      return source ? ok(source) : err('Masa performansı aggregate yanıtı doğrulanamadı.')
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

    async readPanoBusiness({ restaurantId, now, timezone, periodDays }) {
      const { data, error } = await createServiceClient().rpc('read_dashboard_pano_business', {
        p_restaurant_id: restaurantId,
        p_now: now,
        p_timezone: timezone,
        p_period_days: periodDays,
      })
      if (error) return err(error.message)
      const business = parsePanoBusiness(data)
      return business ? ok(business) : err('Pano işletme yanıtı doğrulanamadı.')
    },

    async readPanoOperationalSource({ restaurantId, includePaymentStatus }) {
      const service = createServiceClient()
      const [tablesResult, sessionsResult, requestsResult, paymentResult, actionableResult] = await Promise.all([
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
        service.from('orders')
          .select(DASHBOARD_INSIGHTS_PROJECTIONS.panoActionableOrders)
          .eq('restaurant_id', restaurantId)
          .in('status', ['pending', 'pending_approval', 'ready'])
          .is('deleted_at', null)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true })
          .limit(30),
      ])

      const errors: string[] = []
      const record = (label: string, error: { message: string } | null | undefined) => {
        if (error) errors.push(`${label}: ${error.message}`)
      }
      record('Masalar', tablesResult.error)
      record('Açık oturumlar', sessionsResult.error)
      record('Servis istekleri', requestsResult.error)
      record('Ödeme durumu', paymentResult.error)
      record('İşlem bekleyen siparişler', actionableResult.error)

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
          id: string; label: string; deleted_at: string | null; area_label: string | null
        }>).map((row) => ({ id: row.id, label: row.label, deletedAt: row.deleted_at, areaLabel: row.area_label })),
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
        actionableOrders: ((actionableResult.data ?? []) as Array<{
          id: string; status: string; table_id: string | null; created_at: string; ready_at: string | null; items: unknown
        }>).flatMap((row) => (row.status === 'pending' || row.status === 'pending_approval' || row.status === 'ready') ? [{
          id: row.id,
          status: row.status,
          tableId: row.table_id,
          createdAt: row.created_at,
          readyAt: row.ready_at,
          summary: summarizeOrderItems(row.items),
        }] : []),
      })
    },
  }

  return withDashboardInsightsObservability(port, {
    ...observability,
    observer: observability.observer ?? createStructuredDashboardInsightsObserver(),
  })
}
