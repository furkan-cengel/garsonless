const ANALYTICS_RANGE_IDS = [
  'day',
  'yesterday',
  'week',
  'month',
  'calendar_month',
  'quarter',
  'year',
  'custom',
] as const

export type AnalyticsRange = typeof ANALYTICS_RANGE_IDS[number]
type AnalyticsOrderSource = 'all' | 'customer' | 'staff'
type AnalyticsPaymentMethod = 'all' | 'cash' | 'pos' | 'iyzico' | 'split' | 'comp' | 'unknown'
type AnalyticsOrderStatus = 'all' | 'pending_approval' | 'pending' | 'preparing' | 'ready' | 'served'

interface AnalyticsFilters {
  source: AnalyticsOrderSource
  paymentMethod: AnalyticsPaymentMethod
  status: AnalyticsOrderStatus
}

export interface AnalyticsQuery {
  range: AnalyticsRange
  from: string | null
  to: string | null
  filters: AnalyticsFilters
}

const DEFAULT_ANALYTICS_QUERY: AnalyticsQuery = {
  range: 'week',
  from: null,
  to: null,
  filters: { source: 'all', paymentMethod: 'all', status: 'all' },
}

const SOURCES = ['all', 'customer', 'staff'] as const
const PAYMENT_METHODS = ['all', 'cash', 'pos', 'iyzico', 'split', 'comp', 'unknown'] as const
const ORDER_STATUSES = ['all', 'pending_approval', 'pending', 'preparing', 'ready', 'served'] as const

function valueOf(input: URLSearchParams | Record<string, unknown>, key: string): unknown {
  return input instanceof URLSearchParams ? input.get(key) : input[key]
}

function isAnalyticsDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
}

export function analyticsCustomDayCount(from: string, to: string): number {
  if (!isAnalyticsDateKey(from) || !isAnalyticsDateKey(to)) return 0
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
}

export function parseAnalyticsQuery(input: URLSearchParams | Record<string, unknown>): AnalyticsQuery {
  const requestedRange = valueOf(input, 'range')
  const range = ANALYTICS_RANGE_IDS.includes(requestedRange as AnalyticsRange)
    ? requestedRange as AnalyticsRange
    : DEFAULT_ANALYTICS_QUERY.range
  const requestedFrom = valueOf(input, 'from')
  const requestedTo = valueOf(input, 'to')
  const from = isAnalyticsDateKey(requestedFrom) ? requestedFrom : null
  const to = isAnalyticsDateKey(requestedTo) ? requestedTo : null
  const sourceValue = valueOf(input, 'source')
  const paymentValue = valueOf(input, 'payment')
  const statusValue = valueOf(input, 'status')
  const source = SOURCES.includes(sourceValue as AnalyticsOrderSource) ? sourceValue as AnalyticsOrderSource : 'all'
  const paymentMethod = PAYMENT_METHODS.includes(paymentValue as AnalyticsPaymentMethod) ? paymentValue as AnalyticsPaymentMethod : 'all'
  const status = ORDER_STATUSES.includes(statusValue as AnalyticsOrderStatus) ? statusValue as AnalyticsOrderStatus : 'all'
  const customDays = from && to ? analyticsCustomDayCount(from, to) : 0

  return {
    range: range === 'custom' && (customDays < 1 || customDays > 366) ? 'week' : range,
    from: range === 'custom' && customDays >= 1 && customDays <= 366 ? from : null,
    to: range === 'custom' && customDays >= 1 && customDays <= 366 ? to : null,
    filters: { source, paymentMethod, status },
  }
}

export function coerceAnalyticsQuery(input: string | AnalyticsQuery): AnalyticsQuery {
  return typeof input === 'string' ? parseAnalyticsQuery({ range: input }) : parseAnalyticsQuery({
    range: input.range,
    from: input.from,
    to: input.to,
    source: input.filters.source,
    payment: input.filters.paymentMethod,
    status: input.filters.status,
  })
}

export function validateAnalyticsQuery(input: unknown): AnalyticsQuery | null {
  if (!input || typeof input !== 'object') return null
  const candidate = input as Partial<AnalyticsQuery>
  if (!ANALYTICS_RANGE_IDS.includes(candidate.range as AnalyticsRange)) return null
  if (!candidate.filters || typeof candidate.filters !== 'object') return null
  if (!SOURCES.includes(candidate.filters.source as AnalyticsOrderSource)) return null
  if (!PAYMENT_METHODS.includes(candidate.filters.paymentMethod as AnalyticsPaymentMethod)) return null
  if (!ORDER_STATUSES.includes(candidate.filters.status as AnalyticsOrderStatus)) return null
  const normalized = coerceAnalyticsQuery(candidate as AnalyticsQuery)
  if (normalized.range !== candidate.range) return null
  if (candidate.range === 'custom' && (!candidate.from || !candidate.to || normalized.from !== candidate.from || normalized.to !== candidate.to)) return null
  return normalized
}

export function analyticsQueryToSearchParams(query: AnalyticsQuery, report?: string): URLSearchParams {
  const params = new URLSearchParams()
  if (report && report !== 'sales') params.set('report', report)
  if (query.range !== DEFAULT_ANALYTICS_QUERY.range) params.set('range', query.range)
  if (query.range === 'custom' && query.from && query.to) {
    params.set('from', query.from)
    params.set('to', query.to)
  }
  if (query.filters.source !== 'all') params.set('source', query.filters.source)
  if (query.filters.paymentMethod !== 'all') params.set('payment', query.filters.paymentMethod)
  if (query.filters.status !== 'all') params.set('status', query.filters.status)
  return params
}

export function analyticsQueryEquals(left: AnalyticsQuery, right: AnalyticsQuery): boolean {
  return left.range === right.range
    && left.from === right.from
    && left.to === right.to
    && left.filters.source === right.filters.source
    && left.filters.paymentMethod === right.filters.paymentMethod
    && left.filters.status === right.filters.status
}

export function hasAnalyticsFilters(query: AnalyticsQuery): boolean {
  return query.filters.source !== 'all' || query.filters.paymentMethod !== 'all' || query.filters.status !== 'all'
}
