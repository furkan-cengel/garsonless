import { sessionDuration } from './tables-operation-model'
import React from 'react'
import { Banknote, CreditCard, Gift } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { SettlementMethod } from './settlement-sheet-model'

export const cashIcon = <Banknote />
export const cardIcon = <CreditCard />
const giftIcon = <Gift />

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
  cash: { id: 'cash', label: 'Nakit', fg: 'var(--positive)', bg: 'var(--positive-bg)', dot: 'var(--positive)', icon: cashIcon },
  pos: { id: 'pos', label: 'Fiziksel POS', fg: 'var(--info)', bg: 'var(--info-bg)', dot: 'var(--info)', icon: cardIcon },
  comp: { id: 'comp', label: 'İkram', fg: 'var(--warning)', bg: 'var(--warning-bg)', dot: 'var(--warning)', icon: giftIcon, dashed: true },
}

export const METHOD_LIST = [METHODS.cash, METHODS.pos, METHODS.comp]

export const formatSettlementAmount = (amount: number) => `₺${amount.toLocaleString('tr-TR')}`

export function settlementDurationLabel(openedAt: string): string {
  return `${sessionDuration(openedAt, Date.now())} açık`
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
    <ToggleGroup value={value ? [value] : []} onValueChange={(values) => { const method = values[0] as SettlementMethod | undefined; if (method) onChange(method) }} variant="outline" spacing={1} className="mt-2.5 grid w-full grid-cols-3" aria-label="Ödeme yöntemi">
      {METHOD_LIST.map((method) => <ToggleGroupItem key={method.id} value={method.id} disabled={disabled} className="h-auto min-w-0 flex-col py-2.5"><span>{method.icon}</span>{method.label}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}
