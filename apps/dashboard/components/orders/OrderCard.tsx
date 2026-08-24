'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { readOrderCustomerTierSnapshot, readOrderLineSnapshots, type OperationalOrderStatus, type OrderLifecycleTarget, type PaymentMethod } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'
import { I, S } from '../../lib/ui'
import { paymentMethodBadge } from '../../lib/payment-method'
import { formatOrderElapsedMinutes, projectOrderUrgency, orderStatusGroup } from './order-status'
import { ORDER_SOURCE_LABELS } from './order-filters'
import { formatCurrency } from '../../lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export function nextStatus(s: OperationalOrderStatus): OrderLifecycleTarget | null {
  if (s === 'pending' || s === 'pending_approval') return 'sent_to_kitchen'
  if (s === 'sent_to_kitchen' || s === 'preparing') return 'ready'
  if (s === 'ready') return 'served'
  return null
}

const ACCENT = {
  new:   { left: 'var(--warning)',  pill: 'var(--warning-bg)',  pillFg: 'var(--warning)' },
  prep:  { left: 'var(--info)',     pill: 'var(--info-bg)',     pillFg: 'var(--info)' },
  ready: { left: 'var(--positive)', pill: 'var(--positive-bg)', pillFg: 'var(--positive)' },
  done:  { left: 'transparent',     pill: 'var(--surface-3)',   pillFg: 'var(--text-3)' },
} as const

const ACTION_LABEL: Partial<Record<OperationalOrderStatus, string>> = {
  pending:           'Onayla →',
  pending_approval:  'Onayla →',
  sent_to_kitchen:   'Hazır →',
  preparing:         'Hazır →',
  ready:             'Servis et',
}

const URG = {
  ok:   { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  attention: { bg: 'var(--warning-bg)',  fg: 'var(--warning)' },
  late: { bg: 'var(--critical-bg)', fg: 'var(--critical)' },
  done: { bg: 'var(--surface-3)',   fg: 'var(--text-3)' },
} as const

function ElapsedLabel({ minutes, level, group }: {
  minutes: number
  level: keyof typeof URG
  group: 'new' | 'prep' | 'ready' | 'done'
}) {
  const c = URG[level]
  return (
    <Badge variant="secondary" style={{ background: c.bg, color: c.fg }} className="h-5 rounded-md px-1.5 text-[10px] uppercase tracking-[.03em]">
      <span style={{ width: 4, height: 4, borderRadius: 999, background: c.fg, display: 'inline-block', animation: group !== 'done' ? 'pulse-dot 2s infinite' : 'none' }} />
      {formatOrderElapsedMinutes(minutes)}
    </Badge>
  )
}

interface Props {
  order: Order
  tableLabel?: string
  active?: boolean
  onClick?: () => void
  onAdvance?: (order: Order) => void
  actionPending?: boolean
  /** settings.orders.late_threshold_min (clamped, default 20). */
  lateThresholdMin?: number
  density?: OrderDensity
  now?: number
}

export type OrderDensity = 'comfortable' | 'compact' | 'dense'

function OrderCard({ order, tableLabel, active, onClick, onAdvance, actionPending = false, lateThresholdMin = 20, density = 'comfortable', now = Date.now() }: Props) {
  // Terminal orders (served/cancelled) are NOT draggable — no way out of a
  // terminal state (the server matrix rejects it anyway; this removes the affordance).
  const terminal = orderStatusGroup(order.status) === 'done'
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: order.id, disabled: terminal || actionPending })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const group = orderStatusGroup(order.status)
  const accent = ACCENT[group]
  const items = readOrderLineSnapshots(order.items)
  const actionLabel = ACTION_LABEL[order.status]
  const tier = readOrderCustomerTierSnapshot(order.customer_tier)
  const urgency = projectOrderUrgency(order, lateThresholdMin, now)
  const isLate = urgency.late
  const isReadyWaiting = urgency.readyWaiting
  const contentPadding = density === 'dense' ? '7px 9px' : density === 'compact' ? '8px 10px' : '10px 12px'
  const visibleItemCount = density === 'comfortable' ? 2 : density === 'compact' ? 1 : 0

  // Settled order → show the method badge (İkram = distinct dashed violet, ₺0
  // collected) instead of a generic "ödendi". The method rides the authenticated
  // realtime/SSR payload (anon's column grant never exposes payment_method).
  const isPaid = order.paid_at !== null
  const methodBadge = isPaid
    ? paymentMethodBadge((order.payment_method as PaymentMethod | null | undefined) ?? null)
    : null

  const footerPadding = density === 'dense' ? '0 9px 7px' : density === 'compact' ? '0 10px 8px' : '0 12px 10px'

  return (
    <article
      ref={setNodeRef}
      data-order-card={order.id}
      data-order-status={order.status}
      style={style}
      {...listeners}
      aria-busy={actionPending}
      suppressHydrationWarning
    >
      <Card size="sm" className="order-card-shell gap-0 py-0" style={{
        background: 'var(--surface)', borderRadius: 10,
        border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
        boxShadow: active ? '0 0 0 3px rgba(17,17,19,.06)' : 'var(--shadow-1)',
        cursor: 'pointer', overflow: 'hidden', position: 'relative',
        opacity: group === 'done' ? 0.75 : 1,
        transition: 'all 120ms',
      }}>
        {/* Status stripe */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent.left }} />

        <Button
          type="button"
          variant="ghost"
          data-order-card-open
          className="order-card-open"
          aria-pressed={active}
          aria-label={`${tableLabel ?? 'Kasa'}, ${items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)} adet, ${formatCurrency(order.total)}. Sipariş detayını aç.`}
          onClick={onClick}
          style={{
            width: '100%', display: 'block', padding: contentPadding,
            height: 'auto', border: 0, background: 'transparent', color: 'inherit',
            textAlign: 'left', cursor: 'pointer', font: 'inherit', borderRadius: 0,
            whiteSpace: 'normal', alignItems: 'stretch', justifyContent: 'stretch',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{tableLabel ?? 'Walk-in'}</span>
                {methodBadge && (
                  <Badge className={methodBadge.isComp ? 'border border-dashed' : ''} style={{ color: methodBadge.fg, background: methodBadge.bg }}>{methodBadge.label}</Badge>
                )}
                {tier?.priorityService && (
                  <Badge variant="warning">
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: tier.color, display: 'inline-block' }} />
                    Öncelikli · {tier.name}
                  </Badge>
                )}
                {isLate && (
                  <Badge variant="destructive">
                    <I.warn size={10} />
                    Gecikme
                  </Badge>
                )}
                {isReadyWaiting && (
                  <Badge variant="warning">
                    <I.clock size={10} />
                    Servis bekliyor
                  </Badge>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, ...S.mono }}>
                <span>#{order.id.slice(0, 6).toUpperCase()}</span>
                {items.length > 0 && <><span>·</span><span>{items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)} adet</span></>}
                <span>·</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{ORDER_SOURCE_LABELS[order.source]}</span>
              </div>
            </div>
            <div style={{ ...S.mono, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{formatCurrency(order.total)}</div>
          </div>

          {/* Mini items */}
          {items.length > 0 && visibleItemCount > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--divider)' }}>
              {items.slice(0, visibleItemCount).map((it, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--text-2)', padding: '2px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ ...S.mono, color: 'var(--text-3)' }}>{it.quantity}×</span>{it.name}{it.promotion?.offer === 'freebie' && it.promotion.role === 'reward' && <Badge variant="positive">Hediye</Badge>}</div>
                  {it.productNote && <div style={{ margin: '2px 0 0 17px', color: 'var(--warning)', fontSize: 10.5, fontWeight: 700 }}>Not: {it.productNote}</div>}
                </div>
              ))}
              {items.length > visibleItemCount && (
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                  +{items.length - visibleItemCount} ürün daha
                </div>
              )}
            </div>
          )}

        </Button>

        {/* Bottom row stays outside the detail button so the action remains a
            separate, valid interactive target. */}
        <div className="order-card-footer" style={{
          marginTop: density === 'dense' ? 0 : 2,
          padding: footerPadding,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <ElapsedLabel minutes={urgency.minutes} level={urgency.level} group={group} />
          {actionLabel && onAdvance && (
            <Button
              type="button"
              size="sm"
              variant={group === 'ready' ? 'positive' : group === 'new' ? 'default' : 'outline'}
              data-order-card-advance
              data-order-action-tone={group}
              className="order-card-action orders-touch-target"
              disabled={actionPending}
              aria-label={`${tableLabel ?? 'Kasa'} siparişini ${group === 'new' ? 'onayla ve mutfağa gönder' : group === 'prep' ? 'hazır olarak işaretle' : 'servis edildi olarak işaretle'}`}
              onClick={(e) => { e.stopPropagation(); onAdvance(order) }}
            >
              {actionPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
              {actionPending ? 'İşleniyor…' : actionLabel}
            </Button>
          )}
        </div>
      </Card>
    </article>
  )
}

export default memo(OrderCard)
