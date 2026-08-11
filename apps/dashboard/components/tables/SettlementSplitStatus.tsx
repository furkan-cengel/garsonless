import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { SettlementShare } from './settlement-sheet-model'
import { cardIcon, cashIcon, formatSettlementAmount } from './settlement-sheet-ui'

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

export function SettlementSplitStatus({
  shares,
  settledShareTotal,
  declaredCashTotal,
  pendingCardTotal,
  splitRemaining,
  busy,
  confirmingShareId,
  onConfirmShare,
}: {
  shares: SettlementShare[]
  settledShareTotal: number
  declaredCashTotal: number
  pendingCardTotal: number
  splitRemaining: number
  busy: boolean
  confirmingShareId: string | null
  onConfirmShare: (shareId: string) => void
}) {
  return (
    <div style={{ marginTop: 14, border: '1px solid var(--divider)', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>Split ödeme durumu</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
          Ödenen {formatSettlementAmount(settledShareTotal)}
          {declaredCashTotal > 0 ? ` · ${formatSettlementAmount(declaredCashTotal)} nakit onayı bekliyor` : ''}
          {pendingCardTotal > 0 ? ` · ${formatSettlementAmount(pendingCardTotal)} kart bekliyor` : ''}
        </span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shares.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '14px 4px', textAlign: 'center' }}>Bu adisyonda split pay yok.</div>
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
              <span className="sm-mono" style={{ fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatSettlementAmount(share.amount)}</span>
              {!settled && isCash && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-busy={confirmingShareId === share.id}
                  disabled={busy || confirmingShareId === share.id}
                  onClick={() => onConfirmShare(share.id)}
                >
                  {confirmingShareId === share.id && <Spinner data-icon="inline-start" />}
                  {confirmingShareId === share.id ? 'Onaylanıyor…' : 'Onayla'}
                </Button>
              )}
            </div>
          )
        })}
        {splitRemaining > 0 && (
          <div style={splitLineStyle('open')}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>Kalan tutar</span>
            <span className="sm-mono" style={{ fontSize: 13.5, fontWeight: 800 }}>{formatSettlementAmount(splitRemaining)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
