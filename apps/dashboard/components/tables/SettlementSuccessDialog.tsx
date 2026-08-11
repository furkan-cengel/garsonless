import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { SettlementMethod } from './settlement-sheet-model'
import {
  formatSettlementAmount,
  METHOD_LIST,
  SETTLEMENT_KEYFRAMES,
} from './settlement-sheet-ui'

export function SettlementSuccessDialog({
  tableLabel,
  tally,
  collected,
  onDone,
  zIndex: _zIndex,
}: {
  tableLabel: string
  tally: Record<SettlementMethod, number>
  collected: number
  onDone: () => void
  zIndex: number
}) {
  const lines = METHOD_LIST.filter((method) => tally[method.id] > 0)
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDone() }}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <style dangerouslySetInnerHTML={{ __html: SETTLEMENT_KEYFRAMES }} />
        <DialogHeader className="items-center px-6 pt-7 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-[var(--positive-bg)] text-[var(--positive)]"><Check /></div>
          <DialogTitle id="settlement-success-title" className="mt-2 text-xl">{tableLabel} kapatıldı</DialogTitle>
          <DialogDescription>Adisyon tahsil edildi ve masa boşa alındı.</DialogDescription>
        </DialogHeader>

          <div className="mx-5 my-5 overflow-hidden rounded-xl border text-left">
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
        <DialogFooter className="mx-0 mb-0"><Button type="button" onClick={onDone} className="w-full">Bitti</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
