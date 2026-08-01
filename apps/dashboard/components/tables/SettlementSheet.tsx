'use client'

import React from 'react'
import { InlineSpinner } from '@garsonless/ui'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { AccessibleDialog } from './AccessibleDialog'
import { SETTLEMENT_LOAD_ERROR } from './settlement-load'
import { SettlementOrderItems } from './SettlementOrderItems'
import { SettlementSplitStatus } from './SettlementSplitStatus'
import { SettlementSuccessDialog } from './SettlementSuccessDialog'
import type { SettlementMethod } from './settlement-sheet-model'
import {
  cardIcon,
  formatSettlementAmount,
  METHOD_LIST,
  METHODS,
  SETTLEMENT_KEYFRAMES,
  SettlementMethodPicker,
  settlementDurationLabel,
  settlementGhostButton,
  settlementIconButton,
  settlementModalBox,
  settlementOverlay,
  settlementPrimaryButton,
} from './settlement-sheet-ui'
import { useSettlementSheet } from './use-settlement-sheet'

/**
 * Close-flow settlement sheet — STAGE THEN COMMIT. Each unpaid order gets a
 * staged method locally (Nakit / Fiziksel POS / İkram); the running summary,
 * progress and tally update live. "Masayı kapat" commits every staged payment
 * sequentially, then frees the table and records one normal visit. Already-paid
 * orders (e.g. İyzico) are shown locked.
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
  const controller = useSettlementSheet({ restaurantId, session, onSettled, onSessionClosed })
  const {
    orders,
    shares,
    loadState,
    loadError,
    staged,
    error,
    committing,
    confirmingShareId,
    done,
    abnormal,
    abnormalReason,
    busy,
    projection,
    reload,
    setMethod,
    fillAll,
    confirmShare,
    commit,
    confirmAbnormal,
    setAbnormal,
    setAbnormalReason,
    cancelAbnormal,
  } = controller
  const {
    all,
    isSplitMode,
    unpaid,
    total,
    assigned,
    remaining,
    allStaged,
    settledShares,
    settledShareTotal,
    declaredCashTotal,
    pendingCardTotal,
    splitRemaining,
    tally,
    collected,
  } = projection

  if (done) {
    return <SettlementSuccessDialog tableLabel={tableLabel} tally={tally} collected={collected} onDone={onSessionClosed} zIndex={zIndex} />
  }

  return (
    <AccessibleDialog labelledBy="settlement-dialog-title" onClose={onClose} closeDisabled={busy} style={settlementOverlay(zIndex)}>
      <div style={{ ...settlementModalBox, maxWidth: 468 }} onClick={(e) => e.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: SETTLEMENT_KEYFRAMES }} />

        {/* Header */}
        <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--divider)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{tableLabel} · Adisyonu kapat</div>
            <div id="settlement-dialog-title" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', marginTop: 4 }}>Tahsilatı tamamla</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{loadState === 'loading' ? 'Siparişler yükleniyor' : loadState === 'error' ? 'Siparişler yüklenemedi' : `${all.length} sipariş`}</span><span style={{ color: 'var(--border-strong)' }}>·</span>
              <span>{settlementDurationLabel(session.openedAt)}</span>
            </div>
          </div>
          <button type="button" data-modal-initial-focus disabled={busy} onClick={onClose} aria-label="Pencereyi kapat" style={{ ...settlementIconButton, opacity: busy ? 0.6 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div style={{ padding: 20, overflow: 'auto' }}>
          {error && (
            <div style={{ fontSize: 12, color: 'var(--critical)', background: 'var(--critical-bg)', padding: '9px 11px', borderRadius: 9, marginBottom: 14 }}>{error}</div>
          )}

          {loadState === 'loading' ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-3)' }}><InlineSpinner size={16} /> Yükleniyor…</div>
          ) : loadState === 'error' ? (
            <div role="alert" style={{ padding: '26px 18px', textAlign: 'center', borderRadius: 12, background: 'var(--critical-bg)', color: 'var(--critical)' }}>
              <div style={{ fontSize: 13, fontWeight: 650 }}>{loadError ?? SETTLEMENT_LOAD_ERROR}</div>
              <button type="button" onClick={reload} style={{ ...settlementGhostButton, width: '100%', marginTop: 14, color: 'var(--critical)' }}>Tekrar dene</button>
            </div>
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
                        ? allStaged ? formatSettlementAmount(settledShareTotal) : formatSettlementAmount(splitRemaining)
                        : allStaged ? formatSettlementAmount(collected) : formatSettlementAmount(remaining)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    <div>Toplam <span className="sm-mono" style={{ color: 'var(--text-2)', fontWeight: 600 }}>{formatSettlementAmount(total)}</span></div>
                    <div>{isSplitMode ? `${shares.length} pay · ${settledShares.length} onaylı` : `${assigned}/${all.length} sipariş işaretlendi`}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', marginTop: 13, background: 'rgba(17,17,19,.06)', gap: 2 }}>
                  {all.map((o) => {
                    const m: SettlementMethod | null = o.paidAt !== null
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
                <SettlementSplitStatus
                  shares={shares}
                  settledShareTotal={settledShareTotal}
                  declaredCashTotal={declaredCashTotal}
                  pendingCardTotal={pendingCardTotal}
                  splitRemaining={splitRemaining}
                  busy={busy}
                  confirmingShareId={confirmingShareId}
                  onConfirmShare={(shareId) => void confirmShare(shareId)}
                />
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
                        </div>
                        <span className="sm-mono" style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatSettlementAmount(o.total)}</span>
                      </div>
                      <div style={{ marginTop: 9 }}>
                        <SettlementOrderItems items={o.items} />
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
                        <SettlementMethodPicker value={staged_m} disabled={busy} onChange={(method) => setMethod(o.id, method)} />
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
                    <div className="sm-mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: tally[m.id] ? m.fg : 'var(--text-4)', fontVariantNumeric: 'tabular-nums' }}>{formatSettlementAmount(tally[m.id])}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {loadState === 'ready' && orders !== null && (
          <div style={{ padding: '14px 20px 16px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" disabled={busy} onClick={onClose} style={{ ...settlementGhostButton, opacity: busy ? 0.6 : 1 }}>Vazgeç</button>
              <button type="button" disabled={!allStaged || busy} onClick={() => void commit()} style={{
                ...settlementPrimaryButton, flex: 1.6,
                opacity: allStaged && !busy ? 1 : 0.45, cursor: allStaged && !busy ? 'pointer' : 'not-allowed',
                background: allStaged ? 'var(--positive)' : 'var(--action)',
              }}>
                {committing
                  ? <><InlineSpinner size={13} color="#fff" /> Kapatılıyor…</>
                  : allStaged
                    ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>Masayı kapat · {formatSettlementAmount(collected)} tahsil</>
                    : isSplitMode
                      ? `Split ödeme kalan ${formatSettlementAmount(splitRemaining)}`
                      : `Kalan ${formatSettlementAmount(remaining)} işaretle`}
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
                  <button type="button" disabled={busy} onClick={cancelAbnormal} style={{
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
    </AccessibleDialog>
  )
}
