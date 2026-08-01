import type {
  DashboardKPIs,
  PaymentStatus,
  PanoOrderSummary,
  PanoServiceRequest,
  TableStatusData,
} from '../../lib/queries/pano'
import type { PanoLiveStatus } from './pano-live-model'

type PanoTrend = 'up' | 'down'
type PanoIndicatorTone = 'positive' | 'warning' | 'critical' | 'neutral'

export type PanoKpiCardModel = {
  label: string
  value: string
  delta: string
  trend?: PanoTrend
  indicatorTone?: PanoIndicatorTone
  sub: string
  featured?: boolean
  href?: string
}

export type PanoHealthStatus = 'ok' | 'warn' | 'down' | 'idle'

export type PanoHealthCheck = {
  label: string
  status: PanoHealthStatus
  detail: string
}

export type PanoRealtimeStatus = PanoLiveStatus

function relativeTime(value: string | Date, now: Date): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000))
  return elapsedSeconds < 60
    ? 'az önce'
    : elapsedSeconds < 3600
      ? `${Math.floor(elapsedSeconds / 60)} dk önce`
      : elapsedSeconds < 86400
        ? `${Math.floor(elapsedSeconds / 3600)} sa önce`
        : `${Math.floor(elapsedSeconds / 86400)} gün önce`
}

function percentageChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'Yeni' : 'Değişmedi'
  if (current === previous) return 'Değişmedi'
  const delta = Math.round(((current - previous) / previous) * 100)
  return delta >= 0 ? `+${delta}%` : `${Math.abs(delta)}%`
}

function formatCurrency(value: number): string {
  return `₺${value.toLocaleString('tr-TR')}`
}

export function getPanoGreeting(timezone: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now))

  return hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
}

export function getPanoKpiCards(
  kpis: DashboardKPIs,
  restaurantId: string,
  operational: {
    orderSummary: PanoOrderSummary
    tables: TableStatusData[]
    serviceRequests: PanoServiceRequest[]
    canAnalytics: boolean
    canOrders: boolean
    canTables: boolean
  },
): PanoKpiCardModel[] {
  const openTables = operational.tables.filter((table) => (
    table.sessionId !== null && Math.max(0, table.unpaidTotal - table.splitSettledTotal) > 0
  ))
  const openAccount = openTables.reduce(
    (sum, table) => sum + Math.max(0, table.unpaidTotal - table.splitSettledTotal),
    0,
  )
  const lateTableIds = operational.tables
    .filter((table) => table.status === 'late')
    .map((table) => table.id)
  const attentionTableCount = new Set([
    ...lateTableIds,
    ...operational.serviceRequests.map((request) => request.tableId),
  ]).size

  return [
    {
      label: 'Tahsil edilen ciro',
      value: formatCurrency(kpis.revenue),
      delta: percentageChange(kpis.revenue, kpis.revenueYesterday),
      trend: kpis.revenue >= kpis.revenueYesterday ? 'up' : 'down',
      sub: `vs. dün ${formatCurrency(kpis.revenueYesterday)}`,
      featured: true,
      href: operational.canAnalytics ? `/dashboard/${restaurantId}/analytics` : undefined,
    },
    {
      label: 'Açık hesap',
      value: formatCurrency(openAccount),
      delta: `${openTables.length} masa`,
      indicatorTone: openAccount > 0 ? 'warning' : 'neutral',
      sub: 'Tahsil edilmemiş kalan tutar',
      href: operational.canTables ? `/dashboard/${restaurantId}/tables` : undefined,
    },
    {
      label: 'Bekleyen sipariş',
      value: String(operational.orderSummary.pending),
      delta: `${operational.orderSummary.preparing} hazırlanıyor`,
      indicatorTone: operational.orderSummary.pending > 0 ? 'critical' : 'positive',
      sub: 'Onay veya mutfak başlangıcı bekliyor',
      href: operational.canOrders ? `/dashboard/${restaurantId}/orders` : undefined,
    },
    {
      label: 'Dikkat gereken masa',
      value: String(attentionTableCount),
      delta: `${lateTableIds.length} geciken`,
      indicatorTone: attentionTableCount > 0 ? 'critical' : 'positive',
      sub: `${operational.serviceRequests.length} açık servis isteği`,
      href: '#pano-attention',
    },
  ]
}

export function getPanoHealthChecks({
  paymentStatus,
  isOwner,
  realtime,
  updatedAt,
  lastOrderAt,
  now = new Date(),
}: {
  paymentStatus: PaymentStatus | null
  isOwner: boolean
  realtime: PanoRealtimeStatus
  updatedAt: Date
  lastOrderAt: string | null
  now?: Date
}): PanoHealthCheck[] {
  const checks: PanoHealthCheck[] = []

  if (isOwner && paymentStatus) {
    checks.push(
      !paymentStatus.configured
        ? { label: 'İyzico ödeme', status: 'down', detail: 'Yapılandırılmamış' }
        : paymentStatus.mode === 'live'
          ? { label: 'İyzico ödeme', status: 'ok', detail: 'Canlı · bağlı' }
          : { label: 'İyzico ödeme', status: 'warn', detail: 'Test modu (sandbox)' },
    )
  }

  const lastSync = `son başarılı ${relativeTime(updatedAt, now)}`
  checks.push(
    realtime === 'live'
      ? { label: 'Canlı veri', status: 'ok', detail: `Bağlı · ${lastSync}` }
      : realtime === 'stale'
        ? { label: 'Canlı veri', status: 'warn', detail: `Güncelleme gecikti · ${lastSync}` }
        : realtime === 'offline'
          ? { label: 'Canlı veri', status: 'down', detail: `Çevrimdışı · ${lastSync}` }
          : realtime === 'error'
            ? { label: 'Canlı veri', status: 'down', detail: `Yenileme başarısız · ${lastSync}` }
            : { label: 'Canlı veri', status: 'idle', detail: `Bağlanıyor · ${lastSync}` },
  )

  if (!lastOrderAt) {
    checks.push({ label: 'Son sipariş', status: 'idle', detail: 'Henüz sipariş yok' })
    return checks
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / 1000))

  checks.push({
    label: 'Son sipariş',
    status: elapsedSeconds < 86400 ? 'ok' : 'idle',
    detail: relativeTime(lastOrderAt, now),
  })

  return checks
}
