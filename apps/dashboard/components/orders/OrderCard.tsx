'use client'

import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { readOrderCustomerTierSnapshot, readOrderLineSnapshots, type OperationalOrderStatus, type OrderLifecycleTarget, type PaymentMethod } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'
import { I, S, Tag } from '../../lib/ui'
import { paymentMethodBadge } from '../../lib/payment-method'
import { formatOrderElapsedMinutes, isLateOrder, isReadyWaitingOrder, orderStageStartedAt, orderStatusGroup } from './order-status'
import { ORDER_SOURCE_LABELS } from './order-filters'

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

// Elapsed-time urgency. No per-order SLA exists in the data model, so we use
// sensible per-stage thresholds (minutes) — ok → warn → late — to flag aging
// orders at a glance, the way a KDS does.
type Urgency = 'ok' | 'warn' | 'late' | 'done'
const URG: Record<Urgency, { bg: string; fg: string }> = {
  ok:   { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  warn: { bg: 'var(--warning-bg)',  fg: 'var(--warning)' },
  late: { bg: 'var(--critical-bg)', fg: 'var(--critical)' },
  done: { bg: 'var(--surface-3)',   fg: 'var(--text-3)' },
}
// prep's late line is the per-restaurant setting (settings.orders.late_threshold_min,
// default 20); warn kicks in at 60% of it. new/ready keep fixed hand-off targets.
function urgencyFor(
  group: 'new' | 'prep' | 'ready' | 'done',
  mins: number,
  lateThresholdMin: number,
): Urgency {
  if (group === 'done') return 'done'
  const t = group === 'prep'
    ? { warn: Math.max(1, Math.ceil(lateThresholdMin * 0.6)), late: lateThresholdMin }
    : { warn: 5, late: 10 }
  if (mins >= t.late) return 'late'
  if (mins >= t.warn) return 'warn'
  return 'ok'
}

/**
 * Per-STAGE aging (P2): the clock starts when the order ENTERED its current
 * stage — prep from sent_to_kitchen_at, serve-wait from ready_at. Pre-migration
 * orders have NULL stamps → graceful fallback to created_at (today's behavior,
 * an approximation — never a fabricated stage time).
 */
function stageStartFor(order: Order, group: 'new' | 'prep' | 'ready' | 'done'): string {
  void group
  return orderStageStartedAt(order)
}

function ElapsedLabel({ startAt, group, lateThresholdMin }: {
  startAt: string
  group: 'new' | 'prep' | 'ready' | 'done'
  lateThresholdMin: number
}) {
  const [mins, setMins] = useState<number | null>(null)

  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(startAt).getTime()) / 60_000)
    setMins(calc())
    const id = setInterval(() => setMins(calc()), 30_000)
    return () => clearInterval(id)
  }, [startAt])

  if (mins === null) return null
  const c = URG[urgencyFor(group, mins, lateThresholdMin)]
  return (
    <span style={{
      background: c.bg, color: c.fg,
      padding: '2px 7px', borderRadius: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: 999, background: c.fg, display: 'inline-block', animation: group !== 'done' ? 'pulse-dot 2s infinite' : 'none' }} />
      {formatOrderElapsedMinutes(mins)}
    </span>
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
}

export type OrderDensity = 'comfortable' | 'compact' | 'dense'

export default function OrderCard({ order, tableLabel, active, onClick, onAdvance, actionPending = false, lateThresholdMin = 20, density = 'comfortable' }: Props) {
  // Terminal orders (served/cancelled) are NOT draggable — no way out of a
  // terminal state (the server matrix rejects it anyway; this removes the affordance).
  const terminal = orderStatusGroup(order.status) === 'done'
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: order.id, disabled: terminal || actionPending })

  const [hov, setHov] = useState(false)

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
  // Stage-based (P2): prep age counts from sent_to_kitchen_at (fallback
  // created_at on pre-migration orders), against the per-restaurant threshold.
  const isLate = isLateOrder(order, lateThresholdMin)
  const isReadyWaiting = isReadyWaitingOrder(order)
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
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="order-card-shell" style={{
        background: 'var(--surface)', borderRadius: 10,
        border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
        boxShadow: active ? '0 0 0 3px rgba(17,17,19,.06)' : hov ? 'var(--shadow-2)' : 'var(--shadow-1)',
        cursor: 'pointer', overflow: 'hidden', position: 'relative',
        opacity: group === 'done' ? 0.75 : 1,
        transition: 'all 120ms',
      }}>
        {/* Status stripe */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent.left }} />

        <button
          type="button"
          data-order-card-open
          className="order-card-open"
          aria-pressed={active}
          aria-label={`${tableLabel ?? 'Kasa'}, ${items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)} adet, ₺${order.total}. Sipariş detayını aç.`}
          onClick={onClick}
          style={{
            width: '100%', display: 'block', padding: contentPadding,
            border: 0, background: 'transparent', color: 'inherit',
            textAlign: 'left', cursor: 'pointer', font: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{tableLabel ?? 'Walk-in'}</span>
                {methodBadge && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em',
                    color: methodBadge.fg, background: methodBadge.bg,
                    padding: '2px 7px', borderRadius: 999, flexShrink: 0,
                    ...(methodBadge.isComp ? { border: `1px dashed ${methodBadge.fg}` } : null),
                  }}>{methodBadge.label}</span>
                )}
                {tier?.priorityService && (
                  <Tag tone="warning">
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: tier.color, display: 'inline-block' }} />
                    Öncelikli · {tier.name}
                  </Tag>
                )}
                {isLate && (
                  <Tag tone="critical">
                    <I.warn size={10} />
                    Gecikme
                  </Tag>
                )}
                {isReadyWaiting && (
                  <Tag tone="warning">
                    <I.clock size={10} />
                    Servis bekliyor
                  </Tag>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, ...S.mono }}>
                <span>#{order.id.slice(0, 6).toUpperCase()}</span>
                {items.length > 0 && <><span>·</span><span>{items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)} adet</span></>}
                <span>·</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{ORDER_SOURCE_LABELS[order.source]}</span>
              </div>
            </div>
            <div style={{ ...S.mono, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>₺{order.total}</div>
          </div>

          {/* Mini items */}
          {items.length > 0 && visibleItemCount > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--divider)' }}>
              {items.slice(0, visibleItemCount).map((it, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--text-2)', padding: '2px 0' }}>
                  <div style={{ display: 'flex' }}><span style={{ ...S.mono, color: 'var(--text-3)', marginRight: 4 }}>{it.quantity}×</span>{it.name}</div>
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

        </button>

        {/* Bottom row stays outside the detail button so the action remains a
            separate, valid interactive target. */}
        <div className="order-card-footer" style={{
          marginTop: density === 'dense' ? 0 : 2,
          padding: footerPadding,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <ElapsedLabel startAt={stageStartFor(order, group)} group={group} lateThresholdMin={lateThresholdMin} />
          {actionLabel && onAdvance && (
            <button
              type="button"
              data-order-card-advance
              data-order-action-tone={group}
              className="order-card-action orders-touch-target"
              disabled={actionPending}
              onClick={(e) => { e.stopPropagation(); onAdvance(order) }}
              style={{
                background: group === 'new' ? 'var(--action)' : group === 'ready' ? 'var(--positive)' : 'transparent',
                color: group === 'new' || group === 'ready' ? '#fff' : 'var(--text-2)',
                border: group === 'prep' ? '1px solid var(--border)' : 'none',
                minHeight: 34, padding: '4px 10px', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: actionPending ? 'wait' : 'pointer',
                opacity: actionPending ? 0.65 : 1,
              }}
            >
              {actionPending ? 'İşleniyor…' : actionLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
