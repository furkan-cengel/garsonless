'use client'

import { useEffect, useState } from 'react'
import { InlineSpinner } from '@garsonless/ui'
import { AppIcons } from '@garsonless/ui/icons'
import { fetchTableDetail, type TableDetail } from '../../lib/actions/tables'
import type { OpenTableSessionView, PendingTableRequestView, TableItem } from './tables-builder-types'
import { sessionDuration, TABLE_OPERATIONAL_COPY, tableOperationalState } from './tables-operation-model'

function money(value: number) {
  return `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
}

function paymentLabel(method: string | null) {
  if (method === 'cash') return 'Nakit'
  if (method === 'pos') return 'POS'
  if (method === 'iyzico') return 'Online'
  if (method === 'comp') return 'İkram'
  if (method === 'split') return 'Bölüşümlü'
  return 'Bekliyor'
}

export function TableDetailPanel({
  restaurantId,
  table,
  session,
  pendingRequests,
  now,
  canCreateOrders,
  onClose,
  onNewOrder,
  onTransferOrders,
  onTransferAll,
  onSettle,
  onCloseSession,
  onResolveRequest,
}: {
  restaurantId: string
  table: TableItem
  session: OpenTableSessionView | undefined
  pendingRequests: PendingTableRequestView[]
  now: number
  canCreateOrders: boolean
  onClose: () => void
  onNewOrder: () => void
  onTransferOrders: (orderIds: string[]) => void
  onTransferAll: () => void
  onSettle: () => void
  onCloseSession: () => void
  onResolveRequest: (requestId: string) => void
}) {
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(session))
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selecting, setSelecting] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const state = tableOperationalState(session, now)
  const collected = session ? Math.max(0, session.total - session.unpaidTotal + session.splitSettledTotal) : 0
  const remaining = session ? Math.max(0, session.unpaidTotal - session.splitSettledTotal) : 0
  const canClose = Boolean(session && remaining === 0 && session.splitDeclaredCashTotal === 0 && !session.hasUnfinished)
  const closeReason = remaining > 0
    ? 'Önce kalan tutarı tahsil edin.'
    : session?.splitDeclaredCashTotal
      ? 'Bekleyen nakit beyanını önce onaylayın.'
      : session?.hasUnfinished
        ? 'Tamamlanmamış siparişler varken adisyon kapatılamaz.'
        : null

  useEffect(() => {
    setSelecting(false)
    setSelectedOrderIds(new Set())
    if (!session) {
      setDetail(null)
      setLoading(false)
      setError(null)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    void fetchTableDetail(restaurantId, table.id)
      .then((result) => {
        if (!active) return
        if ('error' in result) {
          setError(result.error)
          setDetail(null)
        } else {
          setDetail(result)
        }
      })
      .catch(() => {
        if (active) setError('Adisyon detayları yüklenemedi. Lütfen tekrar deneyin.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [reloadKey, restaurantId, session, table.id])

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  return (
    <div className="tb-detail-panel">
      <header className="tb-detail-panel__header">
        <div>
          <span className={`tb-detail-panel__state is-${state}`}><i />{TABLE_OPERATIONAL_COPY[state]}</span>
          <strong id="table-detail-title">{table.label}</strong>
          <span>{[table.floorLabel, table.areaLabel].filter(Boolean).join(' · ') || 'Konum atanmamış'}</span>
        </div>
        <button data-modal-initial-focus type="button" aria-label={`${table.label} detayını kapat`} onClick={onClose}><AppIcons.close size={16} /></button>
      </header>

      <div className="tb-detail-panel__scroll">
        {session ? (
          <section className="tb-detail-panel__stats" aria-label="Adisyon özeti">
            <div><span>Açık süre</span><strong>{sessionDuration(session.openedAt, now)}</strong></div>
            <div><span>Toplam</span><strong>{money(session.total)}</strong></div>
            <div><span>Tahsilat</span><strong className="is-positive">{money(collected)}</strong></div>
            <div><span>Kalan</span><strong className={remaining > 0 ? 'is-critical' : 'is-positive'}>{money(remaining)}</strong></div>
          </section>
        ) : (
          <section className="tb-detail-panel__empty">
            <span><AppIcons.chair size={24} /></span>
            <strong>Masa boş</strong>
            <p>Açık adisyon yok. QR siparişi bekleyebilir veya personel yeni sipariş başlatabilir.</p>
          </section>
        )}

        {pendingRequests.length > 0 && (
          <section className="tb-detail-panel__requests" aria-labelledby="table-detail-requests-title">
            <h3 id="table-detail-requests-title">Servis istekleri</h3>
            {pendingRequests.map((request) => (
              <div key={request.id}><span><AppIcons.bell size={13} />{request.label}</span><button type="button" onClick={() => onResolveRequest(request.id)}>Tamamla</button></div>
            ))}
          </section>
        )}

        {session && (
          <section className="tb-detail-panel__orders" aria-labelledby="table-detail-orders-title">
            <div className="tb-detail-panel__section-heading">
              <div><h3 id="table-detail-orders-title">Adisyon ürünleri</h3><span>{detail?.orders.length ?? session.orderCount} sipariş</span></div>
              {canCreateOrders && detail && detail.orders.length > 0 && (
                <button type="button" aria-pressed={selecting} onClick={() => { setSelecting((value) => !value); setSelectedOrderIds(new Set()) }}>
                  {selecting ? 'Seçimi kapat' : 'Taşımak için seç'}
                </button>
              )}
            </div>
            {loading && <div className="tb-detail-panel__loading" role="status"><InlineSpinner size={14} />Adisyon yükleniyor…</div>}
            {error && <div className="tb-detail-panel__error" role="alert">{error}<button type="button" onClick={() => setReloadKey((value) => value + 1)}>Tekrar dene</button></div>}
            {!loading && !error && detail?.orders.length === 0 && <div className="tb-detail-panel__empty-row">Ürün satırı bulunamadı.</div>}
            {!loading && detail?.orders.map((order, orderIndex) => {
              const selected = selectedOrderIds.has(order.id)
              return (
                <article key={order.id} className={`tb-detail-order${selected ? ' is-selected' : ''}`}>
                  <header>
                    {selecting && <input type="checkbox" aria-label={`${orderIndex + 1}. siparişi seç`} checked={selected} onChange={() => toggleOrder(order.id)} />}
                    <div><strong>{orderIndex + 1}. sipariş</strong><span>{new Date(order.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></div>
                    <span className={order.paidAt ? 'is-paid' : ''}>{order.paidAt ? paymentLabel(order.paymentMethod) : 'Açık'}</span>
                    <strong>{money(order.total)}</strong>
                  </header>
                  <div className="tb-detail-order__items">
                    {order.items.map((item) => (
                      <div key={item.id} className="tb-detail-item">
                        <span aria-label={`${item.quantity} adet`}>{item.quantity}×</span>
                        <div>
                          <strong>{item.name}</strong>
                          {item.modifiers.length > 0 && <span><b>Seçimler:</b> {item.modifiers.join(' · ')}</span>}
                          {item.removedIngredients.length > 0 && <span className="is-removed"><b>Çıkarılanlar:</b> {item.removedIngredients.join(', ')}</span>}
                          {item.productNote && <span className="is-note"><b>Ürün notu:</b> {item.productNote}</span>}
                          <small>{money(item.unitPrice)} / adet</small>
                        </div>
                        <strong>{money(item.total)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
            {selecting && <p className="tb-detail-panel__selection-note">Siparişleri önceden seçin; açılan pencerede ürün ve taşınacak adetleri ayrı ayrı düzenleyebilirsiniz.</p>}
          </section>
        )}
      </div>

      <footer className="tb-detail-panel__actions">
        {!session ? (
          canCreateOrders && <button type="button" className="is-primary" onClick={onNewOrder}><AppIcons.plus size={14} />Sipariş başlat</button>
        ) : selecting ? (
          <>
            <button type="button" onClick={() => { setSelecting(false); setSelectedOrderIds(new Set()) }}>Vazgeç</button>
            <button type="button" className="is-primary" disabled={selectedOrderIds.size === 0} onClick={() => onTransferOrders([...selectedOrderIds])}>Ürünleri seç ({selectedOrderIds.size})</button>
          </>
        ) : (
          <>
            {canCreateOrders && <button type="button" onClick={onTransferAll}><AppIcons.arrow size={14} />Ürün / hesap taşı</button>}
            {canCreateOrders && <button type="button" onClick={onNewOrder}><AppIcons.plus size={14} />Ürün ekle</button>}
            <button type="button" className="is-primary" onClick={onSettle}><AppIcons.card size={14} />Tahsilat</button>
            <button type="button" disabled={!canClose} title={closeReason ?? undefined} onClick={onCloseSession}><AppIcons.check size={14} />Adisyonu kapat</button>
          </>
        )}
      </footer>
    </div>
  )
}
