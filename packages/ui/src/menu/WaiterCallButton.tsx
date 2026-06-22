'use client'

export type WaiterCallState = 'idle' | 'calling' | 'called'

interface WaiterCallButtonProps {
  state: WaiterCallState
  onCall: () => void
}

const LINE = 'rgba(0,0,0,0.08)'
const SURFACE = 'var(--p-card, #ffffff)'

/** Presentational ghost button (ref: Order Tracking). Logic lives in the host app. */
export function WaiterCallButton({ state, onCall }: WaiterCallButtonProps) {
  const called = state === 'called'
  const calling = state === 'calling'
  const disabled = state !== 'idle'

  return (
    <button
      type="button"
      onClick={onCall}
      disabled={disabled}
      style={{
        width: '100%',
        height: 48,
        borderRadius: 'var(--p-radius)',
        border: `1.5px solid ${called ? 'var(--p-accent)' : LINE}`,
        background: called ? 'var(--p-accent-soft)' : SURFACE,
        color: called ? 'var(--p-accent)' : 'var(--p-text)',
        fontSize: 14.5,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 160ms',
      }}
    >
      {!called && (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4a5 5 0 0 0-5 5v3.5L5.5 16h13L17 12.5V9a5 5 0 0 0-5-5ZM10 19a2 2 0 0 0 4 0"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )}
      {called ? 'Garson çağrıldı ✓' : calling ? 'Çağrılıyor…' : 'Garson çağır'}
    </button>
  )
}
