'use client'

export type OrderBubblePhase = 0 | 1 | 2 | 3

interface OrderBubbleProps {
  phase: number
  unseen: number
  justChanged: boolean
  onOpen: () => void
}

const STEP_ICONS = ['receipt', 'chef', 'bell', 'plate'] as const

const KEYFRAMES = `
@keyframes ob-bubble-in {
  0% { transform: scale(0) translateY(20px); opacity: 0; }
  60% { transform: scale(1.12); }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes ob-bubble-wiggle {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-11deg); }
  40% { transform: rotate(9deg); }
  60% { transform: rotate(-6deg); }
  80% { transform: rotate(3deg); }
}
@keyframes ob-ring-expand {
  0% { transform: scale(1); opacity: .5; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes ob-badge-count {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
.ob-bubble { animation: ob-bubble-in .5s cubic-bezier(.2,.9,.3,1.3) both; }
.ob-bubble--wiggle { animation: ob-bubble-wiggle .65s ease; }
.ob-bubble-ring { animation: ob-ring-expand 2s ease-out infinite; }
.ob-bubble-badge { animation: ob-badge-count .4s ease; }
@media (prefers-reduced-motion: reduce) {
  .ob-bubble, .ob-bubble--wiggle, .ob-bubble-ring, .ob-bubble-badge { animation: none; }
}
`

function StepIcon({ type, size = 25 }: { type: (typeof STEP_ICONS)[number]; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#fff',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (type === 'receipt') return <svg {...common}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></svg>
  if (type === 'chef') return <svg {...common}><path d="M7 14a4 4 0 1 1 1-7.9 3.5 3.5 0 0 1 8 0A4 4 0 1 1 17 14M7 14v5h10v-5" /></svg>
  if (type === 'bell') return <svg {...common}><path d="M12 4a5 5 0 0 0-5 5v3.5L5.5 16h13L17 12.5V9a5 5 0 0 0-5-5ZM10 19a2 2 0 0 0 4 0" /></svg>
  return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
}

const ARC_CIRCUMFERENCE = 2 * Math.PI * 27

export function OrderBubble({ phase, unseen, justChanged, onOpen }: OrderBubbleProps) {
  const clamped = Math.max(0, Math.min(3, phase))
  const icon = STEP_ICONS[clamped]!

  return (
    <>
      <style>{KEYFRAMES}</style>
      <button
        type="button"
        aria-label="Sipariş durumunu aç"
        onClick={onOpen}
        className={justChanged ? 'ob-bubble--wiggle' : 'ob-bubble'}
        style={{
          // Stacked above FloatingCartTrigger (max bottom 24 + height 66 ≈ 90px) with 12px gap
          position: 'fixed',
          right: 16,
          bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          zIndex: 46,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          background: 'var(--p-accent)',
          boxShadow: '0 12px 28px -8px color-mix(in srgb, var(--p-accent) 60%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* live pulse ring while order in progress */}
        {clamped < 3 && (
          <span
            className="ob-bubble-ring"
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--p-accent)' }}
          />
        )}
        <StepIcon type={icon} />
        {/* progress arc */}
        <svg width="60" height="60" viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="30" cy="30" r="27" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" />
          <circle
            cx="30" cy="30" r="27" fill="none"
            stroke="#fff" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={ARC_CIRCUMFERENCE}
            strokeDashoffset={ARC_CIRCUMFERENCE * (1 - (clamped + 1) / 4)}
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        {/* unseen count */}
        {unseen > 0 && (
          <span
            className="ob-bubble-badge"
            style={{
              position: 'absolute', top: -3, right: -3,
              minWidth: 22, height: 22, borderRadius: 99,
              background: 'var(--p-cta)', color: '#fff',
              fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2.5px solid var(--p-bg)',
            }}
          >{unseen}</span>
        )}
      </button>
    </>
  )
}
