'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { InlineSpinner } from '@garsonless/ui'
import { settleOrder, getSessionSettlement } from '../../lib/actions/settlement'
import type { SettlementOrder, SettlementShare } from '../../lib/actions/settlement'
import { closeTableSession } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { confirmCashShare } from '../../lib/actions/split'

type Method = 'cash' | 'pos' | 'comp'

/* Method registry — İkram (comp) stays the app-wide dashed violet, ₺0 collected. */
const cashIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /></svg>
const cardIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /></svg>
const giftIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="9" width="17" height="11" rx="1.5" /><path d="M3.5 13h17M12 9v11M12 9S9.5 5 7.5 6.5 9 9 12 9Zm0 0s2.5-4 4.5-2.5S15 9 12 9Z" /></svg>

const METHODS: Record<Method, { id: Method; label: string; fg: string; bg: string; dot: string; icon: React.ReactNode; dashed?: boolean }> = {
  cash: { id: 'cash', label: 'Nakit', fg: '#137a4d', bg: '#e6f4ec', dot: '#137a4d', icon: cashIcon },
  pos:  { id: 'pos', label: 'Fiziksel POS', fg: '#2c5282', bg: '#e8eef6', dot: '#2c5282', icon: cardIcon },
  comp: { id: 'comp', label: 'İkram', fg: '#7c3aed', bg: '#f3e8ff', dot: '#7c3aed', icon: giftIcon, dashed: true },
}
const METHOD_LIST = [METHODS.cash, METHODS.pos, METHODS.comp]

const fmt = (n: number) => `₺${n.toLocaleString('tr-TR')}`
function durationLabel(openedAt: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000))
  if (mins < 60) return `${mins}dk açık`
  return `${Math.floor(mins / 60)}s ${mins % 60}dk açık`
}

const KEYFRAMES = `
.sm-mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; }
@keyframes sm-overlay { from { opacity: 0 } to { opacity: 1 } }
@keyframes sm-pop { from { opacity: 0; transform: translateY(12px) scale(.985) } to { opacity: 1; transform: none } }
@keyframes sm-ring { to { stroke-dashoffset: 0 } }
@keyframes sm-badge { 0% { transform: scale(.6); opacity: 0 } 60% { transform: scale(1.05) } 100% { transform: scale(1); opacity: 1 } }
@keyframes sm-count { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
`

/* ── one unpaid order's method picker (staged, no DB write) ── */
function MethodPicker({ value, disabled, onChange }: { value: Method | null; disabled: boolean; onChange: (m: Method) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
      {METHOD_LIST.map((m) => {
        const on = value === m.id
        return (
          <button key={m.id} type="button" disabled={disabled} onClick={() => onChange(m.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '9px 4px',
            borderRadius: 10, fontSize: 11.5, fontWeight: 600,
            color: on ? m.fg : 'var(--text-2)',
            background: on ? m.bg : 'var(--surface)',
            border: (on ? '1.5px' : '1px') + ' ' + (m.dashed && on ? 'dashed' : 'solid') + ' ' + (on ? m.dot : 'var(--border)'),
            boxShadow: on ? 'none' : 'var(--shadow-1)',
            cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
            transition: 'all .12s ease',
          }}>
            <span style={{ color: on ? m.fg : 'var(--text-3)' }}>{m.icon}</span>
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── success summary ── */
function DoneCard({ tableLabel, tally, collected, onDone, zIndex }: {
  tableLabel: string
  tally: Record<Method, number>
  collected: number
  onDone: () => void
  zIndex: number
}) {
  const lines = METHOD_LIST.filter((m) => tally[m.id] > 0)
  return (
    <div style={overlay(zIndex)}>
      <div style={{ ...modalBox, maxWidth: 392 }} onClick={(e) => e.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <div style={{ padding: '30px 24px 22px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 999, background: 'var(--positive-bg)', display: 'grid', placeItems: 'center', animation: 'sm-badge .45s cubic-bezier(.2,.8,.3,1.3) both' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="17" stroke="var(--positive)" strokeWidth="2.6" strokeDasharray="107" strokeDashoffset="107" style={{ animation: 'sm-ring .5s .15s ease forwards' }} />
                <path d="M12 20.5l5 5L29 14" stroke="var(--positive)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="28" strokeDashoffset="28" style={{ animation: 'sm-ring .35s .5s ease forwards' }} />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 16 }}>{tableLabel} kapatıldı</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>Adisyon tahsil edildi ve masa boşa alındı.</div>

          <div style={{ marginTop: 20, border: '1px solid var(--divider)', borderRadius: 14, overflow: 'hidden', textAlign: 'left' }}>
            {lines.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderBottom: i === lines.length - 1 ? 'none' : '1px solid var(--divider)' }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: m.bg, color: m.fg, display: 'grid', placeItems: 'center', ...(m.dashed ? { border: `1px dashed ${m.fg}` } : null) }}>{m.icon}</span>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{m.label}</span>
                <span className="sm-mono" style={{ fontSize: 13.5, fontWeight: 700, color: m.fg, fontVariantNumeric: 'tabular-nums' }}>{fmt(tally[m.id])}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', background: 'var(--surface-2)' }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>Nakit + POS tahsilat</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--positive)', fontVariantNumeric: 'tabular-nums' }}>{fmt(collected)}</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '0 20px 18px' }}>
          <button onClick={onDone} style={{ ...btnPrimary, width: '100%', background: 'var(--action)' }}>Bitti</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Close-flow settlement sheet — STAGE THEN COMMIT. Each unpaid order gets a
 * staged method locally (Nakit / Fiziksel POS / İkram); the running summary,
 * progress and tally update live. "Masayı kapat" commits every staged settle
 * (settleOrder, sequential) then frees the table (closeTableSession → normal
 * close + one visit credit). Already-paid orders (e.g. İyzico) are shown locked.
 * "Ödeme almadan kapat" requires a recorded reason → abnormal close (money stays
 * unpaid, no visit). İkram = comp = ₺0 collected, reported separately.
 */
export default function SettlementSheet({
  restaurantId, session, tableLabel, onClose, onSettled, onSessionClosed, zIndex = 60,
}: {
  restaurantId: string
  session: OpenSessionInfo
  tableLabel: string
  onClose: () => void
  onSettled: () => void
  onSessionClosed: () => void
  zIndex?: number
}) {
  const [orders, setOrders] = useState<SettlementOrder[] | null>(null)
  const [shares, setShares] = useState<SettlementShare[]>([])
  const [staged, setStaged] = useState<Record<string, Method>>({})
  const [err, setErr] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [confirmingShareId, setConfirmingShareId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [abnormal, setAbnormal] = useState(false)
  const [abnormalReason, setAbnormalReason] = useState('')

  const load = useCallback(async () => {
    const res = await getSessionSettlement(session.sessionId, restaurantId)
    if ('error' in res) { setErr(res.error); return }
    setOrders(res.orders)
    setShares(res.shares)
  }, [session.sessionId, restaurantId])
  useEffect(() => { void load() }, [load])

  const all = orders ?? []
  const isSplitMode = shares.length > 0 || all.some((o) => o.paymentMethod === 'split')
  const paid = all.filter((o) => o.paidAt !== null)
  const unpaid = all.filter((o) => o.paidAt === null)
  const total = all.reduce((s, o) => s + o.total, 0)
  const stagedCount = isSplitMode ? 0 : unpaid.filter((o) => staged[o.id]).length
  const assigned = paid.length + stagedCount
  const remaining = unpaid.filter((o) => !staged[o.id]).reduce((s, o) => s + o.total, 0)
  const allStaged = isSplitMode ? unpaid.length === 0 : unpaid.every((o) => Boolean(staged[o.id]))

  const settledShares = shares.filter((share) => share.status === 'settled')
  const declaredCashShares = shares.filter((share) => share.status === 'declared' && share.method === 'cash')
  const pendingCardShares = shares.filter((share) => share.status === 'declared' && share.method === 'iyzico')
  const settledShareTotal = settledShares.reduce((sum, share) => sum + share.amount, 0)
  const declaredCashTotal = declaredCashShares.reduce((sum, share) => sum + share.amount, 0)
  const pendingCardTotal = pendingCardShares.reduce((sum, share) => sum + share.amount, 0)
  const splitRemaining = Math.max(0, total - settledShareTotal)

  const tally: Record<Method, number> = { cash: 0, pos: 0, comp: 0 }
  for (const o of paid) { if (o.paymentMethod && o.paymentMethod !== 'iyzico' && o.paymentMethod !== 'split') tally[o.paymentMethod] += o.total }
  if (!isSplitMode) for (const o of unpaid) { const m = staged[o.id]; if (m) tally[m] += o.total }
  // İyzico-prepaid collected still counts toward the collected figure.
  const iyzicoPaid = paid.filter((o) => o.paymentMethod === 'iyzico').reduce((s, o) => s + o.total, 0)
  const splitCollected = settledShares.reduce((sum, share) => sum + share.amount, 0)
  const collected = tally.cash + tally.pos + iyzicoPaid + splitCollected

  const busy = committing
  const setMethod = (id: string, m: Method) =>
    setStaged((s) => (s[id] === m ? (() => { const n = { ...s }; delete n[id]; return n })() : { ...s, [id]: m }))
  const fillAll = (m: Method) => setStaged((s) => {
    const n = { ...s }; for (const o of unpaid) n[o.id] = m; return n
  })

  const confirmShare = useCallback(async (shareId: string) => {
    setErr(null)
    setConfirmingShareId(shareId)
    const res = await confirmCashShare(shareId, restaurantId)
    setConfirmingShareId(null)
    if ('error' in res) { setErr(res.error); void load(); return }
    void load()
    onSettled()
  }, [restaurantId, load, onSettled])

  const commit = useCallback(async () => {
    setErr(null); setCommitting(true)
    if (isSplitMode && unpaid.length > 0) {
      setErr('Bu adisyon split ödeme ile devam ediyor. Önce tüm paylar ödensin veya nakit beyanları garson tarafından onaylansın.')
      setCommitting(false)
      void load()
      return
    }
    for (const o of unpaid) {
      const m = staged[o.id]
      if (!m) continue
      const res = await settleOrder(o.id, restaurantId, m)
      if ('error' in res) { setErr(res.error); setCommitting(false); void load(); return }
    }
    const closeRes = await closeTableSession(session.sessionId, restaurantId)
    setCommitting(false)
    if ('error' in closeRes) { setErr(closeRes.error); void load(); return }
    onSettled()
    setDone(true)
  }, [isSplitMode, unpaid, staged, restaurantId, session.sessionId, load, onSettled])

  const confirmAbnormal = useCallback(async () => {
    const reason = abnormalReason.trim()
    if (!reason) return
    setErr(null); setCommitting(true)
    const res = await closeTableSession(session.sessionId, restaurantId, { abnormalReason: reason })
    setCommitting(false)
    if ('error' in res) { setErr(res.error); return }
    onSessionClosed()
  }, [abnormalReason, session.sessionId, restaurantId, onSessionClosed])

  if (done) {
    return <DoneCard tableLabel={tableLabel} tally={tally} collected={collected} onDone={onSessionClosed} zIndex={zIndex} />
  }

  const splitLineStyle = (tone: 'paid' | 'cash' | 'card' | 'open'): React.CSSProperties => {
    const palette = {
      paid: { bg: 'var(--positive-bg)', fg: 'var(--positive)', border: 'transparent' },
      cash: { bg: '#fff7ed', fg: '#b45309', border: '#fed7aa' },
      card: { bg: '#eef2ff', fg: '#4338ca', border: '#c7d2fe' },
      open: { bg: 'var(--surface-2)', fg: 'var(--text-2)', border: 'var(--divider)' },
    }[tone]
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 11,
      background: palette.bg,
      color: palette.fg,
      border: `1px solid ${palette.border}`,
    }
  }

  return (
    <div style={overlay(zIndex)} onClick={busy ? undefined : onClose} role="dialog" aria-modal="true">
      <div style={{ ...modalBox, maxWidth: 468 }} onClick={(e) => e.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

        {/* Header */}
        <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--divider)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{tableLabel} · Adisyonu kapat</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', marginTop: 4 }}>Tahsilatı tamamla</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{all.length} sipariş</span><span style={{ color: 'var(--border-strong)' }}>·</span>
              <span>{durationLabel(session.openedAt)}</span>
            </div>
          </div>
          <button type="button" onClick={busy ? undefined : onClose} aria-label="Kapat" style={iconBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ padding: 20, overflow: 'auto' }}>
          {err && (
            <div style={{ fontSize: 12, color: 'var(--critical)', background: 'var(--critical-bg)', padding: '9px 11px', borderRadius: 9, marginBottom: 14 }}>{err}</div>
          )}

          {orders === null ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-3)' }}><InlineSpinner size={16} /> Yükleniyor…</div>
          ) : (
            <>
              {/* Summary */}
              <div style={{ borderRadius: 16, background: allStaged ? 'var(--positive-bg)' : 'var(--surface-2)', border: '1px solid ' + (allStaged ? 'transparent' : 'var(--border)'), padding: '15px 17px', transition: 'background .25s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: allStaged ? 'var(--positive)' : 'var(--text-3)', fontWeight: 500 }}>
                      {isSplitMode
                        ? allStaged ? 'Split ödeme tamamlandı' : 'Split ödemede kalan'
                        : allStaged ? 'Tümü işaretlendi' : 'İşaretlenecek kalan'}
                    </div>
                    <div key={remaining} className="sm-mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1, marginTop: 3, color: allStaged ? 'var(--positive)' : 'var(--text)', fontVariantNumeric: 'tabular-nums', animation: 'sm-count .25s ease' }}>
                      {isSplitMode
                        ? allStaged ? fmt(settledShareTotal) : fmt(splitRemaining)
                        : allStaged ? fmt(collected) : fmt(remaining)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    <div>Toplam <span className="sm-mono" style={{ color: 'var(--text-2)', fontWeight: 600 }}>{fmt(total)}</span></div>
                    <div>{isSplitMode ? `${shares.length} pay · ${settledShares.length} onaylı` : `${assigned}/${all.length} sipariş işaretlendi`}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', marginTop: 13, background: 'rgba(17,17,19,.06)', gap: 2 }}>
                  {all.map((o) => {
                    const m: Method | null = o.paidAt !== null
                      ? (o.paymentMethod && o.paymentMethod !== 'iyzico' && o.paymentMethod !== 'split' ? o.paymentMethod : null)
                      : (staged[o.id] ?? null)
                    const color = o.paidAt !== null && o.paymentMethod === 'iyzico'
                      ? 'var(--positive)'
                      : o.paidAt !== null && o.paymentMethod === 'split'
                        ? '#b45309'
                        : m ? METHODS[m].dot : 'transparent'
                    return <div key={o.id} style={{ flex: o.total, background: color, transition: 'background .2s ease' }} />
                  })}
                </div>
              </div>

              {isSplitMode && (
                <div style={{ marginTop: 14, border: '1px solid var(--divider)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
                  <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>Split ödeme durumu</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
                      Ödenen {fmt(settledShareTotal)}
                      {declaredCashTotal > 0 ? ` · ${fmt(declaredCashTotal)} nakit onayı bekliyor` : ''}
                      {pendingCardTotal > 0 ? ` · ${fmt(pendingCardTotal)} kart bekliyor` : ''}
                    </span>
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {shares.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '14px 4px', textAlign: 'center' }}>
                        Bu adisyonda split pay yok.
                      </div>
                    ) : shares.map((share) => {
                      const settled = share.status === 'settled'
                      const isCash = share.method === 'cash'
                      const tone = settled ? 'paid' : isCash ? 'cash' : 'card'
                      const label = share.label?.trim() || (isCash ? 'Nakit beyanı' : 'Kart payı')
                      const waitingText = isCash ? 'Garson onayı bekliyor' : 'Kart ödemesi bekliyor'
                      return (
                        <div key={share.id} style={splitLineStyle(tone)}>
                          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.55)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {settled
                              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>
                              : isCash ? cashIcon : cardIcon}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.8 }}>{isCash ? 'Nakit' : 'İyzico'}</span>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.78, marginTop: 1 }}>
                              {settled ? `Onaylandı${share.settledByLabel ? ` · ${share.settledByLabel}` : ''}` : waitingText}
                            </div>
                          </div>
                          <span className="sm-mono" style={{ fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(share.amount)}</span>
                          {!settled && isCash && (
                            <button
                              type="button"
                              disabled={busy || confirmingShareId === share.id}
                              onClick={() => void confirmShare(share.id)}
                              style={{
                                height: 30,
                                padding: '0 10px',
                                borderRadius: 8,
                                border: '1px solid #b45309',
                                background: 'var(--surface)',
                                color: '#b45309',
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: busy || confirmingShareId === share.id ? 'default' : 'pointer',
                                opacity: busy || confirmingShareId === share.id ? 0.65 : 1,
                              }}
                            >
                              {confirmingShareId === share.id ? <InlineSpinner size={11} /> : 'Onayla'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {splitRemaining > 0 && (
                      <div style={splitLineStyle('open')}>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>Kalan tutar</span>
                        <span className="sm-mono" style={{ fontSize: 13.5, fontWeight: 800 }}>{fmt(splitRemaining)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick fill */}
              {!isSplitMode && unpaid.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500 }}>Tümüne uygula</span>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                    {METHOD_LIST.map((m) => (
                      <button key={m.id} type="button" disabled={busy} onClick={() => fillAll(m.id)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 8,
                        fontSize: 12, fontWeight: 600, color: m.fg, background: m.bg,
                        border: m.dashed ? `1px dashed ${m.fg}` : '1px solid transparent',
                        cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                      }}>{m.icon}{m.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {all.map((o, i) => {
                  const locked = o.paidAt !== null
                  const staged_m = staged[o.id] ?? null
                  const borderM = locked
                    ? (o.paymentMethod === 'iyzico'
                      ? '#137a4d'
                      : o.paymentMethod === 'split'
                        ? '#b45309'
                        : o.paymentMethod ? METHODS[o.paymentMethod].dot : 'var(--border)')
                    : staged_m ? METHODS[staged_m].dot : 'var(--border)'
                  return (
                    <div key={o.id} style={{ border: `1px solid ${borderM}`, borderRadius: 14, padding: '13px 14px 14px', background: locked ? 'var(--surface-2)' : 'var(--surface)', transition: 'border-color .15s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Sipariş {i + 1}</span>
                            <span className="sm-mono" style={{ fontSize: 10.5, color: 'var(--text-4)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 5 }}>#{o.id.slice(0, 6).toUpperCase()}</span>
                          </div>
                          {o.itemsSummary && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.itemsSummary}</div>}
                        </div>
                        <span className="sm-mono" style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(o.total)}</span>
                      </div>
                      {locked || isSplitMode ? (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                          {(() => {
                            const isComp = o.paymentMethod === 'comp'
                            const isSplit = o.paymentMethod === 'split' || (isSplitMode && !locked)
                            const m = o.paymentMethod && o.paymentMethod !== 'iyzico' && o.paymentMethod !== 'split' ? METHODS[o.paymentMethod] : null
                            const label = o.paymentMethod === 'iyzico'
                              ? 'İyzico · online'
                              : isSplit
                                ? locked ? 'Hesap bölüşme · ödendi' : 'Split ödeme bekleniyor'
                                : m ? m.label : 'Ödendi'
                            const fg = o.paymentMethod === 'iyzico' ? 'var(--positive)' : isSplit ? '#b45309' : m ? m.fg : 'var(--text-2)'
                            const bg = o.paymentMethod === 'iyzico' ? 'var(--positive-bg)' : isSplit ? '#fff7ed' : m ? m.bg : 'var(--surface-3)'
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: fg, background: bg, padding: '4px 9px', borderRadius: 999, fontWeight: 700, ...(isComp ? { border: `1px dashed ${fg}` } : null) }}>
                                {locked ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg> : cardIcon}
                                {isComp ? `${label} · ₺0` : label}
                              </span>
                            )
                          })()}
                          {o.settledByLabel && <span style={{ color: 'var(--text-3)' }}>· {o.settledByLabel}</span>}
                        </div>
                      ) : (
                        <MethodPicker value={staged_m} disabled={busy} onChange={(m) => setMethod(o.id, m)} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Tally */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {METHOD_LIST.map((m) => (
                  <div key={m.id} style={{ flex: 1, padding: '9px 11px', borderRadius: 11, background: tally[m.id] ? m.bg : 'var(--surface-2)', border: '1px solid ' + (tally[m.id] ? 'transparent' : 'var(--divider)'), transition: 'background .2s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: tally[m.id] ? m.fg : 'var(--text-3)', fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: tally[m.id] ? m.dot : 'var(--text-4)' }} />{m.label}
                    </div>
                    <div className="sm-mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: tally[m.id] ? m.fg : 'var(--text-4)', fontVariantNumeric: 'tabular-nums' }}>{fmt(tally[m.id])}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {orders !== null && (
          <div style={{ padding: '14px 20px 16px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" disabled={busy} onClick={onClose} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}>Vazgeç</button>
              <button type="button" disabled={!allStaged || busy} onClick={() => void commit()} style={{
                ...btnPrimary, flex: 1.6,
                opacity: allStaged && !busy ? 1 : 0.45, cursor: allStaged && !busy ? 'pointer' : 'not-allowed',
                background: allStaged ? 'var(--positive)' : 'var(--action)',
              }}>
                {committing
                  ? <><InlineSpinner size={13} color="#fff" /> Kapatılıyor…</>
                  : allStaged
                    ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>Masayı kapat · {fmt(collected)} tahsil</>
                    : isSplitMode
                      ? `Split ödeme kalan ${fmt(splitRemaining)}`
                      : `Kalan ${fmt(remaining)} işaretle`}
              </button>
            </div>

            {!abnormal ? (
              <button type="button" disabled={busy} onClick={() => setAbnormal(true)} style={{
                width: '100%', marginTop: 11, fontSize: 11.5, color: 'var(--text-4)', fontWeight: 500,
                padding: 4, background: 'transparent', border: 'none', cursor: busy ? 'default' : 'pointer',
              }}>Ödeme almadan kapat</button>
            ) : (
              <div style={{ marginTop: 11, padding: '11px 12px', borderRadius: 11, background: 'var(--critical-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ color: 'var(--critical)', flexShrink: 0, marginTop: 1 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17v.01" /></svg>
                  </span>
                  <div style={{ fontSize: 11.5, color: 'var(--critical)', fontWeight: 500, lineHeight: 1.4 }}>
                    Tahsilat kaydı olmadan kapatılacak — <b>anormal kapatma</b> olarak raporlanır. Sebep zorunlu.
                  </div>
                </div>
                <input
                  value={abnormalReason}
                  onChange={(e) => setAbnormalReason(e.target.value)}
                  placeholder="Sebep (örn. müşteri ödemeden ayrıldı)"
                  autoFocus
                  style={{
                    width: '100%', height: 32, marginTop: 9, padding: '0 10px', fontSize: 12,
                    border: '1px solid var(--critical)', borderRadius: 8, outline: 'none', background: 'var(--surface)',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                  <button type="button" disabled={busy} onClick={() => { setAbnormal(false); setAbnormalReason('') }} style={{
                    flex: 1, height: 32, borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                    border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer',
                  }}>Vazgeç</button>
                  <button type="button" disabled={busy || !abnormalReason.trim()} onClick={() => void confirmAbnormal()} style={{
                    flex: 1, height: 32, borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                    border: 'none', background: 'var(--critical)', color: '#fff',
                    cursor: busy || !abnormalReason.trim() ? 'not-allowed' : 'pointer', opacity: abnormalReason.trim() ? 1 : 0.5,
                  }}>{committing ? <InlineSpinner size={11} color="#fff" /> : 'Yine de kapat'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── shared styles ── */
const overlay = (z: number): React.CSSProperties => ({
  position: 'fixed', inset: 0, zIndex: z, background: 'rgba(17,17,19,.42)', backdropFilter: 'blur(3px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'sm-overlay .2s ease',
})
const modalBox: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--shadow-pop)',
  maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'sm-pop .32s cubic-bezier(.2,.8,.25,1)',
}
const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-3)',
  display: 'grid', placeItems: 'center', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0,
}
const btnGhost: React.CSSProperties = {
  flex: 1, height: 44, borderRadius: 11, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontWeight: 600,
  border: '1px solid var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
}
const btnPrimary: React.CSSProperties = {
  flex: 1, height: 44, borderRadius: 11, background: 'var(--positive)', color: '#fff', fontSize: 13.5, fontWeight: 600,
  border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer',
}
