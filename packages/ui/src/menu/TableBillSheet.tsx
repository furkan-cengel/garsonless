'use client'

import { useEffect, useId, useRef } from 'react'
import { formatTRY } from './formatCurrency'
import { WaiterCallButton, type WaiterCallState } from './WaiterCallButton'

export interface BillOrder {
  id: string
  status: string
  total: number
  paidAt: string | null
  createdAt: string
  itemCount: number
}

interface TableBillSheetProps {
  orders: BillOrder[]
  openedAt: string | null
  /** Session was closed by the restaurant while viewing. */
  closedNotice: boolean
  refreshing: boolean
  onClose: () => void
  onCallWaiter?: () => void
  waiterCallState?: WaiterCallState
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  pending_approval: 'Onay bekliyor',
  sent_to_kitchen: 'Mutfakta',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  served: 'Servis edildi',
  paid: 'Servis edildi',
  cancelled: 'İptal',
}

const LINE = 'rgba(0,0,0,0.08)'
const SURFACE = 'var(--p-card, #ffffff)'

const KEYFRAMES = `
@keyframes tbs-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.tbs-sheet { animation: tbs-sheet-up 320ms cubic-bezier(.3,.8,.3,1) both; }
@media (prefers-reduced-motion: reduce) { .tbs-sheet { animation: none; } }
`

export function TableBillSheet({ orders, openedAt, closedNotice, refreshing, onClose, onCallWaiter, waiterCallState = 'idle' }: TableBillSheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const active = orders.filter((o) => o.status !== 'cancelled')
  const total = active.reduce((sum, o) => sum + o.total, 0)
  const paid = active.filter((o) => o.paidAt !== null).reduce((sum, o) => sum + o.total, 0)
  const unpaid = total - paid

  const openedText = openedAt
    ? new Date(openedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [])
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        event.preventDefault()
        sheetRef.current?.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [])

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 48, background: 'rgba(15,23,42,0.42)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="tbs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 49,
          maxHeight: '82dvh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--p-bg)',
          borderRadius: '22px 22px 0 0',
          overflow: 'hidden',
          fontFamily: 'var(--p-body)',
        }}
      >
        {/* header */}
        <div style={{ padding: '14px 18px 12px', background: SURFACE, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
            <div style={{ height: 4, width: 42, borderRadius: 9999, background: 'rgba(15,23,42,.16)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 id={titleId} style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--p-text)' }}>Masa Hesabı</h2>
              <p id={descriptionId} style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--p-text-2)' }}>
                {closedNotice
                  ? 'Adisyon kapatıldı'
                  : openedText
                    ? `${openedText}'den beri açık · ${orders.length} sipariş`
                    : `${orders.length} sipariş`}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Masa hesabını kapat"
              onClick={onClose}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: `1px solid ${LINE}`,
                background: SURFACE, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="var(--p-text-2)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {closedNotice && (
          <div role="status" aria-live="polite" style={{
            margin: '12px 18px 0', padding: '10px 14px', borderRadius: 12,
            background: 'var(--p-accent-soft)', color: 'var(--p-accent)',
            fontSize: 13, fontWeight: 600,
          }}>
            Bu adisyon restoran tarafından kapatıldı. Yeni siparişler yeni bir hesap açar.
          </div>
        )}

        {/* orders */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {refreshing && orders.length === 0 ? (
            <p role="status" aria-live="polite" style={{ fontSize: 13, color: 'var(--p-text-2)', textAlign: 'center', padding: 24 }}>Yükleniyor…</p>
          ) : orders.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--p-text-2)', textAlign: 'center', padding: 24 }}>
              Bu masada henüz sipariş yok.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map((order) => {
                const cancelled = order.status === 'cancelled'
                return (
                  <div key={order.id} style={{
                    background: SURFACE, borderRadius: 14, border: `1px solid ${LINE}`,
                    padding: '12px 14px', opacity: cancelled ? 0.55 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p-text)' }}>
                        #{order.id.slice(-4).toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: cancelled ? 'rgba(0,0,0,0.06)' : 'var(--p-accent-soft)',
                        color: cancelled ? 'var(--p-text-2)' : 'var(--p-accent)',
                      }}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      {order.paidAt !== null && !cancelled && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, letterSpacing: '.04em',
                          padding: '2px 7px', borderRadius: 99,
                          background: 'var(--p-accent-soft)', color: 'var(--p-accent)',
                        }}>ÖDENDİ</span>
                      )}
                      <span style={{
                        marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: 'var(--p-text)',
                        textDecoration: cancelled ? 'line-through' : 'none',
                      }}>
                        {formatTRY(order.total)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--p-text-2)', marginTop: 4 }}>
                      {new Date(order.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      {order.itemCount > 0 ? ` · ${order.itemCount} ürün` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* totals */}
        <div style={{
          flexShrink: 0, padding: '14px 18px calc(14px + env(safe-area-inset-bottom, 12px))',
          background: SURFACE, borderTop: `1px solid ${LINE}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: 'var(--p-text-2)' }}>Ödenen</span>
            <span style={{ fontWeight: 700, color: 'var(--p-accent)' }}>{formatTRY(paid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: 'var(--p-text-2)' }}>Ödenecek</span>
            <span style={{ fontWeight: 700, color: 'var(--p-text)' }}>{formatTRY(unpaid)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 10, borderTop: `1px solid ${LINE}`,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--p-text)' }}>Masa Toplamı</span>
            <span style={{ fontSize: 20, fontWeight: 850, color: 'var(--p-text)' }}>{formatTRY(total)}</span>
          </div>
          {onCallWaiter && !closedNotice && (
            <div style={{ marginTop: 12 }}>
              <WaiterCallButton state={waiterCallState} onCall={onCallWaiter} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
