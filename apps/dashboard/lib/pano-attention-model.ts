import { serviceRequestLabel } from '@garsonless/domain/tables'
import type { PanoMetricsSource, PanoOperationalSource } from '@garsonless/application/read-models'
import type { PaymentStatus, PanoAttentionItem } from './queries/pano'
import type { TableStatusData } from './queries/insights-shared'
import type { PanoLiveStatus } from '../components/pano/pano-live-model'
import { formatPanoCurrency, formatPanoDuration } from './pano-format'

const SEVERITY_RANK: Record<PanoAttentionItem['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

type AttentionInput = {
  restaurantId: string
  generatedAt: string
  pendingOrderCount: number
  recentOrders: PanoMetricsSource['recentOrders']
  tableStatuses: TableStatusData[]
  serviceRequests: PanoOperationalSource['pendingServiceRequests']
  paymentStatus: PaymentStatus | null
}

export function buildPanoAttentionItems(input: AttentionInput): PanoAttentionItem[] {
  const recentPendingOrder = input.recentOrders.find(
    (order) => order.status === 'pending' || order.status === 'pending_approval',
  )
  const orderItems: PanoAttentionItem[] = input.pendingOrderCount > 0
    ? [{
        id: 'orders:pending',
        kind: 'pending_order',
        severity: 'critical',
        title: `${input.pendingOrderCount} sipariş onay bekliyor`,
        detail: recentPendingOrder
          ? `Son sipariş: ${recentPendingOrder.tableLabel ?? 'Paket sipariş'} · ${formatPanoCurrency(recentPendingOrder.total)}`
          : 'Sipariş panosunda işlem sırasına alındı.',
        createdAt: recentPendingOrder?.createdAt ?? input.generatedAt,
        ...(recentPendingOrder?.tableId ? { tableId: recentPendingOrder.tableId } : {}),
        ...(recentPendingOrder ? { orderId: recentPendingOrder.id } : {}),
        actionHref: `/dashboard/${input.restaurantId}/orders`,
      }]
    : []

  const lateTableItems: PanoAttentionItem[] = input.tableStatuses
    .filter((table) => table.status === 'late')
    .map((table) => ({
      id: `table:${table.id}`,
      kind: 'late_table',
      severity: 'critical',
      title: `${table.label} gecikiyor`,
      detail: `${formatPanoDuration(table.time)} · ${formatPanoCurrency(Math.max(0, table.unpaidTotal - table.splitSettledTotal))} açık`,
      createdAt: table.openedAt ?? input.generatedAt,
      tableId: table.id,
      actionHref: `/dashboard/${input.restaurantId}/tables?tableId=${encodeURIComponent(table.id)}`,
    }))

  const staleTableItems: PanoAttentionItem[] = input.tableStatuses
    .filter((table) => table.status === 'stale')
    .map((table) => ({
      id: `stale-table:${table.id}`,
      kind: 'stale_table',
      severity: 'warning',
      title: `${table.label} önceki günden açık`,
      detail: `${formatPanoDuration(table.time)} · ${formatPanoCurrency(Math.max(0, table.unpaidTotal - table.splitSettledTotal))} açık`,
      createdAt: table.openedAt ?? input.generatedAt,
      tableId: table.id,
      actionHref: `/dashboard/${input.restaurantId}/tables?tableId=${encodeURIComponent(table.id)}`,
    }))

  const serviceItems: PanoAttentionItem[] = input.serviceRequests.map((request) => {
    const table = input.tableStatuses.find((candidate) => candidate.id === request.tableId)
    return {
      id: `service:${request.id}`,
      kind: 'service_request',
      severity: 'warning',
      title: serviceRequestLabel(request.requestType),
      detail: table?.label ?? 'Masa',
      createdAt: request.createdAt,
      tableId: request.tableId,
      actionHref: `/dashboard/${input.restaurantId}/tables?tableId=${encodeURIComponent(request.tableId)}`,
    }
  })

  const paymentItems: PanoAttentionItem[] = input.paymentStatus && !input.paymentStatus.configured
    ? [{
        id: 'payment:configuration',
        kind: 'payment_configuration',
        severity: 'warning',
        title: 'Online tahsilat yapılandırılmamış',
        detail: 'Ödeme ayarlarını tamamlayın.',
        createdAt: input.generatedAt,
        actionHref: `/dashboard/${input.restaurantId}/settings`,
      }]
    : []

  return [...orderItems, ...lateTableItems, ...staleTableItems, ...serviceItems, ...paymentItems]
    .sort((left, right) => {
      const severity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]
      return severity || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
    })
}

export function selectVisiblePanoAttentionItems(
  items: PanoAttentionItem[],
  limit = 6,
): PanoAttentionItem[] {
  const selected: PanoAttentionItem[] = []
  const add = (item: PanoAttentionItem | undefined) => {
    if (item && !selected.some((candidate) => candidate.id === item.id)) selected.push(item)
  }

  add(items.find((item) => item.kind === 'connection'))
  add(items.find((item) => item.kind === 'pending_order'))
  add(items.find((item) => item.kind === 'service_request'))
  for (const item of items) add(item)
  return selected.slice(0, limit)
}

export function withPanoConnectionAttention(
  items: PanoAttentionItem[],
  realtime: PanoLiveStatus,
  generatedAt: string,
): PanoAttentionItem[] {
  if (realtime === 'live' || realtime === 'connecting') return items
  const copy = realtime === 'stale'
    ? { severity: 'warning' as const, title: 'Güncelleme gecikti', detail: 'Son başarılı veriler gösteriliyor.' }
    : realtime === 'offline'
      ? { severity: 'critical' as const, title: 'Pano çevrimdışı', detail: 'Bağlantı yeniden kurulana kadar son başarılı veriler gösteriliyor.' }
      : { severity: 'critical' as const, title: 'Pano yenilenemedi', detail: 'Son başarılı veriler korunuyor. Yeniden deneyin.' }
  return [{
    id: 'connection:realtime',
    kind: 'connection',
    ...copy,
    createdAt: generatedAt,
  }, ...items]
}

export function getPanoAttentionTableCount(
  tables: TableStatusData[],
  requests: PanoOperationalSource['pendingServiceRequests'],
): number {
  return selectPanoAttentionTables(tables, requests).length
}

/** The KPI and table list must describe the same set of available tables. */
export function selectPanoAttentionTables(
  tables: TableStatusData[],
  requests: PanoOperationalSource['pendingServiceRequests'],
) {
  const requestsByTable = new Map<string, typeof requests>()
  for (const request of requests) {
    const current = requestsByTable.get(request.tableId) ?? []
    current.push(request)
    requestsByTable.set(request.tableId, current)
  }
  return [...new Map(tables.map((table) => [table.id, table])).values()]
    .filter((table) => table.status === 'late' || table.status === 'stale' || requestsByTable.has(table.id))
    .map((table) => ({ table, requests: requestsByTable.get(table.id) ?? [] }))
    .sort((left, right) => {
      const late = Number(right.table.status === 'late') - Number(left.table.status === 'late')
      const requestCount = right.requests.length - left.requests.length
      const stale = Number(left.table.status === 'stale') - Number(right.table.status === 'stale')
      return requestCount || late || stale || right.table.time - left.table.time || left.table.label.localeCompare(right.table.label, 'tr')
    })
}

const TABLE_ATTENTION_KINDS = new Set<PanoAttentionItem['kind']>(['late_table', 'stale_table', 'service_request'])

/**
 * Table signals (late, stale, service calls) are shown once, in the richer
 * attention-tables list; the queue keeps what is not about a table.
 */
export function partitionPanoAttentionItems(items: PanoAttentionItem[]) {
  return {
    operational: items.filter((item) => item.kind !== 'payment_configuration' && !TABLE_ATTENTION_KINDS.has(item.kind)),
    setup: items.filter((item) => item.kind === 'payment_configuration'),
  }
}
