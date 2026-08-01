import React from 'react'
import type { SettlementMethod } from './settlement-sheet-model'

export const cashIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /></svg>
export const cardIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /></svg>
const giftIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="9" width="17" height="11" rx="1.5" /><path d="M3.5 13h17M12 9v11M12 9S9.5 5 7.5 6.5 9 9 12 9Zm0 0s2.5-4 4.5-2.5S15 9 12 9Z" /></svg>

type MethodDefinition = {
  id: SettlementMethod
  label: string
  fg: string
  bg: string
  dot: string
  icon: React.ReactNode
  dashed?: boolean
}

export const METHODS: Record<SettlementMethod, MethodDefinition> = {
  cash: { id: 'cash', label: 'Nakit', fg: '#137a4d', bg: '#e6f4ec', dot: '#137a4d', icon: cashIcon },
  pos: { id: 'pos', label: 'Fiziksel POS', fg: '#2c5282', bg: '#e8eef6', dot: '#2c5282', icon: cardIcon },
  comp: { id: 'comp', label: 'İkram', fg: '#7c3aed', bg: '#f3e8ff', dot: '#7c3aed', icon: giftIcon, dashed: true },
}

export const METHOD_LIST = [METHODS.cash, METHODS.pos, METHODS.comp]

export const formatSettlementAmount = (amount: number) => `₺${amount.toLocaleString('tr-TR')}`

export function settlementDurationLabel(openedAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}dk açık`
  return `${Math.floor(minutes / 60)}s ${minutes % 60}dk açık`
}

export const SETTLEMENT_KEYFRAMES = `
.sm-mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; }
@keyframes sm-overlay { from { opacity: 0 } to { opacity: 1 } }
@keyframes sm-pop { from { opacity: 0; transform: translateY(12px) scale(.985) } to { opacity: 1; transform: none } }
@keyframes sm-ring { to { stroke-dashoffset: 0 } }
@keyframes sm-badge { 0% { transform: scale(.6); opacity: 0 } 60% { transform: scale(1.05) } 100% { transform: scale(1); opacity: 1 } }
@keyframes sm-count { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
`

export function settlementOverlay(zIndex: number): React.CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    zIndex,
    background: 'rgba(17,17,19,.42)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    animation: 'sm-overlay .2s ease',
  }
}

export const settlementModalBox: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  borderRadius: 18,
  boxShadow: 'var(--shadow-pop)',
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: 'sm-pop .32s cubic-bezier(.2,.8,.25,1)',
}

export const settlementIconButton: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  background: 'var(--surface-2)',
  color: 'var(--text-3)',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  flexShrink: 0,
}

export const settlementGhostButton: React.CSSProperties = {
  flex: 1,
  height: 44,
  borderRadius: 11,
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13.5,
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
}

export const settlementPrimaryButton: React.CSSProperties = {
  flex: 1,
  height: 44,
  borderRadius: 11,
  background: 'var(--positive)',
  color: '#fff',
  fontSize: 13.5,
  fontWeight: 600,
  border: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  cursor: 'pointer',
}

export function SettlementMethodPicker({
  value,
  disabled,
  onChange,
}: {
  value: SettlementMethod | null
  disabled: boolean
  onChange: (method: SettlementMethod) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
      {METHOD_LIST.map((method) => {
        const selected = value === method.id
        return (
          <button
            key={method.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(method.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '9px 4px',
              borderRadius: 10,
              fontSize: 11.5,
              fontWeight: 600,
              color: selected ? method.fg : 'var(--text-2)',
              background: selected ? method.bg : 'var(--surface)',
              border: `${selected ? '1.5px' : '1px'} ${method.dashed && selected ? 'dashed' : 'solid'} ${selected ? method.dot : 'var(--border)'}`,
              boxShadow: selected ? 'none' : 'var(--shadow-1)',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all .12s ease',
            }}
          >
            <span style={{ color: selected ? method.fg : 'var(--text-3)' }}>{method.icon}</span>
            {method.label}
          </button>
        )
      })}
    </div>
  )
}
