'use client'

interface OrderToastNotificationProps {
  phase: number
  onOpen: () => void
}

// Notification copy per phase — mirrors NOTIF in the design reference
const NOTIF = [
  { t: 'Siparişin alındı', s: 'Mutfağa iletildi', emoji: '🧾' },
  { t: 'Mutfakta hazırlanıyor', s: 'Tahmini ~15 dk', emoji: '👨‍🍳' },
  { t: 'Siparişin hazır!', s: 'Birazdan masana geliyor', emoji: '🔔' },
  { t: 'Afiyet olsun!', s: 'Siparişin servis edildi', emoji: '🍽️' },
] as const

const KEYFRAMES = `
@keyframes ob-toast-in {
  from { transform: translateX(20px) scale(.9); opacity: 0; }
  to { transform: translateX(0) scale(1); opacity: 1; }
}
.ob-toast { animation: ob-toast-in .4s cubic-bezier(.2,.9,.3,1.2) both; }
@media (prefers-reduced-motion: reduce) {
  .ob-toast { animation: none; }
}
`

export function OrderToastNotification({ phase, onOpen }: OrderToastNotificationProps) {
  const data = NOTIF[Math.max(0, Math.min(3, phase))]!

  return (
    <>
      <style>{KEYFRAMES}</style>
      <button
        type="button"
        aria-label={`${data.t}. ${data.s}. Sipariş durumunu aç`}
        onClick={onOpen}
        className="ob-toast"
        style={{
          // Anchored above the OrderBubble (bubble bottom 96 + 60 height + 8 gap)
          position: 'fixed',
          right: 16,
          bottom: 'calc(164px + env(safe-area-inset-bottom, 0px))',
          zIndex: 47,
          maxWidth: 250,
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
          background: 'var(--p-card, #ffffff)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          boxShadow: '0 16px 36px -12px rgba(0,0,0,.28)',
          padding: '11px 13px',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <span aria-hidden="true" style={{
          width: 38, height: 38, borderRadius: 11,
          background: 'var(--p-accent-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>{data.emoji}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span role="status" aria-live="polite" style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--p-text)' }}>{data.t}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--p-text-2)', marginTop: 1 }}>{data.s}</span>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--p-accent)', flexShrink: 0 }}>Gör →</span>
      </button>
    </>
  )
}
