'use client'

import { useEffect, useId, useState } from 'react'
import type { CSSProperties } from 'react'
import type { OrderStatus } from '@garsonless/db/types'
import { orderStatusPhase } from './orderStatusPhase'
import { formatTRY } from './formatCurrency'
import { WaiterCallButton, type WaiterCallState } from './WaiterCallButton'

export interface OrderSummaryItem {
  quantity: number
  name: string
  unitPrice: number
  originalPrice?: number
  modifierNames?: string[]
  removedIngredientNames?: string[]
  productNote?: string
}

interface OrderConfirmationProps {
  orderId: string
  initialStatus: OrderStatus
  onSubscribeRealtime: (
    orderId: string,
    onChange: (status: OrderStatus, paidAt: string | null) => void,
  ) => () => void
  onDone: () => void
  isPaid?: boolean
  tableLabel?: string | null
  createdAt?: string | null
  items?: OrderSummaryItem[]
  total?: number
  /** Plays the minimize-to-bubble exit animation (parent unmounts after ~340ms). */
  closing?: boolean
  /** Waiter call — only render the button when provided (i.e. table context). */
  onCallWaiter?: () => void
  waiterCallState?: WaiterCallState
}

const STEPS = [
  { key: 'received', label: 'Sipariş alındı', sub: 'Mutfağa iletildi' },
  { key: 'preparing', label: 'Mutfakta hazırlanıyor', sub: 'Şefimiz hazırlıyor' },
  { key: 'ready', label: 'Hazır', sub: 'Servise hazır' },
  { key: 'served', label: 'Servis edildi', sub: 'Afiyet olsun!' },
] as const

const SURFACE = 'var(--p-card, #ffffff)'
const LINE = 'rgba(0,0,0,0.08)'

const KEYFRAMES = `
@keyframes oc-badge-pop {
  0% { transform: scale(0); opacity: 0; }
  55% { transform: scale(1.18); opacity: 1; }
  72% { transform: scale(.94); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes oc-check-draw { from { stroke-dashoffset: 28; } to { stroke-dashoffset: 0; } }
@keyframes oc-ring-fade {
  0% { transform: scale(.6); opacity: .55; }
  100% { transform: scale(1.9); opacity: 0; }
}
@keyframes oc-pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--p-accent) 45%, transparent); }
  50% { box-shadow: 0 0 0 7px transparent; }
}
@keyframes oc-confetti {
  0% { transform: translateY(-8px) rotate(0); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translateY(46px) rotate(220deg); opacity: 0; }
}
@keyframes oc-fade-slide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes oc-accord-open { from { opacity: 0; } to { opacity: 1; } }
@keyframes ob-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes ob-sheet-down { from { transform: translateY(0); } to { transform: translateY(100%); } }
.ob-sheet { animation: ob-sheet-up 360ms cubic-bezier(.3,.8,.3,1) both; }
.ob-sheet--closing { animation: ob-sheet-down 340ms cubic-bezier(.3,.8,.3,1) both; }
@media (prefers-reduced-motion: reduce) {
  .ob-sheet, .ob-sheet--closing { animation: none; }
}
`

/* ─── success badge: spring pop + expanding ring + one-shot confetti ─── */
function SuccessBadge() {
  const confetti = ['var(--p-accent)', 'var(--p-cta)', '#e0a93b', 'var(--p-accent)', '#cf6b4e', '#7bb59f']
  return (
    <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto' }}>
      {confetti.map((color, i) => {
        const angle = (i / confetti.length) * Math.PI * 2
        const dx = Math.cos(angle) * 52
        return (
          <span key={i} style={{
            position: 'absolute', left: '50%', top: '20%',
            width: 6, height: 9, borderRadius: 2, background: color,
            transform: `translateX(${dx}px)`,
            animation: `oc-confetti 1.1s ease-out ${0.15 + i * 0.04}s both`,
          }} />
        )
      })}
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: '2px solid var(--p-accent)',
        animation: 'oc-ring-fade 1.1s ease-out .1s both',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'var(--p-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'oc-badge-pop .7s cubic-bezier(.2,.9,.3,1.2) both',
        boxShadow: '0 12px 30px -10px color-mix(in srgb, var(--p-accent) 60%, transparent)',
      }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5 L10 17.5 L19 7"
            stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="28"
            style={{ animation: 'oc-check-draw .5s ease-out .45s both' }}
          />
        </svg>
      </div>
    </div>
  )
}

function LiveSub({ text }: { text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: 'var(--p-accent)',
        animation: 'oc-pulse-dot 1.6s ease-in-out infinite',
      }} />
      {text}
    </span>
  )
}

/* ─── vertical live timeline ─── */
function Timeline({ phase }: { phase: number }) {
  return (
    <div style={{ padding: '4px 2px' }}>
      {STEPS.map((step, i) => {
        const done = i < phase
        const active = i === phase
        const pending = i > phase
        const isLast = i === STEPS.length - 1
        return (
          <div key={step.key} style={{ display: 'flex', gap: 14, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done || active ? 'var(--p-accent)' : SURFACE,
                border: pending ? `2px solid ${LINE}` : '2px solid var(--p-accent)',
                animation: active ? 'oc-pulse-dot 1.8s ease-in-out infinite' : 'none',
                transition: 'all 400ms',
              }}>
                {done && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5 L10 17.5 L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {active && <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff' }} />}
              </div>
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 34, background: LINE, position: 'relative', overflow: 'hidden', borderRadius: 2 }}>
                  <div style={{
                    position: 'absolute', inset: 0, background: 'var(--p-accent)',
                    transformOrigin: 'top', transform: `scaleY(${done ? 1 : 0})`,
                    transition: 'transform 600ms ease', borderRadius: 2,
                  }} />
                </div>
              )}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 20, flex: 1, transition: 'opacity 400ms', opacity: pending ? 0.5 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26 }}>
                <span style={{
                  fontSize: 15, fontWeight: done || active ? 700 : 600,
                  color: pending ? 'var(--p-text-2)' : 'var(--p-text)',
                }}>{step.label}</span>
                {active && i === 1 && (
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, color: 'var(--p-accent)',
                    background: 'var(--p-accent-soft)', padding: '2px 9px', borderRadius: 99,
                  }}>~15 dk</span>
                )}
                {done && (
                  <span style={{ fontSize: 11, color: 'var(--p-text-2)', opacity: 0.7, marginLeft: 'auto' }}>✓</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--p-text-2)', marginTop: 2 }}>
                {active ? <LiveSub text={step.sub} /> : step.sub}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── collapsible order summary ─── */
function Summary({ items, total, isPaid }: { items: OrderSummaryItem[]; total: number; isPaid: boolean }) {
  const [open, setOpen] = useState(false)
  const toggleId = useId()
  const panelId = useId()
  return (
    <div style={{ background: SURFACE, borderRadius: 'var(--p-radius)', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
      <button
        id={toggleId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', minHeight: 52, padding: '0 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--p-text)' }}>
          Sipariş detayı <span style={{ color: 'var(--p-text-2)', fontWeight: 500 }}>({items.length} ürün)</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--p-text)' }}>{formatTRY(total)}</span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 250ms' }}>
            <path d="M6 9l6 6 6-6" stroke="var(--p-text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div id={panelId} role="region" aria-labelledby={toggleId} style={{ padding: '4px 16px 16px', animation: 'oc-accord-open 250ms ease' }}>
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--p-accent)', minWidth: 24 }}>{item.quantity}×</span>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--p-text)' }}>
                  {item.name}
                  {item.modifierNames && item.modifierNames.length > 0 && (
                    <small style={{ display: 'block', marginTop: 2, color: 'var(--p-text-2)', fontSize: 11 }}>{item.modifierNames.join(', ')}</small>
                  )}
                  {item.removedIngredientNames && item.removedIngredientNames.length > 0 && (
                    <small style={{ display: 'block', marginTop: 2, color: '#b42318', fontSize: 11, fontWeight: 800 }}>ÇIKAR: {item.removedIngredientNames.join(', ')}</small>
                  )}
                  {item.productNote && (
                    <small style={{ display: 'block', marginTop: 4, color: 'var(--p-text)', fontSize: 11, fontWeight: 700, whiteSpace: 'pre-wrap' }}>Not: {item.productNote}</small>
                  )}
                </span>
                {item.originalPrice !== undefined && item.originalPrice !== item.unitPrice && (
                  <span style={{ fontSize: 12.5, color: 'var(--p-text-2)', opacity: 0.7, textDecoration: 'line-through' }}>
                    {formatTRY(item.originalPrice)}
                  </span>
                )}
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--p-text)' }}>{formatTRY(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 8, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--p-text-2)' }}>Toplam</span>
                <span style={{ fontWeight: 700, color: 'var(--p-text)' }}>{formatTRY(total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--p-text-2)' }}>Ödeme</span>
                <span style={{ fontWeight: 700, color: isPaid ? 'var(--p-accent)' : 'var(--p-text)' }}>
                  {isPaid ? 'İyzico ile ödendi ✓' : 'Masada ödenecek'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function OrderConfirmation({
  orderId,
  initialStatus,
  onSubscribeRealtime,
  onDone,
  isPaid = false,
  tableLabel,
  createdAt,
  items = [],
  total = 0,
  closing = false,
  onCallWaiter,
  waiterCallState = 'idle',
}: OrderConfirmationProps) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus)
  const [paidSeen, setPaidSeen] = useState(isPaid || initialStatus === 'paid')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const unsubscribe = onSubscribeRealtime(orderId, (next, paidAt) => {
      setStatus(next)
      // paid_at column is the source of truth; status==='paid' covers legacy rows
      if (paidAt || next === 'paid') setPaidSeen(true)
    })
    return unsubscribe
  }, [orderId, onSubscribeRealtime])

  const phase = orderStatusPhase(status)
  const shortCode = `#${orderId.slice(-4).toUpperCase()}`
  const timeText = createdAt
    ? `${new Date(createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'te alındı`
    : null

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 50,
    display: 'flex', flexDirection: 'column',
    background: 'var(--p-bg)',
    fontFamily: 'var(--p-body)',
  }

  /* cancelled: keep today's simple UI, do not redesign */
  const sheetClass = closing ? 'ob-sheet--closing' : 'ob-sheet'

  if (status === 'cancelled') {
    return (
      <div className={sheetClass} style={{ ...overlay, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <style>{KEYFRAMES}</style>
        <div style={{ fontSize: 56, marginBottom: 18 }}>❌</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--p-text)', margin: 0 }}>Sipariş İptal Edildi</h2>
        <p style={{ fontSize: 13, color: 'var(--p-text-2)', margin: '8px 0 24px' }}>Sipariş {shortCode}</p>
        <button
          type="button"
          onClick={onDone}
          style={{
            padding: '13px 32px', borderRadius: 'var(--p-radius)', border: 'none',
            background: 'var(--p-cta)', color: 'var(--p-cta-text)', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Tekrar Dene</button>
      </div>
    )
  }

  const headline = phase >= 3
    ? { t: 'Afiyet olsun!', s: 'Siparişin masana servis edildi' }
    : phase === 2
      ? { t: 'Siparişin hazır!', s: 'Birazdan masana geliyor' }
      : paidSeen
        ? { t: 'Ödemen alındı!', s: 'Siparişin mutfağa iletildi' }
        : { t: 'Siparişin alındı!', s: 'Siparişin mutfağa iletildi' }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className={sheetClass} style={overlay}>
      <style>{KEYFRAMES}</style>

      {/* close */}
      <button
        type="button"
        aria-label="Kapat"
        onClick={onDone}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 5,
          width: 34, height: 34, borderRadius: '50%', border: `1px solid ${LINE}`,
          background: SURFACE, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="var(--p-text-2)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* scroll body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 0', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {/* hero — badge stays mounted (confetti plays once); text re-animates per phase */}
        <div style={{ textAlign: 'center', paddingTop: 26 }}>
          <SuccessBadge />
          <div key={phase} style={{ animation: 'oc-fade-slide 400ms ease' }}>
            <h1 style={{ fontSize: 25, fontWeight: 800, margin: '18px 0 0', letterSpacing: '-0.02em', color: 'var(--p-text)', fontFamily: 'var(--p-display)' }}>
              {headline.t}
            </h1>
            <p style={{ fontSize: 14.5, color: 'var(--p-text-2)', margin: '6px 0 0' }}>{headline.s}</p>
          </div>
        </div>

        {/* order id card */}
        <div style={{
          marginTop: 22, background: SURFACE, borderRadius: 'var(--p-radius)',
          border: `1px solid ${LINE}`, padding: 16,
          boxShadow: '0 4px 16px -10px rgba(0,0,0,.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--p-text-2)', fontWeight: 600, letterSpacing: '.04em' }}>SİPARİŞ NO</div>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 3,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '.02em', color: 'var(--p-text)' }}>{shortCode}</span>
                {copied ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p-accent)' }}>Kopyalandı ✓</span>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="var(--p-text-2)" strokeOpacity="0.7" strokeWidth="1.9" />
                    <path d="M5 15V6a2 2 0 0 1 2-2h8" stroke="var(--p-text-2)" strokeOpacity="0.7" strokeWidth="1.9" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 700, color: 'var(--p-accent)',
                background: 'var(--p-accent-soft)', padding: '4px 10px', borderRadius: 99,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--p-accent)' }} />
                {paidSeen ? 'ÖDENDİ' : 'ALINDI'}
              </span>
              {total > 0 && <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: 'var(--p-text)' }}>{formatTRY(total)}</div>}
            </div>
          </div>
          {(tableLabel || timeText) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
              {tableLabel && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12.5, fontWeight: 600, color: 'var(--p-text)',
                  background: 'var(--p-bg)', border: `1px solid ${LINE}`,
                  padding: '5px 11px', borderRadius: 99,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  {tableLabel}
                </span>
              )}
              {timeText && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--p-text-2)', padding: '5px 4px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {timeText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* timeline card */}
        <div style={{ marginTop: 14, background: SURFACE, borderRadius: 'var(--p-radius)', border: `1px solid ${LINE}`, padding: '18px 16px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--p-text-2)', letterSpacing: '.05em', marginBottom: 16 }}>SİPARİŞ DURUMU</div>
          <Timeline phase={phase} />
        </div>

        {/* summary */}
        {items.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Summary items={items} total={total} isPaid={paidSeen} />
          </div>
        )}
        <div style={{ height: 14 }} />
      </div>

      {/* sticky actions + safe area */}
      <div style={{
        flexShrink: 0,
        padding: '14px 18px calc(14px + env(safe-area-inset-bottom, 18px))',
        background: 'linear-gradient(to top, var(--p-bg) 72%, transparent)',
        display: 'flex', flexDirection: 'column', gap: 10,
        maxWidth: 560, width: '100%', margin: '0 auto',
      }}>
        <button
          type="button"
          onClick={onDone}
          style={{
            width: '100%', height: 52, borderRadius: 'var(--p-radius)', border: 'none',
            background: 'var(--p-cta)', color: 'var(--p-cta-text)', fontSize: 15.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {status === 'served' ? 'Kapat' : 'Menüye dön'}
        </button>
        {onCallWaiter && <WaiterCallButton state={waiterCallState} onCall={onCallWaiter} />}
      </div>
    </div>
  )
}
