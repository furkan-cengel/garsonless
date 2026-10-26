'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PencilLine } from 'lucide-react'
import { AppIcons } from '@garsonless/ui/icons'
import { fetchTableDetail, type TableDetail } from '../../lib/actions/tables'
import type { OpenTableSessionView, PendingTableRequestView, TableItem } from './tables-builder-types'
import { formatTableMoney as money, sessionDuration, TABLE_LATE_AFTER_MINUTES, tableOperationalState, type TableOperationalState } from './tables-operation-model'
import { TablePropertiesDialog } from './TablePropertiesDialog'
import { TableStatusBadge } from './TableStatusBadge'

const ORDER_PERMISSION_NOTE = 'Sipariş açma yetkin yok; restoran sahibi bu yetkiyi verebilir. Masayı görebilir ve servis isteklerini tamamlayabilirsin.'

/** What the state asks of staff right now; an ordinary open bill needs no note. */
function stateNote(state: TableOperationalState, elapsedMinutes: number): { tone: string; text: string } | null {
  if (state === 'late') return { tone: 'critical', text: `Bu adisyon ${TABLE_LATE_AFTER_MINUTES} dk eşiğini ${Math.max(1, elapsedMinutes - TABLE_LATE_AFTER_MINUTES)} dk aştı. Masayla ilgilen ya da tahsilata geç.` }
  if (state === 'stale') return { tone: 'warning', text: 'Bu adisyon önceki iş gününde açıldı ve hâlâ kapanmadı. Tahsil edip kapatmayı unutma.' }
  if (state === 'paid') return { tone: 'positive', text: 'Ödemenin tamamı alındı. Masayı yeni misafire açmak için adisyonu kapat.' }
  if (state === 'new') return { tone: 'info', text: `Masa ${elapsedMinutes} dk önce açıldı; henüz sipariş gelmedi.` }
  return null
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
  onRename,
  onDelete,
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
  onRename?: (input: { label: string; floorLabel: string; areaLabel: string }) => Promise<string | null>
  onDelete?: () => Promise<string | null>
}) {
  const [properties, setProperties] = useState<'edit' | 'delete' | null>(null)
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(session))
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selecting, setSelecting] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const sessionId = session?.sessionId
  const loadedSession = useRef<string | undefined>(undefined)
  const state = tableOperationalState(session, now)
  const collected = session ? Math.max(0, session.total - session.unpaidTotal + session.splitSettledTotal) : 0
  const remaining = session ? Math.max(0, session.unpaidTotal - session.splitSettledTotal) : 0
  const canClose = Boolean(session && remaining === 0 && session.splitDeclaredCashTotal === 0 && !session.hasUnfinished)
  const closeReason = remaining > 0
    ? 'Kalan tutar tahsil edilince adisyonu kapatabilirsin.'
    : session?.splitDeclaredCashTotal
      ? 'Bekleyen nakit beyanını onaylayınca adisyonu kapatabilirsin.'
      : session?.hasUnfinished
        ? 'Tamamlanmamış siparişler bitince adisyonu kapatabilirsin.'
        : null
  const elapsedMinutes = session ? Math.max(0, Math.floor((now - Date.parse(session.openedAt)) / 60_000)) : 0
  const note = session ? stateNote(state, elapsedMinutes) : null
  const location = [table.floorLabel, table.areaLabel].filter(Boolean).join(' · ') || 'Konum atanmamış'

  useEffect(() => {
    setSelecting(false)
    setSelectedOrderIds(new Set())
    setDetail(null)
    loadedSession.current = undefined
  }, [restaurantId, sessionId, table.id])

  useEffect(() => {
    if (!sessionId) {
      setDetail(null)
      setLoading(false)
      setError(null)
      return
    }
    let active = true
    setLoading(loadedSession.current !== sessionId)
    setError(null)
    void fetchTableDetail(restaurantId, table.id)
      .then((result) => {
        if (!active) return
        if ('error' in result) {
          setError(result.error)
        } else {
          loadedSession.current = sessionId
          setDetail(result)
          setSelectedOrderIds((current) => new Set([...current].filter((id) => result.orders.some((order) => order.id === id))))
        }
      })
      .catch(() => {
        if (active) setError('Adisyon detayları yüklenemedi. Lütfen tekrar deneyin.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [reloadKey, restaurantId, sessionId, session, table.id])

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
          <TableStatusBadge state={state} full />
          <h2 id="table-detail-title">{table.label}</h2>
          <span>{location} · {table.seatCount} kişilik</span>
        </div>
        <button data-modal-initial-focus type="button" aria-label={`${table.label} detayını kapat`} onClick={onClose}><AppIcons.close size={16} /></button>
      </header>

      <div className="tb-detail-panel__scroll">
        {session ? (
          <>
            {note && <p role="note" className={`tb-detail-panel__note is-${note.tone}`}>{note.text}</p>}
            <dl className="tb-detail-panel__stats" aria-label="Adisyon özeti">
              <div><dt>Açık süre</dt><dd className={state === 'late' ? 'is-critical' : ''}>{sessionDuration(session.openedAt, now)}</dd></div>
              <div><dt>Toplam</dt><dd>{money(session.total)}</dd></div>
              <div><dt>Tahsil edilen</dt><dd className="is-positive">{money(collected)}</dd></div>
              <div><dt>Kalan</dt><dd className={remaining > 0 ? 'is-critical' : 'is-positive'}>{money(remaining)}</dd></div>
            </dl>
          </>
        ) : (
          <div className="tb-detail-panel__idle">
            {canCreateOrders
              ? <button type="button" className="tb-detail-panel__start" onClick={onNewOrder}><AppIcons.plus size={16} />Sipariş başlat</button>
              : <>
                <button type="button" className="tb-detail-panel__start is-locked" aria-disabled="true" aria-describedby="table-detail-permission"><AppIcons.lock size={15} />Sipariş başlat</button>
                <span id="table-detail-permission" className="tb-detail-panel__hint is-left">{ORDER_PERMISSION_NOTE}</span>
              </>}
            <section className="tb-detail-panel__qr" aria-labelledby="table-detail-qr-title">
              <span aria-hidden="true"><AppIcons.qr size={28} /></span>
              <div>
                <h3 id="table-detail-qr-title">Masa QR’ı</h3>
                <span className="tb-detail-panel__code">#{table.slug}</span>
                <Link href={`/dashboard/${restaurantId}/tables/qr`}>QR Studio’da aç</Link>
              </div>
            </section>
            {(onRename || onDelete) && (
              <section className="tb-detail-panel__settings" aria-label="Masa ayarları">
                {onRename && <button type="button" onClick={() => setProperties('edit')}><PencilLine size={14} aria-hidden="true" />Ad, kat ve alan</button>}
                {onDelete && <button type="button" className="is-destructive" onClick={() => setProperties('delete')}><AppIcons.trash size={14} />Masayı sil</button>}
              </section>
            )}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <section className="tb-detail-panel__requests" aria-labelledby="table-detail-requests-title">
            <h3 id="table-detail-requests-title" className="sr-only">Servis istekleri</h3>
            {pendingRequests.map((request) => (
              <div key={request.id}><span><AppIcons.bell size={13} />{request.label}</span><button type="button" onClick={() => onResolveRequest(request.id)}>Tamamla</button></div>
            ))}
          </section>
        )}

        {session && (
          <section className="tb-detail-panel__orders" aria-labelledby="table-detail-orders-title">
            <div className="tb-detail-panel__section-heading">
              <div><h3 id="table-detail-orders-title">Adisyon</h3><span>{detail?.orders.length ?? session.orderCount} sipariş</span></div>
              {canCreateOrders && detail && detail.orders.length > 0 && (
                <button type="button" aria-pressed={selecting} onClick={() => { setSelecting((value) => !value); setSelectedOrderIds(new Set()) }}>
                  {selecting ? 'Seçimi kapat' : 'Taşımak için seç'}
                </button>
              )}
            </div>
            {/* The summary above comes from live data; only the item rows wait or fail here, and settling keeps working. */}
            {loading && (
              <div className="tb-detail-panel__loading" role="status">
                <span>Ürünler yükleniyor…</span>
                <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
              </div>
            )}
            {error && (
              <div className="tb-detail-panel__error" role="alert">
                <span><strong>Ürün satırları yüklenemedi.</strong> Toplam tutar güncel; ürün listesini yeniden getirmeyi dene.</span>
                <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Tekrar dene</button>
              </div>
            )}
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

      {session && (
        <footer className="tb-detail-panel__actions">
          {selecting ? (
            <div className="tb-detail-panel__action-row">
              <button type="button" onClick={() => { setSelecting(false); setSelectedOrderIds(new Set()) }}>Vazgeç</button>
              <button type="button" className="is-primary" disabled={selectedOrderIds.size === 0} onClick={() => onTransferOrders([...selectedOrderIds])}>Ürünleri seç ({selectedOrderIds.size})</button>
            </div>
          ) : (
            <>
              {!canCreateOrders && <span className="tb-detail-panel__hint">{ORDER_PERMISSION_NOTE}</span>}
              {canCreateOrders && (
                <div className="tb-detail-panel__action-row">
                  <button type="button" onClick={onNewOrder}><AppIcons.plus size={14} />Ürün ekle</button>
                  <button type="button" onClick={onTransferAll}><AppIcons.arrow size={14} />Ürün / hesap taşı</button>
                </div>
              )}
              {canClose
                ? <button type="button" className="tb-detail-panel__main is-positive" onClick={onCloseSession}><AppIcons.check size={16} />Adisyonu kapat ve masayı boşalt</button>
                : <button type="button" className="tb-detail-panel__main is-primary" onClick={onSettle}><AppIcons.card size={16} />{remaining > 0 ? `Tahsilat · ${money(remaining)}` : 'Tahsilat'}</button>}
              {closeReason && <span className="tb-detail-panel__hint">{closeReason}</span>}
            </>
          )}
        </footer>
      )}
      {properties && <TablePropertiesDialog
        table={table}
        allowDelete={!session && Boolean(onDelete)}
        initialDelete={properties === 'delete'}
        onClose={() => setProperties(null)}
        onSave={(value) => onRename ? onRename(value) : Promise.resolve(null)}
        onDelete={() => onDelete ? onDelete() : Promise.resolve(null)}
      />}
    </div>
  )
}
