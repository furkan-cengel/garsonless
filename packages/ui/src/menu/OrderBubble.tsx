'use client'

import { AppIcons } from '../icons'

interface OrderBubbleProps {
  phase: number
  unseen: number
  justChanged: boolean
  onOpen: () => void
}

const STEP_ICONS = ['receipt', 'cutlery', 'bell', 'check'] as const
const STEP_LABELS = ['Sipariş alındı', 'Hazırlanıyor', 'Servise hazır', 'Servis edildi'] as const

const KEYFRAMES = `
@keyframes ob-bubble-in {
  from { transform: translateY(-6px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes ob-bubble-wiggle {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-11deg); }
  40% { transform: rotate(9deg); }
  60% { transform: rotate(-6deg); }
  80% { transform: rotate(3deg); }
}
@keyframes ob-badge-count {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
.ob-bubble { animation: ob-bubble-in .28s ease both; }
.ob-bubble--wiggle { animation: ob-bubble-wiggle .65s ease; }
.ob-bubble-badge { animation: ob-badge-count .4s ease; }
@media (prefers-reduced-motion: reduce) {
  .ob-bubble, .ob-bubble--wiggle, .ob-bubble-badge { animation: none; }
}
`

export function OrderBubble({ phase, unseen, justChanged, onOpen }: OrderBubbleProps) {
  const clamped = Math.max(0, Math.min(3, phase))
  const icon = STEP_ICONS[clamped]!
  const Icon = AppIcons[icon]

  return (
    <>
      <style>{KEYFRAMES}</style>
      <button
        type="button"
        aria-label={`Sipariş durumu: ${STEP_LABELS[clamped]}.${unseen > 0 ? ` ${unseen} okunmamış güncelleme.` : ''} Takibi aç`}
        onClick={onOpen}
        className={justChanged ? 'ob-bubble--wiggle' : 'ob-bubble'}
        style={{
          width: 'calc(100% - 32px)',
          maxWidth: 398,
          minHeight: 66,
          margin: '10px auto 4px',
          borderRadius: 12,
          border: '1px solid color-mix(in srgb, var(--p-accent) 22%, var(--p-border))',
          cursor: 'pointer',
          padding: '10px 12px',
          background: 'color-mix(in srgb, var(--p-accent-soft) 78%, var(--p-card))',
          color: 'var(--p-text)',
          boxShadow: '0 8px 20px -16px color-mix(in srgb, var(--p-accent) 55%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--p-card)', color: 'var(--p-accent)',
          border: '1px solid color-mix(in srgb, var(--p-accent) 18%, var(--p-border))',
        }}>
          <Icon size={19} strokeWidth={2} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', fontSize: 13.5, lineHeight: 1.2 }}>{STEP_LABELS[clamped]}</strong>
          <span aria-hidden="true" style={{ display: 'flex', gap: 4, marginTop: 7 }}>
            {STEP_LABELS.map((label, index) => (
              <span
                key={label}
                style={{
                  height: 4, flex: 1, borderRadius: 99,
                  background: index <= clamped
                    ? 'var(--p-accent)'
                    : 'color-mix(in srgb, var(--p-accent) 18%, transparent)',
                }}
              />
            ))}
          </span>
        </span>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--p-accent)', fontSize: 11.5, fontWeight: 750 }}>
          Takip et
          <AppIcons.chevRight size={15} />
        </span>
        {/* unseen count */}
        {unseen > 0 && (
          <span
            aria-hidden="true"
            className="ob-bubble-badge"
            style={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 20, height: 20, borderRadius: 99,
              background: 'var(--p-cta)', color: 'var(--p-cta-text)',
              fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--p-bg)',
            }}
          >{unseen}</span>
        )}
      </button>
    </>
  )
}
