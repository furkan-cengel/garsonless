'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { readOrderCustomerTierSnapshot, readOrderLineSnapshots, isCollectedOrderRow, ALLERGEN_LABELS, type OrderStatus } from '@garsonless/db/order-client'
import { useOrdersRealtime } from './useOrdersRealtime'
import type { Order } from './useOrdersRealtime'
import type { NotificationPrefs } from '../../lib/notification-prefs'
import OrderColumn from './OrderColumn'
import { nextStatus } from './OrderCard'
import OrderToast from './OrderToast'
import { useNotificationSW } from './useNotificationSW'
import { updateOrderStatus, cancelOrder } from '../../lib/actions/orders'
import { formatCurrency } from '../../lib/utils'
import PageTopBar from '../layout/PageTopBar'
import { I, S, Tag, IconButton, btnPrimary, btnGhost } from '../../lib/ui'
import HistoryModal from './HistoryModal'
import ReceiptModal, { type ReceiptOrder } from './ReceiptModal'

/* ============================================================
   COLUMN DEFINITIONS
   ============================================================ */
interface ColumnDef {
  id: string
  label: string
  desc: string
  statuses: OrderStatus[]
  targetStatus: OrderStatus
  tone: 'warning' | 'info' | 'positive' | 'neutral'
}

const COLUMNS: ColumnDef[] = [
  { id: 'new',   label: 'Yeni',         desc: 'Onay bekliyor', statuses: ['pending', 'pending_approval'],          targetStatus: 'sent_to_kitchen', tone: 'warning' },
  // 'paid' is a payment attribute living in status for now — kitchen still has to prepare it
  { id: 'prep',  label: 'Hazırlanıyor', desc: 'Mutfak / Bar',  statuses: ['sent_to_kitchen', 'preparing', 'paid'], targetStatus: 'ready',           tone: 'info' },
  { id: 'ready', label: 'Hazır',        desc: 'Servise hazır', statuses: ['ready'],                                targetStatus: 'served',          tone: 'positive' },
  { id: 'done',  label: 'Tamamlandı',   desc: 'Bugün',         statuses: ['served', 'cancelled'],                  targetStatus: 'served',          tone: 'neutral' },
]

/* ============================================================
   STATUS TIMELINE
   ============================================================ */
function timelineTime(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function StatusTimeline({ order }: { order: Order }) {
  const status = order.status as OrderStatus
  // Real per-stage times (P2 trigger stamps). NULL (pre-migration order or a
  // stage not reached) → no time under the step — never a fabricated value.
  const steps = [
    { id: ['pending', 'pending_approval'],          label: 'Alındı',       at: timelineTime(order.created_at) },
    { id: ['sent_to_kitchen', 'preparing', 'paid'], label: 'Hazırlanıyor', at: timelineTime(order.sent_to_kitchen_at as string | null | undefined) },
    { id: ['ready'],                                label: 'Hazır',        at: timelineTime(order.ready_at as string | null | undefined) },
    { id: ['served'],                               label: 'Servis',       at: timelineTime(order.served_at as string | null | undefined) },
  ]
  const currentIdx = steps.findIndex(s => (s.id as string[]).includes(status))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 16, height: 16, borderRadius: 999, flexShrink: 0,
              border: `1.5px solid ${i <= currentIdx ? 'var(--text)' : 'var(--border-strong)'}`,
              background: i < currentIdx ? 'var(--text)' : i === currentIdx ? 'var(--surface)' : 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i < currentIdx
                ? <I.check size={8} strokeWidth={3} color="#fff" />
                : i === currentIdx
                ? <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--text)', display: 'inline-block' }} />
                : null}
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 500, color: i <= currentIdx ? 'var(--text)' : 'var(--text-4)', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ fontSize: 9, color: 'var(--text-4)', fontVariantNumeric: 'tabular-nums', height: 11 }}>{s.at ?? ''}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 1.5, background: i < currentIdx ? 'var(--text)' : 'var(--border-strong)', marginTop: 7, marginLeft: 2, marginRight: 2 }} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   ORDER DETAIL PANEL
   ============================================================ */
function OrderDetailPanel({
  order,
  tableLabel,
  onClose,
  onAdvance,
  onCancel,
  onReceipt,
}: {
  order: Order | null
  tableLabel: string
  onClose: () => void
  onAdvance: (order: Order) => void
  onCancel: (order: Order) => void
  onReceipt: (order: Order) => void
}) {
  if (!order) {
    return (
      <div style={{
        width: 'var(--props)', flexShrink: 0,
        borderLeft: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', color: 'var(--text-3)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: 'var(--surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', marginBottom: 14,
        }}><I.clipboard size={24} /></div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Bir sipariş seç</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 240 }}>
          Detaylar ve ödeme bilgisi için kanban'dan bir kart aç.
        </div>
      </div>
    )
  }

  const items = readOrderLineSnapshots(order.items)
  const nextSt = nextStatus(order.status as OrderStatus)
  const tier = readOrderCustomerTierSnapshot(order.customer_tier)
  const advanceLabel =
    order.status === 'pending' || order.status === 'pending_approval' ? 'Onayla & başlat' :
    order.status === 'sent_to_kitchen' || order.status === 'preparing' || order.status === 'paid' ? 'Hazır olarak işaretle' :
    order.status === 'ready' ? 'Servis edildi' : null

  return (
    <div style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>{tableLabel}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', ...S.mono }}>#{order.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton icon={<I.copy size={15} />} ariaLabel="Kopyala" onClick={() => void navigator.clipboard?.writeText(order.id)} />
            <IconButton icon={<I.close size={15} />} ariaLabel="Kapat" onClick={onClose} />
          </div>
        </div>
        <StatusTimeline order={order} />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Items */}
        {items.length > 0 && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Sipariş içeriği · {items.length} kalem</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'var(--surface-3)', color: 'var(--text)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{it.quantity}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>
                        {it.modifiers.map(m => `${m.optionName}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`).join(', ')}
                      </div>
                    )}
                    {it.removedIngredients.length > 0 && (
                      <div style={{ fontSize: 10.5, color: 'var(--critical)', fontWeight: 700, marginTop: 2 }}>
                        ÇIKAR: {it.removedIngredients.map((ingredient) => ingredient.name).join(', ')}
                      </div>
                    )}
                    {it.allergens.length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600, marginTop: 2 }}>
                        ALERJEN: {it.allergens.map((code) => ALLERGEN_LABELS[code]).join(', ')}
                      </div>
                    )}
                  </div>
                  {it.price !== undefined && (
                    <span style={{ ...S.mono, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      {formatCurrency(it.quantity * (it.price + it.modifiersPriceDelta))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Hesap özeti</div>
          <SummaryRow label="Ara toplam" value={formatCurrency(order.total)} />
          <div style={{ height: 1, background: 'var(--divider)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Toplam</span>
            <span style={{ ...S.mono, fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>

        {/* Status */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Durum</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag tone={
              order.status === 'pending' || order.status === 'pending_approval' ? 'warning' :
              order.status === 'sent_to_kitchen' || order.status === 'preparing' ? 'info' :
              order.status === 'ready' ? 'positive' : 'neutral'
            }>
              {order.status === 'pending' || order.status === 'pending_approval' ? 'Yeni' :
               order.status === 'sent_to_kitchen' || order.status === 'preparing' ? 'Hazırlanıyor' :
               order.status === 'ready' ? 'Hazır' :
               order.status === 'served' ? 'Servis edildi' :
               order.status === 'paid' ? 'Ödendi' : 'İptal'}
            </Tag>
            {(order.paid_at !== null || order.status === 'paid') && (
              <Tag tone="positive">ÖDENDİ</Tag>
            )}
            {tier?.priorityService && (
              <Tag tone="warning">
                <span style={{ width: 6, height: 6, borderRadius: 999, background: tier.color, display: 'inline-block' }} />
                Öncelikli · {tier.name}
              </Tag>
            )}
            <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>
              {new Date(order.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Footer — cancel rules by payment state: İyzico-paid is BLOCKED in-app
          (manual refund in the İyzico panel); cash/pos-paid requires a recorded
          reason (modal); unpaid cancels normally. */}
      <div style={{
        borderTop: '1px solid var(--divider)', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-2)',
      }}>
        {order.paid_at !== null && order.payment_method === 'iyzico' && order.status !== 'served' && order.status !== 'cancelled' && (
          <div style={{
            fontSize: 11.5, color: 'var(--info)', background: 'var(--info-bg)',
            borderRadius: 8, padding: '8px 10px', lineHeight: 1.45,
          }}>
            Bu sipariş online ödendi — iptal/iade İyzico panelinden manuel yapılır.
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {order.status === 'served' || order.status === 'paid' ? (
            <button
              type="button"
              onClick={() => onReceipt(order)}
              style={{ ...btnPrimary(), flex: 1, justifyContent: 'center' }}
            >
              <I.history size={14} />Fiş yazdır
            </button>
          ) : order.status === 'cancelled' ? (
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-3)', padding: '7px 0' }}>
              Bu sipariş iptal edildi
              {typeof order.cancel_reason === 'string' && order.cancel_reason && (
                <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--text-4)' }}>Gerekçe: {order.cancel_reason}</span>
              )}
            </div>
          ) : (
            <>
              {!(order.paid_at !== null && order.payment_method === 'iyzico') && (
                <button
                  type="button"
                  onClick={() => onCancel(order)}
                  style={{ ...btnGhost(), flex: 1, justifyContent: 'center' }}
                >
                  İptal et
                </button>
              )}
              {advanceLabel && nextSt && (
                <button
                  type="button"
                  onClick={() => onAdvance(order)}
                  style={{ ...btnPrimary(), flex: 2, justifyContent: 'center' }}
                >
                  <I.check size={13} />{advanceLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ ...S.mono, fontSize: 12.5 }}>{value}</span>
    </div>
  )
}

/* ============================================================
   LEFT NAV
   ============================================================ */
type FilterId = 'all' | 'active' | 'done' | 'cancelled'

function OrdersNav({ filter, setFilter, orders, search, setSearch, onHistory }: {
  filter: FilterId
  setFilter: (f: FilterId) => void
  orders: Order[]
  search: string
  setSearch: (s: string) => void
  onHistory: () => void
}) {
  const counts = {
    all:       orders.length,
    active:    orders.filter(o => ['pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready'].includes(o.status)).length,
    done:      orders.filter(o => o.status === 'served' || o.status === 'paid').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }

  const filters: { id: FilterId; label: string; icon: React.ReactNode }[] = [
    { id: 'all',       label: 'Tümü',      icon: <I.clipboard size={15} /> },
    { id: 'active',    label: 'Aktif',     icon: <I.bell size={15} /> },
    { id: 'done',      label: 'Tamamlandı',icon: <I.check size={15} /> },
    { id: 'cancelled', label: 'İptal',     icon: <I.close size={15} /> },
  ]

  return (
    <div style={{
      width: 'var(--nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Sipariş Akışı</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
          Tüm istasyonlar · {counts.active} aktif
        </div>
      </div>
      <div style={{ padding: '8px 12px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 30,
          padding: '0 10px', background: 'var(--surface-3)', borderRadius: 7,
          color: 'var(--text-3)',
        }}>
          <I.search size={13} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sipariş #, masa..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5 }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px' }}>
        <div style={{ ...S.label, padding: '6px 8px 6px' }}>Görünümler</div>
        {filters.map(f => {
          const isActive = filter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '7px 8px', marginBottom: 1,
                background: isActive ? 'var(--surface-inset)' : 'transparent',
                border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ color: isActive ? 'var(--text)' : 'var(--text-3)', display: 'inline-flex' }}>{f.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 600 : 500, color: 'var(--text)' }}>{f.label}</span>
              <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>{counts[f.id]}</span>
            </button>
          )
        })}

      </div>
      <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)' }}>
        <button onClick={onHistory} style={{ ...btnGhost(), width: '100%', justifyContent: 'center' }}>
          <I.history size={13} />Geçmiş siparişler
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   KPI CHIP
   ============================================================ */
function KpiChip({ label, value, tone, pulse }: {
  label: string; value: string
  tone?: 'warning' | 'positive' | 'critical'; pulse?: boolean
}) {
  const fg = tone === 'warning' ? 'var(--warning)' : tone === 'positive' ? 'var(--positive)' : tone === 'critical' ? 'var(--critical)' : 'var(--text)'
  const dot = tone ? fg : 'var(--text-3)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: dot, flexShrink: 0, animation: pulse ? 'pulse-dot 2s infinite' : 'none' }} />
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ ...S.mono, fontSize: 14, fontWeight: 700, color: fg }}>{value}</div>
      </div>
    </div>
  )
}

/* ============================================================
   STATIC KANBAN (DnD fallback while loading)
   ============================================================ */
function KanbanStatic({ columns, filteredOrders, tableLabels, selectedOrderId, onSelectOrder, onAdvance }: {
  columns: ColumnDef[]
  filteredOrders: Order[]
  tableLabels: Record<string, string>
  selectedOrderId: string | null
  onSelectOrder: (order: Order | null) => void
  onAdvance: (order: Order) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', height: '100%' }}>
      {columns.map(col => (
        <OrderColumn
          key={col.id}
          column={col}
          orders={filteredOrders.filter(o => col.statuses.includes(o.status as OrderStatus))}
          tableLabels={tableLabels}
          selectedOrderId={selectedOrderId}
          onSelectOrder={onSelectOrder}
          onAdvance={onAdvance}
        />
      ))}
    </div>
  )
}

const OrderBoardDnd = dynamic(() => import('./OrderBoardDnd'), {
  ssr: false,
  loading: () => (
    <KanbanStatic columns={COLUMNS} filteredOrders={[]} tableLabels={{}} selectedOrderId={null} onSelectOrder={() => {}} onAdvance={() => {}} />
  ),
})

/* ============================================================
   MAIN
   ============================================================ */
interface Props {
  restaurantId: string
  restaurantName: string
  initialOrders: Order[]
  tables: Array<{ id: string; label: string }>
  kitchenToken?: string | null
  notifPrefs: NotificationPrefs
  /** settings.orders.late_threshold_min (clamped 5–120, default 20). */
  lateThresholdMin: number
}

export default function OrderBoard({ restaurantId, restaurantName, initialOrders, tables, kitchenToken, notifPrefs, lateThresholdMin }: Props) {
  const { orders, newOrderEvent, clearNewOrderEvent, updateOrderLocally } =
    useOrdersRealtime(restaurantId, initialOrders)

  useNotificationSW(newOrderEvent, { sound: notifPrefs.newOrderSound, push: notifPrefs.newOrderPush })

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [receipt, setReceipt] = useState<{ order: ReceiptOrder; tableLabel: string } | null>(null)
  const [, startTransition] = useTransition()

  const labelFor = (tableId: string | null) => tableLabels[tableId ?? ''] ?? (tableId ? 'Masa' : 'Kasa')

  const tableLabels = Object.fromEntries(tables.map(t => [t.id, t.label]))

  const filteredOrders = orders.filter(o => {
    if (filter === 'active' && !['pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready'].includes(o.status)) return false
    if (filter === 'done' && o.status !== 'served' && o.status !== 'paid') return false
    if (filter === 'cancelled' && o.status !== 'cancelled') return false
    if (search) {
      const q = search.toLowerCase()
      const tableLabel = tableLabels[o.table_id ?? ''] ?? ''
      return o.id.toLowerCase().startsWith(q) || tableLabel.toLowerCase().includes(q)
    }
    return true
  })

  // Transient action-error banner (auto-clears). An optimistic move that fails
  // server-side is ROLLED BACK and surfaced here — never a silent stuck card.
  const [actionError, setActionError] = useState<string | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showActionError = useCallback((msg: string) => {
    setActionError(msg)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setActionError(null), 5000)
  }, [])
  useEffect(() => () => { if (errorTimer.current) clearTimeout(errorTimer.current) }, [])

  async function handleAdvance(order: Order) {
    const next = nextStatus(order.status as OrderStatus)
    if (!next) return
    const prev = order.status as OrderStatus
    updateOrderLocally(order.id, next)
    if (selectedOrder?.id === order.id) setSelectedOrder({ ...order, status: next })
    // Both a typed {error} result AND a thrown exception (network/500) roll the
    // optimistic move back — never a silently stuck card.
    let error: string | null = null
    try {
      const result = await updateOrderStatus(order.id, next, restaurantId)
      if ('error' in result) error = result.error
    } catch {
      error = 'Sunucuya ulaşılamadı'
    }
    if (error) {
      updateOrderLocally(order.id, prev)
      if (selectedOrder?.id === order.id) setSelectedOrder({ ...order, status: prev })
      showActionError(`Durum güncellenemedi: ${error}`)
    }
  }

  // Cancel modal target — the modal enforces the payment rules client-side
  // (İyzico is blocked before this ever opens; cash/pos requires a reason);
  // the cancelOrder action + cancelOrderDB re-enforce them server-side.
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)

  function handleCancel(order: Order) {
    if (order.paid_at !== null && order.payment_method === 'iyzico') {
      showActionError('Bu sipariş online ödendi — iadeyi İyzico panelinden manuel yapın.')
      return
    }
    setCancelTarget(order)
  }

  function confirmCancel(order: Order, reason: string) {
    setCancelTarget(null)
    const prev = order.status as OrderStatus
    startTransition(async () => {
      updateOrderLocally(order.id, 'cancelled')
      if (selectedOrder?.id === order.id) setSelectedOrder(null)
      let error: string | null = null
      try {
        const result = await cancelOrder(order.id, restaurantId, reason || undefined)
        if ('error' in result) error = result.error
      } catch {
        error = 'Sunucuya ulaşılamadı'
      }
      if (error) {
        updateOrderLocally(order.id, prev)
        showActionError(`İptal edilemedi: ${error}`)
      }
    })
  }

  const activeCount = orders.filter(o =>
    ['pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready'].includes(o.status)
  ).length
  // THE shared collected predicate (isCollectedOrderRow): İkram/comp is ₺0
  // collected and must not inflate the board's Tahsilat — same rule + same
  // number as the Ödemeler report.
  const revenue = orders
    .filter(isCollectedOrderRow)
    .reduce((s, o) => s + o.total, 0)
  const compOrders = orders.filter(o => o.paid_at !== null && o.status !== 'cancelled' && o.payment_method === 'comp')
  const compAmount = compOrders.reduce((s, o) => s + o.total, 0)
  // Geciken: time IN the kitchen stage (sent_to_kitchen_at; created_at fallback
  // for pre-migration orders) vs the per-restaurant threshold.
  const lateCount = orders.filter(o => {
    if (!['sent_to_kitchen', 'preparing'].includes(o.status)) return false
    const start = (o.sent_to_kitchen_at as string | null) ?? o.created_at
    return Math.floor((Date.now() - new Date(start).getTime()) / 60_000) > lateThresholdMin
  }).length
  // REAL prep time (P2): mean(ready_at − sent_to_kitchen_at) over today's orders
  // carrying BOTH stamps. "—" until samples exist (rollout day) — never the old
  // "age of active orders" number under a prep-time label.
  const prepSamples = orders
    .filter(o => o.sent_to_kitchen_at && o.ready_at)
    .map(o => (new Date(o.ready_at as string).getTime() - new Date(o.sent_to_kitchen_at as string).getTime()) / 60_000)
    .filter(m => Number.isFinite(m) && m >= 0)
  const avgPrepLabel = prepSamples.length > 0
    ? `${Math.round(prepSamples.reduce((s, m) => s + m, 0) / prepSamples.length)} dk`
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <OrderToast order={newOrderEvent} onDismiss={clearNewOrderEvent} enabled={notifPrefs.newOrderToast} />
      {actionError && (
        <div
          role="alert"
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 210, maxWidth: 420,
            background: 'var(--critical-bg)', color: 'var(--critical)',
            border: '1px solid var(--critical)', borderRadius: 10,
            padding: '10px 14px', fontSize: 12.5, fontWeight: 600,
            boxShadow: 'var(--shadow-pop)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <I.warn size={14} />
          <span style={{ flex: 1 }}>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Kapat"
            style={{ border: 'none', background: 'transparent', color: 'var(--critical)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
      )}
      <PageTopBar
        restaurantName={restaurantName}
        title="Siparişler"
        tag={
          <Tag tone="positive">
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
            Canlı
          </Tag>
        }
        center={
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <KpiChip label="Aktif" value={String(activeCount)} tone="warning" pulse />
            <KpiChip label="Ort. hazırlık" value={avgPrepLabel} />
            <KpiChip label="Tahsilat" value={formatCurrency(revenue)} tone="positive" />
            {compAmount > 0 && <KpiChip label="İkram (tahsilat dışı)" value={formatCurrency(compAmount)} />}
            {lateCount > 0 && <KpiChip label="Geciken" value={String(lateCount)} tone="critical" />}
          </div>
        }
        right={
          <button
            style={{ ...btnPrimary(), opacity: kitchenToken ? 1 : 0.5, cursor: kitchenToken ? 'pointer' : 'not-allowed' }}
            disabled={!kitchenToken}
            title={kitchenToken ? undefined : 'Ayarlar → Mutfak Ekranı bölümünden token oluşturun'}
            onClick={() => {
              if (!kitchenToken) return
              const base = process.env['NEXT_PUBLIC_KITCHEN_URL'] ?? 'http://localhost:3002'
              window.open(`${base}/kitchen/${restaurantId}?token=${kitchenToken}`, '_blank')
            }}
          >
            <I.monitor size={13} />Mutfak ekranı
          </button>
        }
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <OrdersNav filter={filter} setFilter={setFilter} orders={orders} search={search} setSearch={setSearch} onHistory={() => setHistoryOpen(true)} />

        {/* Kanban */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 16px 32px', background: 'var(--bg)' }}>
          <OrderBoardDnd
            columns={COLUMNS}
            filteredOrders={filteredOrders}
            orders={orders}
            tableLabels={tableLabels}
            selectedOrderId={selectedOrder?.id ?? null}
            onSelectOrder={setSelectedOrder}
            onAdvance={handleAdvance}
            updateOrderLocally={updateOrderLocally}
            restaurantId={restaurantId}
            onActionError={showActionError}
            lateThresholdMin={lateThresholdMin}
          />
        </div>

        <OrderDetailPanel
          order={selectedOrder}
          tableLabel={selectedOrder ? labelFor(selectedOrder.table_id) : ''}
          onClose={() => setSelectedOrder(null)}
          onAdvance={handleAdvance}
          onCancel={handleCancel}
          onReceipt={(o) => setReceipt({ order: o, tableLabel: labelFor(o.table_id) })}
        />
      </div>

      {historyOpen && (
        <HistoryModal
          restaurantId={restaurantId}
          tableLabels={tableLabels}
          onClose={() => setHistoryOpen(false)}
          onReceipt={(o, label) => setReceipt({ order: o as ReceiptOrder, tableLabel: label })}
        />
      )}
      {receipt && (
        <ReceiptModal
          order={receipt.order}
          restaurantName={restaurantName}
          tableLabel={receipt.tableLabel}
          onClose={() => setReceipt(null)}
        />
      )}
      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          tableLabel={labelFor(cancelTarget.table_id)}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => confirmCancel(cancelTarget, reason)}
        />
      )}
    </div>
  )
}

/* ============================================================
   CANCEL MODAL — payment-aware rules
   ============================================================ */
function CancelOrderModal({ order, tableLabel, onClose, onConfirm }: {
  order: Order
  tableLabel: string
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  // cash/pos-PAID cancel = money was collected and is being refunded in person →
  // the reason is REQUIRED (recorded as cancel_reason + cancelled_by). Unpaid →
  // reason optional. İyzico never reaches this modal (blocked upstream).
  const paidManual = order.paid_at !== null && (order.payment_method === 'cash' || order.payment_method === 'pos')
  const reasonOk = !paidManual || reason.trim().length >= 3

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(17,17,19,.42)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(420px, 94vw)', background: 'var(--surface)', borderRadius: 14,
        boxShadow: 'var(--shadow-pop)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Siparişi iptal et</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            {tableLabel} · #{order.id.slice(0, 6).toUpperCase()} · {formatCurrency(order.total)}
          </div>
        </div>
        <div style={{ padding: '14px 18px' }}>
          {paidManual ? (
            <div style={{
              fontSize: 12, color: 'var(--warning)', background: 'var(--warning-bg)',
              borderRadius: 8, padding: '9px 11px', marginBottom: 12, lineHeight: 1.45,
            }}>
              Bu sipariş <b>{order.payment_method === 'cash' ? 'nakit' : 'fiziksel POS'}</b> ile tahsil edildi.
              İptal kayıt altına alınır — parayı elden iade ettiğinizi onaylıyorsunuz. Gerekçe zorunlu.
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12 }}>
              Sipariş iptal edilecek; kullanılan puan/damga otomatik iade edilir.
            </div>
          )}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={paidManual ? 'İptal gerekçesi (zorunlu)' : 'Gerekçe (opsiyonel)'}
            autoFocus
            style={{
              width: '100%', height: 36, padding: '0 11px', fontSize: 12.5,
              border: `1px solid ${paidManual && !reasonOk ? 'var(--warning)' : 'var(--border-strong)'}`,
              borderRadius: 8, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ ...btnGhost(), flex: 1, justifyContent: 'center' }}>Vazgeç</button>
          <button
            type="button"
            disabled={!reasonOk}
            onClick={() => reasonOk && onConfirm(reason.trim())}
            style={{
              ...btnPrimary(), flex: 1, justifyContent: 'center',
              background: 'var(--critical)', borderColor: 'var(--critical)',
              opacity: reasonOk ? 1 : 0.5, cursor: reasonOk ? 'pointer' : 'not-allowed',
            }}
          >
            İptal et
          </button>
        </div>
      </div>
    </div>
  )
}
