import { AccessibleDialog } from './AccessibleDialog'
import type { SettlementMethod } from './settlement-sheet-model'
import {
  formatSettlementAmount,
  METHOD_LIST,
  SETTLEMENT_KEYFRAMES,
  settlementModalBox,
  settlementOverlay,
  settlementPrimaryButton,
} from './settlement-sheet-ui'

export function SettlementSuccessDialog({
  tableLabel,
  tally,
  collected,
  onDone,
  zIndex,
}: {
  tableLabel: string
  tally: Record<SettlementMethod, number>
  collected: number
  onDone: () => void
  zIndex: number
}) {
  const lines = METHOD_LIST.filter((method) => tally[method.id] > 0)
  return (
    <AccessibleDialog labelledBy="settlement-success-title" onClose={onDone} style={settlementOverlay(zIndex)}>
      <div style={{ ...settlementModalBox, maxWidth: 392 }} onClick={(event) => event.stopPropagation()}>
        <style dangerouslySetInnerHTML={{ __html: SETTLEMENT_KEYFRAMES }} />
        <div style={{ padding: '30px 24px 22px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 999, background: 'var(--positive-bg)', display: 'grid', placeItems: 'center', animation: 'sm-badge .45s cubic-bezier(.2,.8,.3,1.3) both' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="17" stroke="var(--positive)" strokeWidth="2.6" strokeDasharray="107" strokeDashoffset="107" style={{ animation: 'sm-ring .5s .15s ease forwards' }} />
                <path d="M12 20.5l5 5L29 14" stroke="var(--positive)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="28" strokeDashoffset="28" style={{ animation: 'sm-ring .35s .5s ease forwards' }} />
              </svg>
            </div>
          </div>
          <div id="settlement-success-title" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 16 }}>{tableLabel} kapatıldı</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>Adisyon tahsil edildi ve masa boşa alındı.</div>

          <div style={{ marginTop: 20, border: '1px solid var(--divider)', borderRadius: 14, overflow: 'hidden', textAlign: 'left' }}>
            {lines.map((method, index) => (
              <div key={method.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderBottom: index === lines.length - 1 ? 'none' : '1px solid var(--divider)' }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: method.bg, color: method.fg, display: 'grid', placeItems: 'center', ...(method.dashed ? { border: `1px dashed ${method.fg}` } : null) }}>{method.icon}</span>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{method.label}</span>
                <span className="sm-mono" style={{ fontSize: 13.5, fontWeight: 700, color: method.fg, fontVariantNumeric: 'tabular-nums' }}>{formatSettlementAmount(tally[method.id])}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', background: 'var(--surface-2)' }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>Nakit + POS tahsilat</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--positive)', fontVariantNumeric: 'tabular-nums' }}>{formatSettlementAmount(collected)}</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '0 20px 18px' }}>
          <button type="button" data-modal-initial-focus onClick={onDone} style={{ ...settlementPrimaryButton, width: '100%', background: 'var(--action)' }}>Bitti</button>
        </div>
      </div>
    </AccessibleDialog>
  )
}
