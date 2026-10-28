import { serviceRequestLabel } from '@garsonless/domain/tables'
import type { PanoActionableOrder, PanoAttentionItem, PanoServiceRequest, TableStatusData } from '../../lib/queries/pano'
import { formatPanoCurrency, formatPanoDuration } from '../../lib/pano-format'

type PanoTaskAction =
  | { kind: 'approve'; orderId: string }
  | { kind: 'serve'; orderId: string }
  | { kind: 'resolve'; requestId: string }
  | { kind: 'open'; href: string }

export type PanoTaskTone = 'late' | 'serve' | 'call' | 'approve' | 'stale'

export interface PanoTask {
  id: string
  group: 'now' | 'soon'
  tone: PanoTaskTone
  title: string
  sub: string
  actionLabel: string
  /** Null when the viewer lacks the section the action needs. */
  action: PanoTaskAction | null
}

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
const tableName = (label: string | null) => label ?? 'Paket / kasa'

/**
 * What the floor must do, most urgent first. "Now" is anything a guest is
 * already waiting on; "soon" can wait a few minutes. Service view hides money.
 */
export function buildPanoTasks(input: {
  restaurantId: string
  now: number
  tables: TableStatusData[]
  serviceRequests: PanoServiceRequest[]
  orders: PanoActionableOrder[]
  /** Attention items that are not about a table or an order, e.g. a lost connection or a low rating. */
  notices: PanoAttentionItem[]
  showMoney: boolean
  can: { orders: boolean; tables: boolean }
}): PanoTask[] {
  const { restaurantId, now, showMoney, can } = input
  const labelOf = (tableId: string) => input.tables.find((table) => table.id === tableId)?.label ?? 'Masa'
  const tableHref = (tableId: string) => `/dashboard/${restaurantId}/tables?tableId=${encodeURIComponent(tableId)}`
  const open = (table: TableStatusData) => Math.max(0, table.unpaidTotal - table.splitSettledTotal)

  const late: PanoTask[] = input.tables.filter((table) => table.status === 'late').map((table) => ({
    id: `late:${table.id}`,
    group: 'now',
    tone: 'late',
    title: `${table.label} · ${formatPanoDuration(table.time)} açık`,
    sub: showMoney && open(table) > 0 ? `${formatPanoCurrency(open(table))} tahsil edilmedi; adisyon süre eşiğini aştı.` : 'Adisyon süre eşiğini aştı.',
    actionLabel: 'Tahsilata geç',
    action: can.tables ? { kind: 'open', href: tableHref(table.id) } : null,
  }))

  const ready: PanoTask[] = input.orders.filter((order) => order.status === 'ready').map((order) => ({
    id: `ready:${order.id}`,
    group: 'now',
    tone: 'serve',
    title: `${tableName(order.tableLabel)} · sipariş hazır`,
    sub: [order.summary, `${formatPanoDuration(minutesSince(order.readyAt ?? order.createdAt, now))}’dır serviste bekliyor`].filter(Boolean).join(' · '),
    actionLabel: 'Servis edildi',
    action: can.orders ? { kind: 'serve', orderId: order.id } : null,
  }))

  const calls: PanoTask[] = input.serviceRequests.map((request) => {
    const waited = minutesSince(request.createdAt, now)
    return {
      id: `call:${request.id}`,
      group: 'now',
      tone: 'call',
      title: `${labelOf(request.tableId)} · ${serviceRequestLabel(request.requestType).toLocaleLowerCase('tr-TR')}`,
      sub: waited < 1 ? 'Şimdi' : `${formatPanoDuration(waited)} önce`,
      actionLabel: 'Tamamla',
      action: can.tables ? { kind: 'resolve', requestId: request.id } : null,
    }
  })

  const approvals: PanoTask[] = input.orders.filter((order) => order.status !== 'ready').map((order) => ({
    id: `approve:${order.id}`,
    group: 'soon',
    tone: 'approve',
    title: `${tableName(order.tableLabel)} · onay bekliyor`,
    sub: [order.summary, `${formatPanoDuration(minutesSince(order.createdAt, now))}`].filter(Boolean).join(' · '),
    actionLabel: 'Onayla',
    action: can.orders ? { kind: 'approve', orderId: order.id } : null,
  }))

  const stale: PanoTask[] = input.tables.filter((table) => table.status === 'stale').map((table) => ({
    id: `stale:${table.id}`,
    group: 'soon',
    tone: 'stale',
    title: `${table.label} · önceki günden açık`,
    sub: showMoney && open(table) > 0 ? `${formatPanoCurrency(open(table))} tahsil edilmedi; gün sonu kapanmamış.` : 'Gün sonu kapanmamış adisyon.',
    actionLabel: 'İncele',
    action: can.tables ? { kind: 'open', href: tableHref(table.id) } : null,
  }))

  const notices: PanoTask[] = input.notices.map((item) => ({
    id: `notice:${item.id}`,
    group: item.severity === 'critical' ? 'now' : 'soon',
    tone: item.severity === 'critical' ? 'late' : 'stale',
    title: item.title,
    sub: item.detail,
    actionLabel: 'İncele',
    action: item.actionHref ? { kind: 'open', href: item.actionHref } : null,
  }))

  return [...late, ...ready, ...calls, ...approvals, ...stale, ...notices]
}

const TABLE_STATES: Array<{ status: TableStatusData['status']; label: string }> = [
  { status: 'late', label: 'Gecikiyor' },
  { status: 'stale', label: 'Dünden açık' },
  { status: 'active', label: 'Açık' },
  { status: 'new', label: 'Yeni' },
  { status: 'paid', label: 'Ödendi' },
  { status: 'empty', label: 'Boş' },
]

/** One pill per table state, in the order a host scans them. */
export function countTableStates(tables: TableStatusData[]) {
  return TABLE_STATES.map((state) => ({ ...state, count: tables.filter((table) => table.status === state.status).length }))
    .filter((state) => state.count > 0 || state.status === 'empty')
}
