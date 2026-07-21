import type { DashboardKPIs, PaymentStatus } from '../../lib/queries/pano'
import type { Section } from '../../lib/auth/access'

export type PanoTrend = 'up' | 'down'

export type PanoKpiCardModel = {
  label: string
  value: string
  delta: string
  trend: PanoTrend
  sub: string
  featured?: boolean
  href: string
}

export type PanoQuickActionKey = 'menu' | 'tables' | 'theme' | 'orders' | 'analytics'

export type PanoQuickAction = {
  key: PanoQuickActionKey
  label: string
  description: string
  href: string
}

export type PanoHealthStatus = 'ok' | 'warn' | 'down' | 'idle'

export type PanoHealthCheck = {
  label: string
  status: PanoHealthStatus
  detail: string
}

export type PanoRealtimeStatus = 'connecting' | 'connected' | 'down'

function percentageChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '—'
  const delta = Math.round(((current - previous) / previous) * 100)
  return delta >= 0 ? `+${delta}%` : `${delta}%`
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

export function getPanoKpiCards(kpis: DashboardKPIs, restaurantId: string): PanoKpiCardModel[] {
  const averageBasketYesterday = kpis.paidOrdersYesterday > 0
    ? Math.round(kpis.revenueYesterday / kpis.paidOrdersYesterday)
    : 0

  const orderDelta = kpis.orders - kpis.ordersYesterday

  return [
    {
      label: 'Tahsil edilen ciro',
      value: formatCurrency(kpis.revenue),
      delta: percentageChange(kpis.revenue, kpis.revenueYesterday),
      trend: kpis.revenue >= kpis.revenueYesterday ? 'up' : 'down',
      sub: `vs. dün ${formatCurrency(kpis.revenueYesterday)}`,
      featured: true,
      href: `/dashboard/${restaurantId}/analytics`,
    },
    {
      label: 'Sipariş hacmi',
      value: String(kpis.orders),
      delta: orderDelta >= 0 ? `+${orderDelta}` : String(orderDelta),
      trend: kpis.orders >= kpis.ordersYesterday ? 'up' : 'down',
      sub: `${kpis.activeOrders} hâlâ aktif`,
      href: `/dashboard/${restaurantId}/orders`,
    },
    {
      label: 'Ort. tahsilat',
      value: formatCurrency(kpis.avgBasket),
      delta: percentageChange(kpis.avgBasket, averageBasketYesterday),
      trend: kpis.avgBasket >= averageBasketYesterday ? 'up' : 'down',
      sub: `${kpis.paidOrders} ödemeli sipariş`,
      href: `/dashboard/${restaurantId}/analytics`,
    },
    {
      label: 'Oturum sayısı',
      value: String(kpis.sessions),
      delta: percentageChange(kpis.sessions, kpis.sessionsYesterday),
      trend: kpis.sessions >= kpis.sessionsYesterday ? 'up' : 'down',
      sub: `dün ${kpis.sessionsYesterday} oturum`,
      href: `/dashboard/${restaurantId}/analytics`,
    },
  ]
}

export function getPanoQuickActions(
  restaurantId: string,
  permissions: Section[],
  isOwner: boolean,
): PanoQuickAction[] {
  const can = (section: Section) => isOwner || permissions.includes(section)
  const actions: Array<PanoQuickAction & { section: Section }> = [
    { key: 'menu', section: 'menu', label: 'Menüyü yönet', description: 'Ürün ve kategorileri aç', href: `/dashboard/${restaurantId}/menu` },
    { key: 'tables', section: 'tables', label: 'QR ekranını aç', description: 'Masa QR kodlarını yönet', href: `/dashboard/${restaurantId}/tables` },
    { key: 'theme', section: 'theme', label: 'Temayı düzenle', description: 'Marka kimliğini yönet', href: `/dashboard/${restaurantId}/theme` },
    { key: 'orders', section: 'orders', label: 'Sipariş panosu', description: 'Canlı sipariş akışı', href: `/dashboard/${restaurantId}/orders` },
    { key: 'analytics', section: 'analytics', label: 'Raporlar', description: 'Satış ve tahsilat analizi', href: `/dashboard/${restaurantId}/analytics` },
  ]

  return actions.filter((action) => can(action.section)).map(({ section: _section, ...action }) => action)
}

export function getPanoHealthChecks({
  paymentStatus,
  isOwner,
  realtime,
  lastOrderAt,
  now = new Date(),
}: {
  paymentStatus: PaymentStatus | null
  isOwner: boolean
  realtime: PanoRealtimeStatus
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

  checks.push(
    realtime === 'connected'
      ? { label: 'Gerçek zamanlı', status: 'ok', detail: 'Canlı bağlantı açık' }
      : realtime === 'down'
        ? { label: 'Gerçek zamanlı', status: 'down', detail: 'Bağlantı yok' }
        : { label: 'Gerçek zamanlı', status: 'idle', detail: 'Bağlanıyor…' },
  )

  if (!lastOrderAt) {
    checks.push({ label: 'Son sipariş', status: 'idle', detail: 'Henüz sipariş yok' })
    return checks
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / 1000))
  const relativeTime = elapsedSeconds < 60
    ? 'az önce'
    : elapsedSeconds < 3600
      ? `${Math.floor(elapsedSeconds / 60)} dk önce`
      : elapsedSeconds < 86400
        ? `${Math.floor(elapsedSeconds / 3600)} sa önce`
        : `${Math.floor(elapsedSeconds / 86400)} gün önce`

  checks.push({
    label: 'Son sipariş',
    status: elapsedSeconds < 86400 ? 'ok' : 'idle',
    detail: relativeTime,
  })

  return checks
}
