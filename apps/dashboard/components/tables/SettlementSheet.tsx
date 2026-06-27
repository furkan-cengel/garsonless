'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { InlineSpinner } from '@garsonless/ui'
import { settleOrder, getSessionSettlement } from '../../lib/actions/settlement'
import type { SettlementOrder } from '../../lib/actions/settlement'
import { closeTableSession } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { paymentMethodBadge } from '../../lib/payment-method'

type Method = 'cash' | 'pos' | 'comp'

const METHOD_BUTTONS: { method: Method; label: string; bg: string; fg: string }[] = [
  { method: 'cash', label: 'Nakit', bg: '#e6f4ec', fg: '#137a4d' },
  { method: 'pos', label: 'Fiziksel POS', bg: '#e8eef6', fg: '#2c5282' },
  { method: 'comp', label: 'İkram', bg: '#f3e8ff', fg: '#7c3aed' },
]

const fmt = (n: number) => `₺${n.toLocaleString('tr-TR')}`

function MethodBadge({ order }: { order: SettlementOrder }) {
  const b = paymentMethodBadge(order.paymentMethod)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '.03em',
        color: b.fg, background: b.bg, padding: '3px 8px', borderRadius: 999,
        ...(b.isComp ? { border: `1px dashed ${b.fg}` } : null),
      }}>
        {b.isComp ? `${b.label} · ₺0` : b.label}
      </span>
      {order.settledByLabel && (
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>· {order.settledByLabel}</span>
      )}
    </span>
  )
}

/**
 * Close-flow settlement sheet. Opens when an adisyon with unpaid money is being
 * closed: each unpaid order gets [Nakit][Fiziksel POS][İkram], plus a bulk
 * "tümünü Nakit/POS" shortcut for the single-method case. Settling the last
 * unpaid order auto-closes the session (P1) → the sheet closes. A de-emphasized
 * "Ödenmeden kapat (anormal)" records a reason and leaves the money unpaid.
 */
export default function SettlementSheet({
  restaurantId, session, tableLabel, onClose, onSettled, onSessionClosed,
}: {
  restaurantId: string
  session: OpenSessionInfo
  tableLabel: string
  onClose: () => void
  /** Refresh parent session totals after any settle (without closing the sheet). */
  onSettled: () => void
  /** The adisyon fully settled (auto-closed) or was abnormally closed. */
  onSessionClosed: () => void
}) {
  const [orders, setOrders] = useState<SettlementOrder[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    const res = await getSessionSettlement(session.sessionId, restaurantId)
    if ('error' in res) { setErr(res.error); return }
    setOrders(res.orders)
  }, [session.sessionId, restaurantId])

  useEffect(() => { void load() }, [load])

  const unpaid = (orders ?? []).filter((o) => o.paidAt === null)
  const remaining = unpaid.reduce((sum, o) => sum + o.total, 0)
  const busy = busyId !== null || bulkBusy || closing

  // After a settle: refresh parent, re-read the sheet. Payment no longer
  // auto-closes the table (2026-06-27 decouple) — so once every order is settled,
  // the sheet (opened from the staff "Kapat" intent) FREES the table explicitly
  // via closeTableSession (fully-paid → normal close + credits the visit once).
  // İyzico/customer payment never reaches here, so a paid table the customer is
  // still at stays open and shows "Ödendi".
  const afterSettle = useCallback(async () => {
    onSettled()
    const res = await getSessionSettlement(session.sessionId, restaurantId)
    if ('error' in res) { setErr(res.error); return }
    setOrders(res.orders)
    if (res.orders.every((o) => o.paidAt !== null)) {
      const closeRes = await closeTableSession(session.sessionId, restaurantId)
      if ('error' in closeRes) { setErr(closeRes.error); return }
      onSessionClosed()
    }
  }, [session.sessionId, restaurantId, onSettled, onSessionClosed])

  const settleOne = useCallback(async (orderId: string, method: Method) => {
    setErr(null); setBusyId(orderId)
    const res = await settleOrder(orderId, restaurantId, method)
    setBusyId(null)
    if ('error' in res) { setErr(res.error); return }
    await afterSettle()
  }, [restaurantId, afterSettle])

  const settleAll = useCallback(async (method: Exclude<Method, 'comp'>) => {
    setErr(null); setBulkBusy(true)
    // Sequential: the last settle auto-closes the session (P1 race-safe close).
    for (const o of unpaid) {
      const res = await settleOrder(o.id, restaurantId, method)
      if ('error' in res) { setErr(res.error); break }
    }
    setBulkBusy(false)
    await afterSettle()
  }, [unpaid, restaurantId, afterSettle])

  const abnormalClose = useCallback(async () => {
    const reason = window.prompt(
      'Anormal kapatma (ödeme alınmadan). Sebep zorunlu — kayıt altına alınır:\n(örn. müşteri ödemeden ayrıldı, anlaşmazlık)',
    )
    if (!reason || !reason.trim()) return
    setErr(null); setClosing(true)
    const res = await closeTableSession(session.sessionId, restaurantId, { abnormalReason: reason })
    setClosing(false)
    if ('error' in res) { setErr(res.error); return }
    onSessionClosed()
  }, [session.sessionId, restaurantId, onSessionClosed])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      role="dialog"
      aria-modal="true"
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,17,19,.45)' }} onClick={busy ? undefined : onClose} />
      <div style={{
        position: 'relative', width: 'min(460px, 94vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--shadow-pop)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{tableLabel} · adisyon</div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', marginTop: 2 }}>
                {remaining > 0 ? <>Kalan: {fmt(remaining)} — nasıl tahsil edildi?</> : 'Adisyon tahsil edildi'}
              </div>
            </div>
            <button type="button" onClick={busy ? undefined : onClose} aria-label="Kapat" style={{
              border: 'none', background: 'transparent', color: 'var(--text-3)',
              fontSize: 18, lineHeight: 1, cursor: busy ? 'default' : 'pointer', padding: 2,
            }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {err && (
            <div style={{
              fontSize: 12, color: 'var(--critical)', background: 'var(--critical-bg)',
              padding: '8px 10px', borderRadius: 8, marginBottom: 10,
            }}>{err}</div>
          )}

          {orders === null ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)' }}>
              <InlineSpinner size={14} /> Yükleniyor…
            </div>
          ) : (
            <>
              {/* Bulk shortcut — only when multiple orders remain unpaid */}
              {unpaid.length > 1 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['cash', 'pos'] as const).map((m) => {
                    const b = METHOD_BUTTONS.find((x) => x.method === m)!
                    return (
                      <button key={m} type="button" disabled={busy} onClick={() => void settleAll(m)} style={{
                        flex: 1, height: 34, borderRadius: 8, cursor: busy ? 'default' : 'pointer',
                        border: `1px solid ${b.fg}`, background: b.bg, color: b.fg,
                        fontSize: 12, fontWeight: 700, opacity: busy ? 0.6 : 1,
                      }}>Tümünü {b.label}</button>
                    )
                  })}
                </div>
              )}

              {/* Per-order rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orders.map((o, i) => {
                  const paid = o.paidAt !== null
                  return (
                    <div key={o.id} style={{
                      border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
                      background: paid ? 'var(--surface-2)' : 'var(--surface)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                          Sipariş {i + 1}
                          <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500, marginLeft: 6 }}>
                            #{o.id.slice(0, 6).toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(o.total)}</div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {paid ? (
                          <MethodBadge order={o} />
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {METHOD_BUTTONS.map((b) => (
                              <button key={b.method} type="button" disabled={busy}
                                onClick={() => void settleOne(o.id, b.method)} style={{
                                  flex: 1, height: 32, borderRadius: 7, cursor: busy ? 'default' : 'pointer',
                                  border: `1px solid ${b.fg}`, background: b.bg, color: b.fg,
                                  fontSize: 11.5, fontWeight: 700,
                                  opacity: busy ? 0.6 : 1,
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                }}>
                                {busyId === o.id ? <InlineSpinner size={11} color={b.fg} /> : b.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — abnormal close, de-emphasized */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
          {remaining > 0 ? (
            <button type="button" disabled={busy} onClick={() => void abnormalClose()} style={{
              width: '100%', height: 32, borderRadius: 7, cursor: busy ? 'default' : 'pointer',
              border: '1px solid var(--border-strong)', background: 'transparent',
              color: 'var(--critical)', fontSize: 11.5, fontWeight: 600, opacity: busy ? 0.6 : 1,
            }}>
              {closing ? <><InlineSpinner size={11} color="var(--critical)" /> Kapatılıyor…</> : 'Ödenmeden kapat (anormal)'}
            </button>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center' }}>
              Tüm siparişler tahsil edildi — adisyon kapandı.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
