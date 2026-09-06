import type { AnalyticsReportId, AnalyticsReportResponse } from '../../lib/actions/analytics'
import type { AnalyticsReportScope } from '../../lib/analytics-report-scope'
import { analyticsQueryEquals, analyticsQueryToSearchParams, type AnalyticsQuery } from '../../lib/analytics-filter-contract'
import { createInitialAnalyticsData, type AnalyticsData, type AnalyticsInitialData, type AnalyticsFreshness } from './analytics-report-model'

interface SnapshotEntry {
  data: AnalyticsData
  generatedAt: string
  scope: AnalyticsReportScope
  stale: boolean
  error: string | null
  retryQuery?: AnalyticsQuery
}
interface ReportView {
  activeReport: AnalyticsReportId
  query: AnalyticsQuery
  analyticsData: AnalyticsData
  generatedAt: string
  scope: AnalyticsReportScope
  freshness: AnalyticsFreshness
  isPending: boolean
  loadError: string | null
  activeReportLoaded: boolean
  canExport: boolean
}
export interface ReportControllerOptions {
  restaurantId: string
  initialData: AnalyticsInitialData
  initialQuery: AnalyticsQuery
  initialReport: AnalyticsReportId
  initialGeneratedAt: string
  initialScope: AnalyticsReportScope
  isOwner: boolean
  hasAdvancedAnalytics: boolean
  fetch: (restaurantId: string, query: AnalyticsQuery, report: AnalyticsReportId, signal: AbortSignal) => Promise<AnalyticsReportResponse>
  navigate: (report: AnalyticsReportId, query: AnalyticsQuery, options: { replace: boolean; resetTable: boolean }) => void
  now?: () => number
}
const REQUIRED_FIELDS: Record<AnalyticsReportId, (keyof AnalyticsData)[]> = {
  sales: ['rangeKpis', 'salesOverTime', 'heatmapData', 'topItems', 'paymentBreakdown', 'liveActiveOrders'],
  payments: ['paymentBreakdown'], items: ['productReport'], tables: ['tableStats'],
  operasyon: ['cancellations', 'abnormalCloses', 'staffSettlement'], sadakat: ['loyalty'],
}

/** Owns transport and immutable report snapshots. React only subscribes to this store. */
export class AnalyticsReportController {
  private entries = new Map<string, SnapshotEntry>()
  private listeners = new Set<() => void>()
  private request: AbortController | null = null
  private sequence = 0
  private invalidation = 0
  private offline = false
  private pending = false
  private report: AnalyticsReportId
  private query: AnalyticsQuery
  private error: string | null = null
  private retryQuery: AnalyticsQuery | null = null
  private view: ReportView
  private readonly baseline: AnalyticsData
  private readonly now: () => number

  constructor(private readonly options: ReportControllerOptions) {
    this.report = this.allowed(options.initialReport)
    this.query = options.initialQuery
    this.now = options.now ?? Date.now
    this.baseline = createInitialAnalyticsData(options.initialData)
    for (const report of ['sales', 'payments'] as const) this.put(report, this.query, {
      data: this.baseline, scope: options.initialScope, generatedAt: options.initialGeneratedAt, stale: false, error: null,
    })
    this.view = this.project()
  }
  private key(report = this.report, query = this.query) {
    return `${this.options.restaurantId}:${analyticsQueryToSearchParams(query, report)}`
  }
  private put(report: AnalyticsReportId, query: AnalyticsQuery, entry: SnapshotEntry) {
    const key = this.key(report, query)
    this.entries.delete(key)
    this.entries.set(key, entry)
    // Bound retained report payloads instead of accumulating every custom date range.
    while (this.entries.size > 18) this.entries.delete(this.entries.keys().next().value!)
  }
  private allowed(report: AnalyticsReportId): AnalyticsReportId {
    if (!Object.hasOwn(REQUIRED_FIELDS, report)) return 'sales'
    if (report === 'operasyon' && !this.options.isOwner) return 'sales'
    if ((report === 'operasyon' || report === 'sadakat') && !this.options.hasAdvancedAnalytics) return 'sales'
    return report
  }
  private project(): ReportView {
    const entry = this.entries.get(this.key())
    return {
      activeReport: this.report, query: this.query,
      analyticsData: entry?.data ?? this.baseline,
      generatedAt: entry?.generatedAt ?? this.options.initialGeneratedAt,
      scope: entry?.scope ?? this.options.initialScope,
      freshness: this.offline ? 'offline' : this.pending ? 'refreshing' : entry?.stale || this.error ? 'stale' : 'fresh',
      isPending: this.pending, loadError: this.error,
      activeReportLoaded: Boolean(entry), canExport: Boolean(entry) && !this.pending,
    }
  }
  private emit() { this.view = this.project(); this.listeners.forEach((listener) => listener()) }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.view
  cancel = () => { ++this.sequence; this.request?.abort(); this.request = null; this.pending = false }
  private sync(replace = false, resetTable = false) { this.options.navigate(this.report, this.query, { replace, resetTable }) }

  start = () => { this.sync(true); this.ensureCurrent() }
  private ensureCurrent() {
    const entry = this.entries.get(this.key())
    if (!entry || entry.stale || this.now() - Date.parse(entry.generatedAt) >= 300_000) void this.load(this.query, true)
  }
  changeReport = (report: AnalyticsReportId, query = this.query, history = false) => {
    this.cancel()
    this.report = this.allowed(report)
    // History changes select an exact scope. Never show a different scope under its URL.
    this.query = query
    const entry = this.entries.get(this.key())
    this.error = entry?.error ?? null
    this.retryQuery = entry?.retryQuery ?? null
    this.sync(history)
    this.emit()
    this.ensureCurrent()
  }
  changeQuery = (query: AnalyticsQuery) => {
    if (analyticsQueryEquals(query, this.query)) return
    void this.load(query, false)
  }
  refresh = () => { void this.load(this.query, true) }
  retry = () => { void this.load(this.retryQuery ?? this.query, false) }
  markStale = () => {
    ++this.invalidation
    for (const [key, entry] of this.entries) this.entries.set(key, { ...entry, stale: true })
    this.emit()
  }
  setOffline = (offline: boolean) => {
    this.offline = offline
    this.markStale()
    if (!offline) this.retry()
  }
  visible = () => { if (!this.pending) this.ensureCurrent() }

  private async load(nextQuery: AnalyticsQuery, replace: boolean) {
    this.cancel()
    const sequence = this.sequence
    const invalidation = this.invalidation
    const report = this.report
    const controller = new AbortController()
    this.request = controller
    this.pending = true
    this.error = null
    this.retryQuery = nextQuery
    this.emit()
    try {
      const response = await this.options.fetch(this.options.restaurantId, nextQuery, report, controller.signal)
      if (sequence !== this.sequence) return
      if (response.error || !response.data || !response.scope || !REQUIRED_FIELDS[report].every((field) => response.data![field] != null)) {
        throw new Error(response.error ?? 'Rapor yanıtı eksik. Tekrar deneyin.')
      }
      const entry: SnapshotEntry = {
        data: { ...this.baseline, ...response.data }, generatedAt: response.generatedAt,
        scope: response.scope, stale: invalidation !== this.invalidation, error: null,
      }
      this.put(report, nextQuery, entry)
      if (report === 'sales') this.put('payments', nextQuery, entry)
      const changed = !analyticsQueryEquals(nextQuery, this.query)
      this.query = nextQuery
      this.retryQuery = null
      this.sync(replace, changed)
    } catch (error) {
      if (sequence !== this.sequence) return
      this.error = this.offline
        ? 'Çevrimdışısınız. Mevcut rapor korunuyor; bağlantı gelince yeniden denenecek.'
        : error instanceof Error && error.message !== 'Failed to fetch' ? error.message
          : 'Rapor sunucusuna ulaşılamadı. Mevcut rapor korundu; tekrar deneyin.'
      const entry = this.entries.get(this.key())
      if (entry) this.put(report, this.query, { ...entry, stale: true, error: this.error, retryQuery: nextQuery })
    } finally {
      if (sequence === this.sequence) { this.pending = false; this.request = null; this.emit() }
    }
  }
}
