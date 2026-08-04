import type { OperationalOrderStatus, OrderLifecycleTarget, PaymentMethod } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'

export const OPERATIONAL_STATUS_LABELS: Record<OperationalOrderStatus, string> = {
  pending: 'Onay bekliyor',
  pending_approval: 'Onay bekliyor',
  sent_to_kitchen: 'Mutfağa gönderildi',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  served: 'Servis edildi',
  cancelled: 'İptal edildi',
}

const LIFECYCLE_TARGET_LABELS: Record<OrderLifecycleTarget, string> = {
  sent_to_kitchen: 'mutfağa gönderildi',
  preparing: 'hazırlanmaya başladı',
  ready: 'hazır olarak işaretlendi',
  served: 'servis edildi',
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  iyzico: 'İyzico',
  cash: 'Nakit',
  pos: 'Fiziksel POS',
  comp: 'İkram',
  split: 'Hesap bölüşme',
}

export type OrderOperationalEvent = {
  id: 'created' | 'sent_to_kitchen' | 'ready' | 'served' | 'cancelled'
  label: string
  at: string | null
  current: boolean
}

export function orderAdvanceLabel(status: OperationalOrderStatus): string | null {
  if (status === 'pending' || status === 'pending_approval') return 'Onayla & mutfağa gönder'
  if (status === 'sent_to_kitchen' || status === 'preparing') return 'Hazır olarak işaretle'
  if (status === 'ready') return 'Servis edildi olarak işaretle'
  return null
}

export function orderActionSuccessMessage(tableLabel: string, target: OrderLifecycleTarget): string {
  return `${tableLabel} siparişi ${LIFECYCLE_TARGET_LABELS[target]}.`
}

export function orderPaymentLabel(order: Pick<Order, 'paid_at' | 'payment_method'>): string {
  if (order.paid_at === null) return 'Henüz tahsil edilmedi'
  const method = order.payment_method
  return method && method in PAYMENT_METHOD_LABELS
    ? PAYMENT_METHOD_LABELS[method as PaymentMethod]
    : 'Ödendi · yöntem bilinmiyor'
}

export function buildOrderOperationalEvents(order: Pick<Order,
  'status' | 'created_at' | 'sent_to_kitchen_at' | 'ready_at' | 'served_at' | 'updated_at'
>): OrderOperationalEvent[] {
  const events: OrderOperationalEvent[] = [
    { id: 'created', label: 'Sipariş alındı', at: order.created_at, current: order.status === 'pending' || order.status === 'pending_approval' },
    { id: 'sent_to_kitchen', label: 'Mutfağa gönderildi', at: order.sent_to_kitchen_at ?? null, current: order.status === 'sent_to_kitchen' || order.status === 'preparing' },
    { id: 'ready', label: 'Hazırlandı', at: order.ready_at ?? null, current: order.status === 'ready' },
    { id: 'served', label: 'Servis edildi', at: order.served_at ?? null, current: order.status === 'served' },
  ]
  if (order.status === 'cancelled') {
    events.push({ id: 'cancelled', label: 'Sipariş iptal edildi', at: order.updated_at ?? null, current: true })
  }
  return events
}

export type OrderFinancialRow = {
  id: 'stamp' | 'catalog' | 'member' | 'points' | 'coupon' | 'service' | 'tax'
  label: string
  amount: number
  kind: 'discount' | 'charge'
}

export function readOrderFinancialBreakdown(
  value: unknown,
  total: number,
): { subtotal: number; rows: OrderFinancialRow[] } {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const amount = (key: string) => {
    const current = source[key]
    return typeof current === 'number' && Number.isFinite(current) && current > 0 ? current : 0
  }
  const memberPct = amount('memberDiscountPct')
  const candidates: OrderFinancialRow[] = [
    { id: 'stamp', label: 'Damga ödülü', amount: amount('stampDiscountAmount'), kind: 'discount' },
    { id: 'catalog', label: 'Katalog ödülü', amount: amount('catalogDiscountAmount'), kind: 'discount' },
    { id: 'member', label: `Üye indirimi${memberPct ? ` (%${memberPct})` : ''}`, amount: amount('memberDiscountAmount'), kind: 'discount' },
    { id: 'points', label: 'Puan indirimi', amount: amount('pointsDiscountAmount'), kind: 'discount' },
    { id: 'coupon', label: 'Kupon indirimi', amount: amount('couponDiscountAmount'), kind: 'discount' },
    { id: 'service', label: 'Servis bedeli', amount: amount('serviceFeeAmount'), kind: 'charge' },
    { id: 'tax', label: 'Vergi', amount: amount('taxAmount'), kind: 'charge' },
  ]
  return {
    subtotal: amount('subtotal') || total,
    rows: candidates.filter((row) => row.amount > 0),
  }
}
