'use client'

import { useState, useRef, useCallback, useEffect, useMemo, type RefObject } from 'react'
import dynamic from 'next/dynamic'
import { readOrderCustomerTierSnapshot, readOrderLineSnapshots, isCollectedOrderRow, orderHasPriorityService, ALLERGEN_LABELS, type OrderLifecycleTarget } from '@garsonless/db/browser'
import { useOrdersRealtime } from './useOrdersRealtime'
import type { Order } from './useOrdersRealtime'
import { nextStatus } from './OrderCard'
import { updateOrderStatus, cancelOrder, recordManualRefund, refundIyzicoOrder } from '../../lib/actions/orders'
import { getOpenTableSessions } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { formatCurrency } from '../../lib/utils'
import PageTopBar from '../layout/PageTopBar'
import { I, S, Tag, IconButton, btnPrimary, btnGhost } from '../../lib/ui'
import type { ReceiptOrder } from './ReceiptModal'
import type { OrderDensity } from './OrderCard'
import { isActiveOrder, isCancelledOrder, isCompletedOrder, isLateOrder, isReadyWaitingOrder } from './order-status'
import { FILTER_LABELS, ORDER_SOURCE_LABELS, orderMatchesSearch, orderMatchesSource, orderMatchesView, orderStationNames, type FilterId, type OrderSourceFilter } from './order-filters'
import { ORDER_BOARD_COLUMNS } from './order-board-contract'
import { ORDERS_REALTIME_COPY } from './order-realtime-model'
import { paymentMethodBadge } from '../../lib/payment-method'
import {
  OPERATIONAL_STATUS_LABELS,
  buildOrderOperationalEvents,
  orderActionSuccessMessage,
  orderAdvanceLabel,
  orderPaymentLabel,
  readOrderFinancialBreakdown,
} from './order-detail-model'
import { AccessibleDialog } from '../tables/AccessibleDialog'

/* ============================================================
   COLUMN DEFINITIONS
   ============================================================ */
const COLUMNS = ORDER_BOARD_COLUMNS

const HistoryModal = dynamic(() => import('./HistoryModal'), { ssr: false })
const ReceiptModal = dynamic(() => import('./ReceiptModal'), { ssr: false })
const OrdersTransferDialog = dynamic(() => import('./OrdersTransferDialog'), { ssr: false })

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
  const status = order.status
  // Real per-stage times (P2 trigger stamps). NULL (pre-migration order or a
  // stage not reached) → no time under the step — never a fabricated value.
  const steps = [
    { id: ['pending', 'pending_approval'],          label: 'Alındı',       at: timelineTime(order.created_at) },
    { id: ['sent_to_kitchen', 'preparing'], label: 'Hazırlanıyor', at: timelineTime(order.sent_to_kitchen_at as string | null | undefined) },
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
  onSettle,
  settleLoading,
  actionPending,
  isOwner,
  onRefund,
}: {
  order: Order | null
  tableLabel: string
  onClose: () => void
  onAdvance: (order: Order) => void
  onCancel: (order: Order) => void
  onReceipt: (order: Order) => void
  onSettle: (order: Order) => void
  settleLoading: boolean
  actionPending: boolean
  isOwner: boolean
  onRefund: (order: Order) => void
}) {
  if (!order) {
    return (
      <aside className="orders-detail-panel orders-detail-panel--empty" aria-label="Sipariş detayları" style={{
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
      </aside>
    )
  }

  const items = readOrderLineSnapshots(order.items)
  const itemQuantity = items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  const financial = readOrderFinancialBreakdown(order.discount_breakdown, order.total)
  const nextSt = nextStatus(order.status)
  const tier = readOrderCustomerTierSnapshot(order.customer_tier)
  const advanceLabel = orderAdvanceLabel(order.status)
  const operationEvents = buildOrderOperationalEvents(order)
  const sourceLabel = ORDER_SOURCE_LABELS[order.source]
  const paymentLabel = orderPaymentLabel(order)
  const paymentBadge = order.paid_at !== null
    ? paymentMethodBadge((order.payment_method as Parameters<typeof paymentMethodBadge>[0]) ?? null)
    : null
  const shortRef = (value: string | null | undefined) => value ? `#${value.slice(0, 8).toUpperCase()}` : '—'

  return (
    <aside className="orders-detail-panel" aria-labelledby="order-detail-title" aria-busy={actionPending || settleLoading} style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div id="order-detail-title" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>{tableLabel}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', ...S.mono }}>#{order.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton className="orders-touch-target" icon={<I.copy size={15} />} ariaLabel="Sipariş numarasını kopyala" onClick={() => void navigator.clipboard?.writeText(order.id)} />
            <IconButton className="orders-touch-target" initialFocus icon={<I.close size={15} />} ariaLabel={`${tableLabel} sipariş detayını kapat`} onClick={onClose} />
          </div>
        </div>
        <StatusTimeline order={order} />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Operational context — only persisted order fields; no inferred actor/provider. */}
        <div data-order-detail-context style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
          <DetailMeta label="Kaynak" value={sourceLabel} />
          <DetailMeta label="Oluşturuldu" value={new Date(order.created_at).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} />
          <DetailMeta label="Ödeme" value={paymentLabel} badge={paymentBadge} />
          <DetailMeta label="Adisyon" value={shortRef(order.table_session_id)} mono />
          <DetailMeta label="Sipariş oturumu" value={shortRef(order.session_id)} mono />
          <DetailMeta label="Müşteri" value={order.customer_id ? `Bağlı · ${shortRef(order.customer_id)}` : 'Misafir'} mono={Boolean(order.customer_id)} />
          {order.settled_by && <DetailMeta label="Tahsil eden" value={shortRef(order.settled_by)} mono />}
          {order.cancelled_by && <DetailMeta label="İptal eden" value={shortRef(order.cancelled_by)} mono />}
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Sipariş içeriği · {items.length} kalem · {itemQuantity} adet</div>
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
                    {it.productNote && (
                      <div style={{ marginTop: 4, padding: '5px 7px', borderRadius: 6, background: 'var(--warning-bg)', color: 'var(--text)', fontSize: 10.5, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                        NOT: {it.productNote}
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
          <SummaryRow label="Ara toplam" value={formatCurrency(financial.subtotal)} />
          {financial.rows.map((row) => (
            <SummaryRow
              key={row.id}
              label={row.label}
              value={`${row.kind === 'discount' ? '−' : '+'}${formatCurrency(row.amount)}`}
            />
          ))}
          <div style={{ height: 1, background: 'var(--divider)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Toplam</span>
            <span style={{ ...S.mono, fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>

        {/* Status */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Durum</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag tone={
              order.status === 'pending' || order.status === 'pending_approval' ? 'warning' :
              order.status === 'sent_to_kitchen' || order.status === 'preparing' ? 'info' :
              order.status === 'ready' ? 'positive' : 'neutral'
            }>
              {OPERATIONAL_STATUS_LABELS[order.status]}
            </Tag>
            {order.paid_at !== null && (
              <Tag tone="positive">ÖDENDİ</Tag>
            )}
            {tier?.priorityService && (
              <Tag tone="warning">
                <span style={{ width: 6, height: 6, borderRadius: 999, background: tier.color, display: 'inline-block' }} />
                Öncelikli · {tier.name}
              </Tag>
            )}
          </div>
        </div>

        <div data-order-operation-history style={{ padding: '14px 16px' }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Operasyon geçmişi</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {operationEvents.filter((event) => event.at || event.current).map((event) => (
              <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: event.current ? 'var(--text)' : 'var(--positive)', boxShadow: event.current ? '0 0 0 3px var(--surface-3)' : 'none' }} />
                <span style={{ fontSize: 12, fontWeight: event.current ? 700 : 500 }}>{event.label}</span>
                <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>
                  {event.at ? new Date(event.at).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Zaman kaydı yok'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer — cancel rules by payment state: İyzico-paid is BLOCKED in-app
          (verified provider refund flow); cash/pos-paid requires a recorded
          reason (modal); unpaid cancels normally. */}
      <div style={{
        borderTop: '1px solid var(--divider)', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-2)',
      }}>
        {order.paid_at !== null && (order.payment_method === 'iyzico' || order.payment_method === 'split') && order.status !== 'served' && order.status !== 'cancelled' && (
          <div style={{
            fontSize: 11.5, color: 'var(--info)', background: 'var(--info-bg)',
            borderRadius: 8, padding: '8px 10px', lineHeight: 1.45,
          }}>
            {order.payment_method === 'split'
              ? 'Bu sipariş hesap bölüşme ile ödendi — iptal için pay iade akışı gerekir.'
              : 'Bu sipariş online ödendi — iade İyzico sağlayıcısına gönderilir ve doğrulanmış cevapla kaydedilir.'}
          </div>
        )}
        {order.paid_at !== null && (order.payment_method === 'cash' || order.payment_method === 'pos') && !isOwner && order.status !== 'cancelled' && (
          <div style={{ fontSize: 11.5, color: 'var(--warning)', background: 'var(--warning-bg)', borderRadius: 8, padding: '8px 10px' }}>
            Tahsil edilmiş nakit/POS siparişinin iade ve iptal kaydını yalnız işletme sahibi tamamlayabilir.
          </div>
        )}
        {isOwner && order.paid_at !== null && order.status !== 'cancelled'
          && (order.payment_method === 'cash' || order.payment_method === 'pos' || order.payment_method === 'iyzico') && (
          <button
            type="button"
            disabled={actionPending}
            onClick={() => onRefund(order)}
            className="orders-touch-target"
            style={{ ...btnGhost(), width: '100%', minHeight: 40, justifyContent: 'center', color: 'var(--critical)' }}
          >
            Parasal iade kaydet
          </button>
        )}
        {/* Settle-from-board: unpaid order on an open adisyon → open the Tables
            SettlementSheet here (the exact same money flow, no screen switch). */}
        {order.paid_at === null && order.table_session_id && order.status !== 'cancelled' && (
          <button
            type="button"
            disabled={settleLoading || actionPending}
            onClick={() => onSettle(order)}
            className="orders-touch-target"
            style={{
              ...btnGhost(), width: '100%', justifyContent: 'center',
              color: 'var(--positive)', borderColor: 'var(--positive)',
              opacity: settleLoading || actionPending ? 0.6 : 1,
            }}
          >
            {settleLoading ? 'Adisyon yükleniyor…' : 'Masayı tahsil et (adisyon)'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {order.status === 'served' ? (
            <button
              type="button"
              onClick={() => onReceipt(order)}
              className="orders-touch-target"
              style={{ ...btnPrimary(), flex: 1, minHeight: 40, justifyContent: 'center' }}
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
              {!(order.paid_at !== null && (order.payment_method === 'iyzico' || order.payment_method === 'split'))
                && !(order.paid_at !== null && (order.payment_method === 'cash' || order.payment_method === 'pos') && !isOwner) && (
                <button
                  type="button"
                  data-order-detail-cancel
                  disabled={actionPending}
                  onClick={() => onCancel(order)}
                  className="orders-touch-target"
                  style={{ ...btnGhost(), flex: 1, minHeight: 40, justifyContent: 'center', opacity: actionPending ? 0.6 : 1 }}
                >
                  İptal et
                </button>
              )}
              {advanceLabel && nextSt && (
                <button
                  type="button"
                  data-order-detail-advance
                  disabled={actionPending}
                  onClick={() => onAdvance(order)}
                  className="orders-touch-target"
                  style={{ ...btnPrimary(), flex: 2, minHeight: 40, justifyContent: 'center', opacity: actionPending ? 0.65 : 1, cursor: actionPending ? 'wait' : 'pointer' }}
                >
                  <I.check size={13} />{actionPending ? 'İşleniyor…' : advanceLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function DetailMeta({ label, value, mono = false, badge }: {
  label: string
  value: string
  mono?: boolean
  badge?: ReturnType<typeof paymentMethodBadge> | null
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...S.label, marginBottom: 3 }}>{label}</div>
      {badge ? (
        <span style={{ display: 'inline-flex', maxWidth: '100%', padding: '2px 7px', borderRadius: 999, background: badge.bg, color: badge.fg, fontSize: 10.5, fontWeight: 750 }}>{badge.label}</span>
      ) : (
        <div style={{ ...(mono ? S.mono : null), fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={value}>{value}</div>
      )}
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
function OrdersNav({ filter, setFilter, sourceFilter, setSourceFilter, orders, search, setSearch, onHistory, onClose, lateThresholdMin, searchInputRef, now, stations, selectedStation, setSelectedStation }: {
  filter: FilterId
  setFilter: (f: FilterId) => void
  sourceFilter: OrderSourceFilter
  setSourceFilter: (source: OrderSourceFilter) => void
  orders: Order[]
  search: string
  setSearch: (s: string) => void
  onHistory: () => void
  onClose?: () => void
  lateThresholdMin: number
  searchInputRef: RefObject<HTMLInputElement | null>
  now: number
  stations: string[]
  selectedStation: string | null
  setSelectedStation: (station: string | null) => void
}) {
  const late = orders.filter(order => isLateOrder(order, lateThresholdMin, now)).length
  const priority = orders.filter(order => isActiveOrder(order) && orderHasPriorityService(order)).length
  const counts = {
    all:       orders.length,
    active:    orders.filter(isActiveOrder).length,
    attention: orders.filter(order => isLateOrder(order, lateThresholdMin, now) || isReadyWaitingOrder(order, 5, now) || (isActiveOrder(order) && orderHasPriorityService(order))).length,
    late,
    ready_wait: orders.filter(order => isReadyWaitingOrder(order, 5, now)).length,
    unpaid:    orders.filter(order => isActiveOrder(order) && order.paid_at === null).length,
    priority,
    done:      orders.filter(isCompletedOrder).length,
    cancelled: orders.filter(isCancelledOrder).length,
  }

  const filters: { id: FilterId; label: string; icon: React.ReactNode }[] = [
    { id: 'all',       label: 'Tümü',      icon: <I.clipboard size={15} /> },
    { id: 'active',    label: 'Aktif',     icon: <I.bell size={15} /> },
    { id: 'attention', label: 'Dikkat gerekiyor', icon: <I.warn size={15} /> },
    { id: 'late',      label: 'Geciken',   icon: <I.clock size={15} /> },
    { id: 'ready_wait',label: 'Servis bekleyen', icon: <I.clock size={15} /> },
    { id: 'unpaid',    label: 'Ödenmemiş', icon: <I.card size={15} /> },
    { id: 'priority',  label: 'Öncelikli', icon: <I.star size={15} /> },
    { id: 'done',      label: 'Tamamlandı',icon: <I.check size={15} /> },
    { id: 'cancelled', label: 'İptal',     icon: <I.close size={15} /> },
  ]
  const sourceCounts = {
    all: orders.length,
    customer: orders.filter((order) => order.source === 'customer').length,
    staff: orders.filter((order) => order.source === 'staff').length,
  }
  const sources: Array<{ id: OrderSourceFilter; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'Tüm kaynaklar', icon: <I.globe size={14} /> },
    { id: 'customer', label: ORDER_SOURCE_LABELS.customer, icon: <I.qr size={14} /> },
    { id: 'staff', label: ORDER_SOURCE_LABELS.staff, icon: <I.user size={14} /> },
  ]

  return (
    <div className={`orders-nav${onClose ? ' orders-nav--drawer' : ' orders-nav--desktop'}`} style={{
      width: 'var(--nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '10px 12px 10px 16px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id="orders-filter-title" style={{ fontSize: 14, fontWeight: 600 }}>Sipariş Akışı</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
            Tüm istasyonlar · {counts.active} aktif
          </div>
        </div>
        {onClose && (
          <button type="button" data-modal-initial-focus className="orders-touch-target" aria-label="Filtreleri kapat" onClick={onClose} style={{ width: 44, height: 44, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--text-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <I.close size={18} />
          </button>
        )}
      </div>
      <div style={{ padding: '8px 12px 4px' }}>
        <div className="orders-search-field" style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 36,
          padding: '0 10px', background: 'var(--surface-3)', borderRadius: 7,
          color: 'var(--text-3)',
        }}>
          <I.search size={13} />
          <input
            ref={searchInputRef}
            aria-label="Siparişlerde ara"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sipariş, masa, ürün..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5 }}
          />
          {search && (
            <button type="button" aria-label="Aramayı temizle" onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
              <I.close size={12} />
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px' }}>
        <div style={{ ...S.label, padding: '6px 8px 6px' }}>Görünümler</div>
        {filters.map(f => {
          const isActive = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilter(f.id)}
              onMouseEnter={event => { if (!isActive) event.currentTarget.style.background = 'var(--surface-3)' }}
              onMouseLeave={event => { if (!isActive) event.currentTarget.style.background = 'transparent' }}
              className="orders-filter-option"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '7px 8px', marginBottom: 1,
                background: isActive ? 'var(--surface-inset)' : 'transparent',
                border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                minHeight: 40, transition: 'background 120ms ease',
              }}
            >
              <span style={{ color: isActive ? 'var(--text)' : 'var(--text-3)', display: 'inline-flex' }}>{f.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 600 : 500, color: 'var(--text)' }}>{f.label}</span>
              <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>{counts[f.id]}</span>
            </button>
          )
        })}

        <div style={{ marginTop: 12 }}>
          <div style={{ ...S.label, padding: '6px 8px' }}>Kaynak</div>
          {sources.map((source) => {
            const active = sourceFilter === source.id
            return (
              <button
                key={source.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSourceFilter(source.id)}
                className="orders-filter-option"
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', minHeight: 40, padding: '6px 8px', border: 0, borderRadius: 7, background: active ? 'var(--surface-inset)' : 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ color: active ? 'var(--text)' : 'var(--text-3)', display: 'inline-flex' }}>{source.icon}</span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: active ? 650 : 500 }}>{source.label}</span>
                <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>{sourceCounts[source.id]}</span>
              </button>
            )
          })}
        </div>

        {stations.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...S.label, padding: '6px 8px' }}>İstasyonlar</div>
            {stations.map(station => {
              const active = selectedStation === station
              const count = orders.filter(order => orderStationNames(order).includes(station)).length
              return (
                <button
                  key={station}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedStation(active ? null : station)}
                  onMouseEnter={event => { if (!active) event.currentTarget.style.background = 'var(--surface-3)' }}
                  onMouseLeave={event => { if (!active) event.currentTarget.style.background = 'transparent' }}
                  className="orders-filter-option"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', minHeight: 40, padding: '6px 8px', border: 0, borderRadius: 7, background: active ? 'var(--surface-inset)' : 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left', transition: 'background 120ms ease' }}
                >
                  <I.cutlery size={14} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: active ? 650 : 500 }}>{station}</span>
                  <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

      </div>
      <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)' }}>
        <button className="orders-touch-target" onClick={onHistory} style={{ ...btnGhost(), width: '100%', minHeight: 40, justifyContent: 'center' }}>
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

// Settle-from-board: the EXACT SettlementSheet money flow from Tables (same
// component, same settleOrder/closeTableSession path) — not a parallel impl.
const SettlementSheet = dynamic(() => import('../tables/SettlementSheet'))

const OrderBoardDnd = dynamic(() => import('./OrderBoardDnd'), {
  ssr: false,
  loading: () => (
    <div role="status" aria-live="polite" style={{ minHeight: 180, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
      Sipariş panosu hazırlanıyor…
    </div>
  ),
})

type OrdersPresentation = 'desktop' | 'drawer' | 'sheet'

function useOrdersPresentation(): OrdersPresentation {
  const [presentation, setPresentation] = useState<OrdersPresentation>('desktop')

  useEffect(() => {
    const update = () => setPresentation(
      window.matchMedia('(max-width: 760px)').matches
        ? 'sheet'
        : window.matchMedia('(max-width: 1180px)').matches ? 'drawer' : 'desktop',
    )
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return presentation
}

const ORDERS_RESPONSIVE_CSS = `
.orders-shell, .orders-shell * { box-sizing: border-box; }
.orders-shell button:focus-visible,
.orders-shell input:focus-visible,
.orders-shell [tabindex]:focus-visible {
  outline: 2px solid var(--focus-ring, var(--text));
  outline-offset: 2px;
}
.orders-topbar button,
.orders-touch-target,
.orders-filter-option { min-width: 44px !important; min-height: 44px !important; }
.orders-search-field { height: 44px !important; }
.orders-kanban { width: 100%; min-width: 0 !important; }
.orders-column { min-width: 0 !important; }
.orders-mobile-toolbar { display: none; }
.orders-detail-overlay,
.orders-filter-overlay {
  position: fixed;
  inset: 0;
  z-index: 190;
  display: flex;
  background: rgba(17,17,19,.4);
  backdrop-filter: blur(2px);
}
.orders-detail-overlay { justify-content: flex-end; align-items: stretch; }
.orders-filter-overlay { justify-content: flex-start; align-items: stretch; }
.orders-filter-drawer { height: 100dvh; width: min(340px, calc(100vw - 24px)); }
.orders-nav--drawer { width: 100% !important; height: 100%; box-shadow: 16px 0 46px rgba(17,17,19,.2); }
.order-card-open:focus-visible { border-radius: 9px; outline-offset: -3px !important; }

@media (max-width: 1180px) {
  .orders-topbar {
    height: 104px !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    grid-template-rows: 52px 52px;
    padding: 0 10px !important;
  }
  .orders-topbar > :nth-child(1) { grid-column: 1; grid-row: 1; min-width: 0; }
  .orders-topbar > :nth-child(2) {
    grid-column: 1 / -1;
    grid-row: 2;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .orders-topbar > :nth-child(2)::-webkit-scrollbar { display: none; }
  .orders-topbar > :nth-child(3) { grid-column: 2; grid-row: 1; }
  .orders-kpi-strip { width: max-content; min-width: 100%; min-height: 48px; gap: 18px !important; padding: 4px 2px; }
  .orders-topbar .page-topbar-notification,
  .orders-topbar .page-topbar-restaurant,
  .orders-topbar-action,
  .orders-touch-target { min-width: 44px !important; min-height: 44px !important; }
  .orders-body { position: relative; min-width: 0; }
  .orders-nav--desktop, .orders-detail-panel--empty { display: none !important; }
  .orders-mobile-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .orders-board-scroll { padding: 12px 12px 24px !important; }
  .orders-board-toolbar { flex-wrap: wrap; }
  .orders-board-toolbar > span:last-child { display: none; }
  .orders-kanban {
    width: 100%;
    min-width: 0 !important;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 2px;
    overscroll-behavior-inline: contain;
    padding-bottom: 8px;
  }
  .orders-column {
    flex: 0 0 min(340px, calc(100vw - 112px)) !important;
    min-width: min(340px, calc(100vw - 112px)) !important;
    max-height: 100%;
    scroll-snap-align: start;
  }
  .orders-column-header { position: sticky; top: 0; z-index: 2; background: var(--surface-2); }
  .orders-detail-panel {
    width: min(430px, calc(100vw - 24px)) !important;
    height: 100dvh;
    border-left: 0 !important;
    box-shadow: -18px 0 52px rgba(17,17,19,.22);
  }
  .order-card-action { min-height: 44px !important; padding-inline: 14px !important; }
}

@media (max-width: 760px) {
  .orders-topbar .page-topbar-brand,
  .orders-topbar .page-topbar-restaurant,
  .orders-topbar .page-topbar-separator { display: none !important; }
  .orders-topbar .page-topbar-context { gap: 7px !important; }
  .orders-topbar .page-topbar-title { font-size: 14px !important; font-weight: 700 !important; }
  .orders-action-label { display: none; }
  .orders-topbar-action { padding-inline: 0 !important; justify-content: center !important; }
  .orders-kpi-strip { gap: 16px !important; }
  .orders-board-scroll { padding: 10px 10px 20px !important; }
  .orders-mobile-toolbar { padding-inline: 10px; }
  .orders-mobile-toolbar-copy { display: none; }
  .orders-column {
    flex-basis: calc(100vw - 20px) !important;
    min-width: calc(100vw - 20px) !important;
  }
  .orders-detail-overlay { align-items: stretch; }
  .orders-detail-panel {
    width: 100% !important;
    height: 100dvh;
    border-radius: 0 !important;
    box-shadow: none;
  }
  .orders-filter-drawer { width: min(340px, calc(100vw - 18px)); }
  .orders-board-toolbar [role="group"] { width: 100%; }
  .orders-board-toolbar [role="group"] > button { flex: 1; min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .orders-shell *, .orders-detail-overlay, .orders-filter-overlay {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
`

/* ============================================================
   MAIN
   ============================================================ */
interface Props {
  restaurantId: string
  restaurantName: string
  initialOrders: Order[]
  tables: Array<{ id: string; label: string }>
  hasKitchenAccess?: boolean
  isOwner?: boolean
  receiptTax?: Record<string, unknown> | null
  /** settings.orders.late_threshold_min (clamped 5–120, default 20). */
  lateThresholdMin: number
  /** Restaurant-local start-of-day used by SSR and reconnect reconciliation. */
  initialSince: string
}

export default function OrderBoard({ restaurantId, restaurantName, initialOrders, tables, hasKitchenAccess = false, isOwner = false, receiptTax, lateThresholdMin, initialSince }: Props) {
  const {
    orders,
    connectionStatus,
    retryRealtime,
    reconcileOrders,
    startOptimisticOrderStatus,
    commitOptimisticOrderStatus,
    rollbackOptimisticOrderStatus,
  } =
    useOrdersRealtime(restaurantId, initialOrders, initialSince)

  const presentation = useOrdersPresentation()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null
  const pendingOrdersRef = useRef(new Set<string>())
  const [pendingOrderIds, setPendingOrderIds] = useState<ReadonlySet<string>>(() => new Set())
  const [filter, setFilter] = useState<FilterId>('all')
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mobileFilterTriggerRef = useRef<HTMLButtonElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferDone, setTransferDone] = useState(false)
  const [receipt, setReceipt] = useState<{ order: ReceiptOrder; tableLabel: string } | null>(null)
  const [refundTarget, setRefundTarget] = useState<Order | null>(null)
  const [refundPending, setRefundPending] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [density, setDensity] = useState<OrderDensity>('comfortable')
  const [closedCollapsed, setClosedCollapsed] = useState(true)

  const tableLabels = useMemo(() => Object.fromEntries(tables.map(t => [t.id, t.label])), [tables])
  const labelFor = useCallback(
    (tableId: string | null) => tableLabels[tableId ?? ''] ?? (tableId ? 'Masa' : 'Kasa'),
    [tableLabels],
  )
  const stations = useMemo(
    () => [...new Set(orders.flatMap(orderStationNames))].sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [orders],
  )

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (!orderMatchesView(o, filter, lateThresholdMin, now)) return false
    if (!orderMatchesSource(o, sourceFilter)) return false
    if (selectedStation && !orderStationNames(o).includes(selectedStation)) return false
    return orderMatchesSearch(o, tableLabels[o.table_id ?? ''] ?? '', search)
  }), [filter, lateThresholdMin, now, orders, search, selectedStation, sourceFilter, tableLabels])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem('orders:density')
    if (stored === 'comfortable' || stored === 'compact' || stored === 'dense') setDensity(stored)
  }, [])

  useEffect(() => {
    if (presentation === 'desktop') setFiltersOpen(false)
  }, [presentation])

  const changeDensity = (value: OrderDensity) => {
    setDensity(value)
    window.localStorage.setItem('orders:density', value)
  }

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
    if (presentation !== 'desktop') window.requestAnimationFrame(() => mobileFilterTriggerRef.current?.focus())
  }, [presentation])

  useEffect(() => {
    if (selectedOrderId && !filteredOrders.some(order => order.id === selectedOrderId)) setSelectedOrderId(null)
  }, [filteredOrders, selectedOrderId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (event.key === 'Escape') {
        if (search) setSearch('')
        else setSelectedOrderId(null)
        return
      }
      if (typing || filteredOrders.length === 0) return
      const current = filteredOrders.findIndex(order => order.id === selectedOrderId)
      if (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const delta = event.key.toLowerCase() === 'j' ? 1 : -1
        const nextIndex = current < 0 ? 0 : (current + delta + filteredOrders.length) % filteredOrders.length
        setSelectedOrderId(filteredOrders[nextIndex]?.id ?? null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filteredOrders, search, selectedOrderId])

  // Transient action-error banner (auto-clears). An optimistic move that fails
  // server-side is ROLLED BACK and surfaced here — never a silent stuck card.
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showActionError = useCallback((msg: string) => {
    setActionSuccess(null)
    setActionError(msg)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setActionError(null), 5000)
  }, [])
  const showActionSuccess = useCallback((msg: string) => {
    setActionError(null)
    setActionSuccess(msg)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setActionSuccess(null), 4000)
  }, [])
  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current)
    if (successTimer.current) clearTimeout(successTimer.current)
  }, [])

  function beginOrderAction(orderId: string): boolean {
    if (pendingOrdersRef.current.has(orderId)) return false
    pendingOrdersRef.current.add(orderId)
    setPendingOrderIds(new Set(pendingOrdersRef.current))
    return true
  }

  function finishOrderAction(orderId: string) {
    pendingOrdersRef.current.delete(orderId)
    setPendingOrderIds(new Set(pendingOrdersRef.current))
  }

  async function moveOrder(order: Order, next: OrderLifecycleTarget) {
    if (!beginOrderAction(order.id)) return
    const prev = order.status
    const optimisticToken = startOptimisticOrderStatus(order.id, next)
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
      const reconciled = await reconcileOrders()
      if (!reconciled) rollbackOptimisticOrderStatus(order.id, optimisticToken, next, prev)
      showActionError(`Durum güncellenemedi: ${error}`)
    } else {
      commitOptimisticOrderStatus(order.id, optimisticToken)
      showActionSuccess(orderActionSuccessMessage(labelFor(order.table_id), next))
    }
    finishOrderAction(order.id)
  }

  async function handleAdvance(order: Order) {
    const next = nextStatus(order.status)
    if (!next) return
    await moveOrder(order, next)
  }

  // Cancel modal target — the modal enforces the payment rules client-side
  // (İyzico is blocked before this ever opens; cash/pos requires a reason);
  // the cancelOrder application command + DB port re-enforce them server-side.
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)

  // Settle-from-board: resolve the order's open adisyon and open the Tables
  // SettlementSheet right here (staff shouldn't switch screens to collect).
  const [settleSheet, setSettleSheet] = useState<{ session: OpenSessionInfo; label: string } | null>(null)
  const [settleLoading, setSettleLoading] = useState(false)
  async function handleSettleFromBoard(order: Order) {
    if (!order.table_session_id) return
    setSettleLoading(true)
    try {
      const res = await getOpenTableSessions(restaurantId)
      if (!Array.isArray(res)) { showActionError(res.error); return }
      const session = res.find((s) => s.sessionId === order.table_session_id)
      if (!session) { showActionError('Adisyon bulunamadı — kapatılmış olabilir.'); return }
      setSettleSheet({ session, label: labelFor(order.table_id) })
    } catch {
      showActionError('Sunucuya ulaşılamadı')
    } finally {
      setSettleLoading(false)
    }
  }

  function handleCancel(order: Order) {
    if (order.paid_at !== null && (order.payment_method === 'iyzico' || order.payment_method === 'split')) {
      showActionError(order.payment_method === 'split'
        ? 'Bölünmüş ödeme alınmış sipariş burada iptal edilemez; önce payları uzlaştırın.'
        : 'Bu sipariş online ödendi — doğrulanmış İyzico iade akışını kullanın.')
      return
    }
    setCancelTarget(order)
  }

  async function confirmCancel(order: Order, reason: string) {
    if (!beginOrderAction(order.id)) return
    const prev = order.status
    const optimisticToken = startOptimisticOrderStatus(order.id, 'cancelled')
    let error: string | null = null
    try {
      const result = await cancelOrder(order.id, restaurantId, reason || undefined)
      if ('error' in result) error = result.error
    } catch {
      error = 'Sunucuya ulaşılamadı'
    }
    if (error) {
      const reconciled = await reconcileOrders()
      if (!reconciled) rollbackOptimisticOrderStatus(order.id, optimisticToken, 'cancelled', prev)
      showActionError(`İptal edilemedi: ${error}`)
    } else {
      commitOptimisticOrderStatus(order.id, optimisticToken)
      setCancelTarget(null)
      showActionSuccess(`${labelFor(order.table_id)} siparişi iptal edildi.`)
    }
    finishOrderAction(order.id)
  }

  const boardMetrics = useMemo(() => {
    const prepSamples = orders
      .filter(o => o.sent_to_kitchen_at && o.ready_at)
      .map(o => (new Date(o.ready_at as string).getTime() - new Date(o.sent_to_kitchen_at as string).getTime()) / 60_000)
      .filter(m => Number.isFinite(m) && m >= 0)
    const compAmount = orders
      .filter(o => o.paid_at !== null && o.status !== 'cancelled' && o.payment_method === 'comp')
      .reduce((sum, order) => sum + order.total, 0)

    return {
      activeCount: orders.filter(isActiveOrder).length,
      revenue: orders.filter(isCollectedOrderRow).reduce((sum, order) => sum + order.total, 0),
      compAmount,
      lateCount: orders.filter(order => isLateOrder(order, lateThresholdMin, now)).length,
      readyWaitCount: orders.filter(order => isReadyWaitingOrder(order, 5, now)).length,
      closedCount: orders.filter(order => isCompletedOrder(order) || isCancelledOrder(order)).length,
      avgPrepLabel: prepSamples.length > 0
        ? `${Math.round(prepSamples.reduce((sum, minutes) => sum + minutes, 0) / prepSamples.length)} dk`
        : '—',
    }
  }, [lateThresholdMin, now, orders])
  const { activeCount, revenue, compAmount, lateCount, readyWaitCount, closedCount, avgPrepLabel } = boardMetrics
  const showClosedColumn = !closedCollapsed || filter === 'done' || filter === 'cancelled'
  const visibleColumns = useMemo(
    () => showClosedColumn ? COLUMNS : COLUMNS.filter(column => column.id !== 'done'),
    [showClosedColumn],
  )
  const detailPanel = (
    <OrderDetailPanel
      order={selectedOrder}
      tableLabel={selectedOrder ? labelFor(selectedOrder.table_id) : ''}
      onClose={() => setSelectedOrderId(null)}
      onAdvance={handleAdvance}
      onCancel={handleCancel}
      onReceipt={(order) => setReceipt({ order, tableLabel: labelFor(order.table_id) })}
      onSettle={handleSettleFromBoard}
      settleLoading={settleLoading}
      actionPending={selectedOrder ? pendingOrderIds.has(selectedOrder.id) : false}
      isOwner={isOwner}
      onRefund={setRefundTarget}
    />
  )
  const detailModalBlocked = Boolean(cancelTarget || refundTarget || settleSheet || receipt)

  return (
    <div className="orders-shell" data-orders-connection-status={connectionStatus} data-orders-presentation={presentation} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{ORDERS_RESPONSIVE_CSS}</style>
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
            className="orders-touch-target"
            onClick={() => setActionError(null)}
            aria-label="Kapat"
            style={{ border: 'none', background: 'transparent', color: 'var(--critical)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
      )}
      {actionSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 205, maxWidth: 420, background: 'var(--positive-bg)', color: 'var(--positive)',
            border: '1px solid var(--positive)', borderRadius: 10, padding: '10px 14px',
            fontSize: 12.5, fontWeight: 650, boxShadow: 'var(--shadow-pop)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <I.check size={14} />{actionSuccess}
        </div>
      )}
      <PageTopBar
        className="orders-topbar"
        restaurantName={restaurantName}
        title="Siparişler"
        tag={
          <Tag tone={connectionStatus === 'live' ? 'positive' : connectionStatus === 'offline' ? 'critical' : 'warning'}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', display: 'inline-block', animation: connectionStatus === 'connecting' ? 'pulse-dot 2s infinite' : 'none' }} />
            {connectionStatus === 'live' ? 'Canlı' : connectionStatus === 'connecting' ? 'Bağlanıyor' : connectionStatus === 'reconnecting' ? 'Uzlaştırılıyor' : 'Çevrimdışı'}
          </Tag>
        }
        center={
          <div className="orders-kpi-strip" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <KpiChip label="Aktif" value={String(activeCount)} tone="warning" pulse />
            <KpiChip label="Ort. hazırlık" value={avgPrepLabel} />
            <KpiChip label="Tahsilat" value={formatCurrency(revenue)} tone="positive" />
            {compAmount > 0 && <KpiChip label="İkram (tahsilat dışı)" value={formatCurrency(compAmount)} />}
            {lateCount > 0 && <KpiChip label="Geciken" value={String(lateCount)} tone="critical" />}
            {readyWaitCount > 0 && <KpiChip label="Servis bekliyor" value={String(readyWaitCount)} tone="warning" pulse />}
          </div>
        }
        right={<div style={{display:'flex',gap:6}}>
          <button type="button" className="orders-topbar-action" aria-label="Hesap taşı" onClick={() => { setSelectedOrderId(null); setTransferOpen(true) }} style={btnGhost()}><I.arrow size={15} /><span className="orders-action-label">Hesap taşı</span></button>
          <button
            type="button"
            className="orders-topbar-action"
            aria-label="Mutfak ekranını aç"
            style={{ ...btnPrimary(), opacity: hasKitchenAccess ? 1 : 0.5, cursor: hasKitchenAccess ? 'pointer' : 'not-allowed' }}
            disabled={!hasKitchenAccess}
            title={hasKitchenAccess ? undefined : 'Ayarlar → Mutfak Ekranı bölümünden erişim oluşturun'}
            onClick={() => {
              if (!hasKitchenAccess) return
              window.open(`/api/kitchen/launch/${restaurantId}`, '_blank', 'noopener,noreferrer')
            }}
          >
            <I.monitor size={15} /><span className="orders-action-label">Mutfak ekranı</span>
          </button>
        </div>}
      />

      {connectionStatus !== 'live' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            minHeight: 34, padding: '7px 14px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: connectionStatus === 'offline' ? 'var(--critical-bg)' : 'var(--warning-bg)',
            color: connectionStatus === 'offline' ? 'var(--critical)' : 'var(--warning)',
            fontSize: 12, fontWeight: 600,
          }}
        >
          {connectionStatus === 'offline' ? <I.warn size={14} /> : <I.refresh size={14} />}
          <span style={{ flex: 1 }}>{ORDERS_REALTIME_COPY[connectionStatus]}</span>
          {(connectionStatus === 'offline' || connectionStatus === 'reconnecting') && (
            <button type="button" onClick={retryRealtime} style={{ ...btnGhost(), height: 26, background: 'var(--surface)' }}>
              Yeniden bağlan
            </button>
          )}
        </div>
      )}

      <div className="orders-body" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {presentation === 'desktop' && (
          <OrdersNav filter={filter} setFilter={setFilter} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} orders={orders} search={search} setSearch={setSearch} onHistory={() => setHistoryOpen(true)} lateThresholdMin={lateThresholdMin} searchInputRef={searchInputRef} now={now} stations={stations} selectedStation={selectedStation} setSelectedStation={setSelectedStation} />
        )}

        {/* Kanban */}
        <div className="orders-board-scroll" style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 16px 32px', background: 'var(--bg)' }}>
          <div className="orders-mobile-toolbar">
            <button
              ref={mobileFilterTriggerRef}
              type="button"
              className="orders-touch-target"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(true)}
              style={{ ...btnGhost(), minHeight: 44, justifyContent: 'center' }}
            >
              <I.search size={15} /> Filtreler ve ara
            </button>
            <Tag tone={filter === 'attention' || filter === 'late' ? 'warning' : 'neutral'}>{FILTER_LABELS[filter]} · {filteredOrders.length}</Tag>
            <span className="orders-mobile-toolbar-copy" style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11.5 }}>Kolonlar arasında yatay kaydır</span>
          </div>
          <div className="orders-board-toolbar" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div role="group" aria-label="Sipariş kartı yoğunluğu" style={{ display: 'inline-flex', padding: 3, gap: 2, borderRadius: 8, background: 'var(--surface-3)' }}>
              {([['comfortable', 'Rahat'], ['compact', 'Kompakt'], ['dense', 'Yoğun']] as const).map(([value, label]) => (
                <button className="orders-touch-target" key={value} type="button" aria-pressed={density === value} onClick={() => changeDensity(value)} style={{ height: 32, padding: '0 9px', border: 0, borderRadius: 6, background: density === value ? 'var(--surface)' : 'transparent', color: density === value ? 'var(--text)' : 'var(--text-3)', boxShadow: density === value ? 'var(--shadow-1)' : 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: density === value ? 650 : 500 }}>{label}</button>
              ))}
            </div>
            {closedCount > 0 && filter !== 'done' && filter !== 'cancelled' && (
              <button className="orders-touch-target" type="button" aria-expanded={!closedCollapsed} onClick={() => setClosedCollapsed(value => !value)} style={{ ...btnGhost(), height: 36 }}>
                {closedCollapsed ? <I.eye size={13} /> : <I.eyeOff size={13} />}
                {closedCollapsed ? `Kapananı göster (${closedCount})` : 'Kapananı gizle'}
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-4)' }}>Hazır bekleme alarmı: 5 dk</span>
          </div>
          {/* New-café hero: ONLY when today has zero orders at all (not when a
              search/filter merely matches nothing — that keeps the column view). */}
          {orders.length === 0 && (
            <div style={{
              marginBottom: 14, padding: '26px 20px', textAlign: 'center',
              background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: 'var(--surface-3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-2)', marginBottom: 10,
              }}><I.clipboard size={20} /></div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Bugün henüz sipariş yok</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>
                Müşterilerin QR menüden verdiği siparişler burada canlı görünür.
                Masa QR’larını Masalar &amp; QR bölümünden yazdırabilirsiniz.
              </div>
            </div>
          )}
          {orders.length > 0 && (filter !== 'all' || sourceFilter !== 'all' || search.trim() || selectedStation) && (
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7, minHeight: 28 }}>
              {filter !== 'all' && <Tag tone={filter === 'late' || filter === 'attention' ? 'warning' : 'neutral'}>{FILTER_LABELS[filter]} · {filteredOrders.length}</Tag>}
              {sourceFilter !== 'all' && <Tag tone="info">{ORDER_SOURCE_LABELS[sourceFilter]} · {filteredOrders.length}</Tag>}
              {search.trim() && <Tag>“{search.trim()}”</Tag>}
              {selectedStation && <Tag tone="info"><I.cutlery size={11} />{selectedStation}</Tag>}
              <button type="button" onClick={() => { setFilter('all'); setSourceFilter('all'); setSearch(''); setSelectedStation(null) }} style={{ ...btnGhost(), height: 26, border: 'none', background: 'transparent', color: 'var(--text-3)' }}>
                <I.close size={12} />Filtreleri temizle
              </button>
              <span style={{ marginLeft: 'auto', color: 'var(--text-4)', fontSize: 10.5 }}>J/K seç · / ara · Esc temizle</span>
            </div>
          )}
          {orders.length > 0 && filteredOrders.length === 0 && (
            <div role="status" style={{ marginBottom: 12, padding: '18px 16px', borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'var(--surface)', textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Bu görünümde sipariş yok</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)' }}>
                {search.trim()
                  ? 'Aramanızı değiştirin veya filtreleri temizleyin.'
                  : sourceFilter !== 'all'
                    ? `${ORDER_SOURCE_LABELS[sourceFilter]} kaynağında eşleşen sipariş bulunmuyor.`
                    : `${FILTER_LABELS[filter]} görünümünde eşleşen sipariş bulunmuyor.`}
              </div>
              <button type="button" onClick={() => { setFilter('all'); setSourceFilter('all'); setSearch(''); setSelectedStation(null) }} style={{ ...btnGhost(), marginTop: 10 }}>Filtreleri temizle</button>
            </div>
          )}
          <OrderBoardDnd
            columns={visibleColumns}
            filteredOrders={filteredOrders}
            orders={orders}
            tableLabels={tableLabels}
            selectedOrderId={selectedOrderId}
            onSelectOrder={(order) => setSelectedOrderId(order?.id ?? null)}
            onAdvance={handleAdvance}
            onMove={(order, target) => void moveOrder(order, target)}
            onActionError={showActionError}
            pendingOrderIds={pendingOrderIds}
            lateThresholdMin={lateThresholdMin}
            density={density}
          />
        </div>

        {presentation === 'desktop' && detailPanel}
      </div>

      {presentation !== 'desktop' && selectedOrder && !detailModalBlocked && (
        <AccessibleDialog
          labelledBy="order-detail-title"
          onClose={() => setSelectedOrderId(null)}
          className="orders-detail-overlay"
          style={{}}
        >
          {detailPanel}
        </AccessibleDialog>
      )}

      {presentation !== 'desktop' && filtersOpen && (
        <AccessibleDialog
          labelledBy="orders-filter-title"
          onClose={() => setFiltersOpen(false)}
          className="orders-filter-overlay"
          style={{}}
        >
          <div className="orders-filter-drawer">
            <OrdersNav filter={filter} setFilter={setFilter} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} orders={orders} search={search} setSearch={setSearch} onHistory={() => { setFiltersOpen(false); setHistoryOpen(true) }} onClose={() => setFiltersOpen(false)} lateThresholdMin={lateThresholdMin} searchInputRef={searchInputRef} now={now} stations={stations} selectedStation={selectedStation} setSelectedStation={setSelectedStation} />
          </div>
        </AccessibleDialog>
      )}

      {settleSheet && (
        <SettlementSheet
          restaurantId={restaurantId}
          session={settleSheet.session}
          tableLabel={settleSheet.label}
          zIndex={130}
          onClose={() => setSettleSheet(null)}
          onSettled={() => { /* realtime UPDATE stamps land live on the board */ }}
          onSessionClosed={() => setSettleSheet(null)}
        />
      )}

      {historyOpen && !receipt && (
        <HistoryModal
          restaurantId={restaurantId}
          tableLabels={tableLabels}
          onClose={closeHistory}
          onReceipt={(o, label) => setReceipt({ order: o as ReceiptOrder, tableLabel: label })}
        />
      )}
      {receipt && (
        <ReceiptModal
          order={receipt.order}
          restaurantName={restaurantName}
          tax={receiptTax ?? null}
          tableLabel={receipt.tableLabel}
          onClose={() => setReceipt(null)}
        />
      )}
      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          tableLabel={labelFor(cancelTarget.table_id)}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => void confirmCancel(cancelTarget, reason)}
          pending={pendingOrderIds.has(cancelTarget.id)}
        />
      )}
      {refundTarget && (
        <RefundOrderModal
          order={refundTarget}
          tableLabel={labelFor(refundTarget.table_id)}
          pending={refundPending}
          onClose={() => setRefundTarget(null)}
          onConfirm={async ({ amount, reason, requestId }) => {
            setRefundPending(true)
            try {
              const method = refundTarget.payment_method
              if (method !== 'cash' && method !== 'pos' && method !== 'iyzico') return
              const payload: {
                orderId: string; restaurantId: string; method: 'cash' | 'pos' | 'iyzico';
                amount: number; reason: string; requestId: string
              } = { orderId: refundTarget.id, restaurantId, method, amount, reason, requestId }
              const result = method === 'iyzico'
                ? await refundIyzicoOrder(payload)
                : await recordManualRefund(payload)
              if ('error' in result) {
                showActionError(result.error)
                return
              }
              setRefundTarget(null)
              showActionSuccess(`${formatCurrency(amount)} iade başarıyla kaydedildi.`)
            } catch {
              showActionError('İade kaydedilemedi; bağlantıyı kontrol edin.')
            } finally {
              setRefundPending(false)
            }
          }}
        />
      )}
      {transferOpen && <OrdersTransferDialog restaurantId={restaurantId} orders={orders} tables={tables} onClose={() => setTransferOpen(false)} onDone={() => setTransferDone(true)} />}
      {transferDone && <div role="status" style={{position:'fixed',right:18,bottom:18,zIndex:170,background:'var(--night)',color:'#fff',padding:'10px 13px',borderRadius:9}}>Hesap taşındı. <button className="orders-touch-target" type="button" onClick={()=>setTransferDone(false)} style={{border:0,background:'transparent',color:'#ffd089',fontWeight:700}}>Tamam</button></div>}
    </div>
  )
}

/* ============================================================
   CANCEL MODAL — payment-aware rules
   ============================================================ */
function CancelOrderModal({ order, tableLabel, onClose, onConfirm, pending }: {
  order: Order
  tableLabel: string
  onClose: () => void
  onConfirm: (reason: string) => void
  pending: boolean
}) {
  const [reason, setReason] = useState('')
  // cash/pos-PAID cancel = money was collected and is being refunded in person →
  // the reason is REQUIRED (recorded as cancel_reason + cancelled_by). Unpaid →
  // reason optional. İyzico never reaches this modal (blocked upstream).
  const paidManual = order.paid_at !== null && (order.payment_method === 'cash' || order.payment_method === 'pos')
  const reasonOk = !paidManual || reason.trim().length >= 3

  return (
    <AccessibleDialog
      labelledBy="cancel-order-title"
      onClose={onClose}
      closeDisabled={pending}
      className="orders-cancel-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(17,17,19,.42)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div aria-busy={pending} style={{
        width: 'min(420px, 94vw)', background: 'var(--surface)', borderRadius: 14,
        boxShadow: 'var(--shadow-pop)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--divider)' }}>
          <div id="cancel-order-title" style={{ fontSize: 15, fontWeight: 700 }}>Siparişi iptal et</div>
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
            disabled={pending}
            onChange={(e) => setReason(e.target.value)}
            placeholder={paidManual ? 'İptal gerekçesi (zorunlu)' : 'Gerekçe (opsiyonel)'}
            data-modal-initial-focus
            style={{
              width: '100%', height: 44, padding: '0 11px', fontSize: 12.5,
              border: `1px solid ${paidManual && !reasonOk ? 'var(--warning)' : 'var(--border-strong)'}`,
              borderRadius: 8, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8 }}>
          <button type="button" disabled={pending} onClick={onClose} style={{ ...btnGhost(), flex: 1, minHeight: 44, justifyContent: 'center', opacity: pending ? 0.6 : 1 }}>Vazgeç</button>
          <button
            type="button"
            disabled={!reasonOk || pending}
            onClick={() => reasonOk && onConfirm(reason.trim())}
            style={{
              ...btnPrimary(), flex: 1, minHeight: 44, justifyContent: 'center',
              background: 'var(--critical)', borderColor: 'var(--critical)',
              opacity: reasonOk && !pending ? 1 : 0.5, cursor: pending ? 'wait' : reasonOk ? 'pointer' : 'not-allowed',
            }}
          >
            {pending ? 'İptal ediliyor…' : 'İptal et'}
          </button>
        </div>
      </div>
    </AccessibleDialog>
  )
}

function RefundOrderModal({ order, tableLabel, onClose, onConfirm, pending }: {
  order: Order
  tableLabel: string
  onClose: () => void
  onConfirm: (input: { amount: number; reason: string; requestId: string }) => void
  pending: boolean
}) {
  const [amountText, setAmountText] = useState(order.total.toFixed(2).replace('.', ','))
  const [reason, setReason] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const amount = Number(amountText.replace(',', '.'))
  const valid = Number.isFinite(amount) && amount > 0 && amount <= order.total
    && Math.round(amount * 100) === amount * 100 && reason.trim().length >= 3
  const isProvider = order.payment_method === 'iyzico'

  return (
    <AccessibleDialog
      labelledBy="refund-order-title"
      onClose={onClose}
      closeDisabled={pending}
      style={{
        position: 'fixed', inset: 0, zIndex: 125, background: 'rgba(17,17,19,.42)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div aria-busy={pending} style={{ width: 'min(430px, 94vw)', background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--shadow-pop)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--divider)' }}>
          <div id="refund-order-title" style={{ fontSize: 15, fontWeight: 700 }}>Parasal iade</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            {tableLabel} · #{order.id.slice(0, 6).toUpperCase()} · en çok {formatCurrency(order.total)}
          </div>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: isProvider ? 'var(--info)' : 'var(--warning)', background: isProvider ? 'var(--info-bg)' : 'var(--warning-bg)', borderRadius: 8, padding: '9px 11px', lineHeight: 1.45 }}>
            {isProvider
              ? 'İade İyzico’ya gönderilir. Ledger yalnız sağlayıcının imzalı başarılı cevabından sonra tamamlanır; belirsiz yanıtta tekrar gönderim kilitlenir.'
              : `Bu alan yalnız ${order.payment_method === 'cash' ? 'elden nakit' : 'fiziksel POS'} iadesi gerçekten tamamlandıktan sonra kaydedilmelidir.`}
          </div>
          <label style={{ fontSize: 11.5, fontWeight: 600 }}>
            İade tutarı (₺)
            <input
              data-modal-initial-focus
              inputMode="decimal"
              disabled={pending}
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              style={{ width: '100%', height: 44, marginTop: 5, padding: '0 11px', border: '1px solid var(--border-strong)', borderRadius: 8, boxSizing: 'border-box' }}
            />
          </label>
          <label style={{ fontSize: 11.5, fontWeight: 600 }}>
            Gerekçe
            <input
              disabled={pending}
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
              placeholder="En az 3 karakter"
              style={{ width: '100%', height: 44, marginTop: 5, padding: '0 11px', border: '1px solid var(--border-strong)', borderRadius: 8, boxSizing: 'border-box' }}
            />
          </label>
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8 }}>
          <button type="button" disabled={pending} onClick={onClose} style={{ ...btnGhost(), flex: 1, minHeight: 44, justifyContent: 'center' }}>Vazgeç</button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => valid && onConfirm({ amount, reason: reason.trim(), requestId })}
            style={{ ...btnPrimary(), flex: 1, minHeight: 44, justifyContent: 'center', opacity: valid && !pending ? 1 : 0.5 }}
          >
            {pending ? 'İade işleniyor…' : isProvider ? 'İyzico’ya iade et' : 'İadeyi kaydet'}
          </button>
        </div>
      </div>
    </AccessibleDialog>
  )
}
