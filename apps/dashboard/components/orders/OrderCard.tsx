'use client'

import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { readOrderCustomerTierSnapshot, readOrderLineSnapshots, type OrderStatus, type PaymentMethod, type OrderLineSnapshot } from '@garsonless/db/order-client'
import type { Order } from './useOrdersRealtime'
import { I, S, Tag } from '../../lib/ui'
import { paymentMethodBadge } from '../../lib/payment-method'

export type CartItem = OrderLineSnapshot

function statusGroup(s: OrderStatus): 'new' | 'prep' | 'ready' | 'done' {
  if (s === 'pending' || s === 'pending_approval') return 'new'
  // 'paid' = payment attribute in the status field; kitchen still prepares it
  if (s === 'sent_to_kitchen' || s === 'preparing' || s === 'paid') return 'prep'
  if (s === 'ready') return 'ready'
  return 'done'
}

export function nextStatus(s: OrderStatus): OrderStatus | null {
  if (s === 'pending' || s === 'pending_approval') return 'sent_to_kitchen'
  if (s === 'sent_to_kitchen' || s === 'preparing' || s === 'paid') return 'ready'
  if (s === 'ready') return 'served'
  return null
}

const ACCENT = {
  new:   { left: 'var(--warning)',  pill: 'var(--warning-bg)',  pillFg: 'var(--warning)' },
  prep:  { left: 'var(--info)',     pill: 'var(--info-bg)',     pillFg: 'var(--info)' },
  ready: { left: 'var(--positive)', pill: 'var(--positive-bg)', pillFg: 'var(--positive)' },
  done:  { left: 'transparent',     pill: 'var(--surface-3)',   pillFg: 'var(--text-3)' },
} as const

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending:           'Onayla →',
  pending_approval:  'Onayla →',
  sent_to_kitchen:   'Hazır →',
  preparing:         'Hazır →',
  paid:              'Hazır →',
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
const THRESHOLDS: Record<'new' | 'prep' | 'ready', { warn: number; late: number }> = {
  new:   { warn: 5,  late: 10 },
  prep:  { warn: 12, late: 20 },
  ready: { warn: 5,  late: 10 },
}
function urgencyFor(group: 'new' | 'prep' | 'ready' | 'done', mins: number): Urgency {
  if (group === 'done') return 'done'
  const t = THRESHOLDS[group]
  if (mins >= t.late) return 'late'
  if (mins >= t.warn) return 'warn'
  return 'ok'
}

function ElapsedLabel({ createdAt, group }: { createdAt: string; group: 'new' | 'prep' | 'ready' | 'done' }) {
  const [mins, setMins] = useState<number | null>(null)

  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
    setMins(calc())
    const id = setInterval(() => setMins(calc()), 30_000)
    return () => clearInterval(id)
  }, [createdAt])

  if (mins === null) return null
  const c = URG[urgencyFor(group, mins)]
  return (
    <span style={{
      background: c.bg, color: c.fg,
      padding: '2px 7px', borderRadius: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: 999, background: c.fg, display: 'inline-block', animation: group !== 'done' ? 'pulse-dot 2s infinite' : 'none' }} />
      {mins} dk
    </span>
  )
}

interface Props {
  order: Order
  tableLabel?: string
  active?: boolean
  onClick?: () => void
  onAdvance?: (order: Order) => void
}

export default function OrderCard({ order, tableLabel, active, onClick, onAdvance }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: order.id })

  const [hov, setHov] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const group = statusGroup(order.status as OrderStatus)
  const accent = ACCENT[group]
  const items = readOrderLineSnapshots(order.items)
  const actionLabel = ACTION_LABEL[order.status as OrderStatus]
  const tier = readOrderCustomerTierSnapshot(order.customer_tier)
  const isLate = group === 'prep' &&
    Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000) > 20

  // Settled order → show the method badge (İkram = distinct dashed violet, ₺0
  // collected) instead of a generic "ödendi". The method rides the authenticated
  // realtime/SSR payload (anon's column grant never exposes payment_method).
  const isPaid = order.paid_at !== null || order.status === 'paid'
  const methodBadge = isPaid
    ? paymentMethodBadge((order.payment_method as PaymentMethod | null | undefined) ?? null)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      suppressHydrationWarning
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 10,
        border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
        boxShadow: active ? '0 0 0 3px rgba(17,17,19,.06)' : hov ? 'var(--shadow-2)' : 'var(--shadow-1)',
        cursor: 'pointer', overflow: 'hidden', position: 'relative',
        opacity: group === 'done' ? 0.75 : 1,
        transition: 'all 120ms',
      }}>
        {/* Status stripe */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent.left }} />

        <div style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
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
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, ...S.mono }}>
                <span>#{order.id.slice(0, 6).toUpperCase()}</span>
                {items.length > 0 && <><span>·</span><span>{items.length} ürün</span></>}
              </div>
            </div>
            <div style={{ ...S.mono, fontSize: 14, fontWeight: 700 }}>₺{order.total}</div>
          </div>

          {/* Mini items */}
          {items.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--divider)' }}>
              {items.slice(0, 2).map((it, i) => (
                <div key={i} style={{ display: 'flex', fontSize: 11.5, color: 'var(--text-2)', padding: '2px 0' }}>
                  <span style={{ ...S.mono, color: 'var(--text-3)', marginRight: 4 }}>{it.quantity}×</span>
                  {it.name}
                </div>
              ))}
              {items.length > 2 && (
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                  +{items.length - 2} ürün daha
                </div>
              )}
            </div>
          )}

          {/* Bottom row */}
          <div style={{
            marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--divider)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <ElapsedLabel createdAt={order.created_at} group={group} />
            {actionLabel && onAdvance && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdvance(order) }}
                style={{
                  background: group === 'new' ? 'var(--action)' : group === 'ready' ? 'var(--positive)' : 'transparent',
                  color: group === 'new' || group === 'ready' ? '#fff' : 'var(--text-2)',
                  border: group === 'prep' ? '1px solid var(--border)' : 'none',
                  padding: '4px 10px', borderRadius: 5,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
