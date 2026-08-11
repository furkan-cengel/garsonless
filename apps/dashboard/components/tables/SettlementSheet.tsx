'use client'

import { Check, TriangleAlert, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { SETTLEMENT_LOAD_ERROR } from './settlement-load'
import { SettlementOrderItems } from './SettlementOrderItems'
import { SettlementSplitStatus } from './SettlementSplitStatus'
import { SettlementSuccessDialog } from './SettlementSuccessDialog'
import {
  cardIcon,
  formatSettlementAmount,
  METHOD_LIST,
  METHODS,
  SETTLEMENT_KEYFRAMES,
  SettlementMethodPicker,
  settlementDurationLabel,
} from './settlement-sheet-ui'
import { useSettlementSheet } from './use-settlement-sheet'

/**
 * Close-flow settlement sheet — STAGE THEN COMMIT. Each unpaid order gets a
 * staged method locally (Nakit / Fiziksel POS / İkram); the running summary,
 * progress and tally update live. "Masayı kapat" commits every staged payment
 * sequentially, then frees the table and records one normal visit. Already-paid
 * orders (e.g. İyzico) are shown locked.
 * "Ödeme almadan kapat" requires a recorded reason → abnormal close (money stays
 * unpaid, no visit). İkram = comp = ₺0 collected, reported separately.
 */
export default function SettlementSheet({
  restaurantId, session, tableLabel, onClose, onSettled, onSessionClosed, zIndex = 60,
}: {
  restaurantId: string
  session: OpenSessionInfo
  tableLabel: string
  onClose: () => void
  onSettled: () => void
  onSessionClosed: () => void
  zIndex?: number
}) {
  const controller = useSettlementSheet({ restaurantId, session, onSettled, onSessionClosed })
  const {
    orders,
    shares,
    loadState,
    loadError,
    staged,
    error,
    committing,
    confirmingShareId,
    done,
    abnormal,
    abnormalReason,
    busy,
    projection,
    reload,
    setMethod,
    fillAll,
    confirmShare,
    commit,
    confirmAbnormal,
    setAbnormal,
    setAbnormalReason,
    cancelAbnormal,
  } = controller
  const {
    all,
    isSplitMode,
    unpaid,
    total,
    assigned,
    remaining,
    allStaged,
    settledShares,
    settledShareTotal,
    declaredCashTotal,
    pendingCardTotal,
    splitRemaining,
    tally,
    collected,
  } = projection
  const progressValue = isSplitMode
    ? (total > 0 ? ((total - splitRemaining) / total) * 100 : 0)
    : (all.length > 0 ? (assigned / all.length) * 100 : 0)

  if (done) {
    return <SettlementSuccessDialog tableLabel={tableLabel} tally={tally} collected={collected} onDone={onSessionClosed} zIndex={zIndex} />
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent showCloseButton={false} className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <style dangerouslySetInnerHTML={{ __html: SETTLEMENT_KEYFRAMES }} />

        <DialogHeader className="flex-row items-start gap-3 border-b px-5 py-4">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[10.5px] font-semibold tracking-[.08em] text-muted-foreground uppercase">{tableLabel} · Adisyonu kapat</span>
            <DialogTitle id="settlement-dialog-title" className="text-lg">Tahsilatı tamamla</DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-xs">
              <span>{loadState === 'loading' ? 'Siparişler yükleniyor' : loadState === 'error' ? 'Siparişler yüklenemedi' : `${all.length} sipariş`}</span><span style={{ color: 'var(--border-strong)' }}>·</span>
              <span>{settlementDurationLabel(session.openedAt)}</span>
            </DialogDescription>
          </div>
          <DialogClose disabled={busy} render={<Button type="button" variant="outline" size="icon" aria-label="Pencereyi kapat" />}><X /><span className="sr-only">Pencereyi kapat</span></DialogClose>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-5">
          {error && (
            <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>
          )}

          {loadState === 'loading' ? (
            <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Spinner />Adisyon yükleniyor…</div>
          ) : loadState === 'error' ? (
            <Alert variant="destructive"><AlertDescription className="flex flex-col gap-3 text-center">{loadError ?? SETTLEMENT_LOAD_ERROR}<Button type="button" variant="outline" onClick={reload}>Tekrar dene</Button></AlertDescription></Alert>
          ) : (
            <>
              <Card className={allStaged ? 'bg-[var(--positive-bg)] text-[var(--positive)]' : 'bg-muted/40'}>
                <CardHeader>
                  <div>
                    <CardTitle className="text-xs text-muted-foreground">
                      {isSplitMode
                        ? allStaged ? 'Split ödeme tamamlandı' : 'Split ödemede kalan'
                        : allStaged ? 'Tümü işaretlendi' : 'İşaretlenecek kalan'}
                    </CardTitle>
                    <div key={remaining} className="sm-mono mt-1 text-3xl leading-none font-bold tracking-tight tabular-nums">
                      {isSplitMode
                        ? allStaged ? formatSettlementAmount(settledShareTotal) : formatSettlementAmount(splitRemaining)
                        : allStaged ? formatSettlementAmount(collected) : formatSettlementAmount(remaining)}
                    </div>
                  </div>
                  <CardAction className="text-right text-xs leading-relaxed text-muted-foreground">
                    <div>Toplam <span className="sm-mono font-semibold text-foreground">{formatSettlementAmount(total)}</span></div>
                    <div>{isSplitMode ? `${shares.length} pay · ${settledShares.length} onaylı` : `${assigned}/${all.length} sipariş işaretlendi`}</div>
                  </CardAction>
                </CardHeader>
                <CardContent><Progress value={progressValue} aria-label={`Tahsilat ilerlemesi yüzde ${Math.round(progressValue)}`} /></CardContent>
              </Card>

              {isSplitMode && (
                <SettlementSplitStatus
                  shares={shares}
                  settledShareTotal={settledShareTotal}
                  declaredCashTotal={declaredCashTotal}
                  pendingCardTotal={pendingCardTotal}
                  splitRemaining={splitRemaining}
                  busy={busy}
                  confirmingShareId={confirmingShareId}
                  onConfirmShare={(shareId) => void confirmShare(shareId)}
                />
              )}

              {/* Quick fill */}
              {!isSplitMode && unpaid.length > 1 && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Tümüne uygula</span>
                  <div className="ml-auto flex gap-1.5">
                    {METHOD_LIST.map((m) => (
                      <Button key={m.id} type="button" variant="outline" size="sm" disabled={busy} onClick={() => fillAll(m.id)}>{m.icon}{m.label}</Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders */}
              <div className="mt-3.5 flex flex-col gap-2.5">
                {all.map((o, i) => {
                  const locked = o.paidAt !== null
                  const staged_m = staged[o.id] ?? null
                  return (
                    <Card key={o.id} className={locked ? 'bg-muted/40' : undefined}>
                      <CardHeader className="border-b">
                        <CardTitle className="flex items-center gap-2">Sipariş {i + 1}<Badge variant="secondary">#{o.id.slice(0, 6).toUpperCase()}</Badge></CardTitle>
                        <CardAction className="sm-mono text-sm font-bold tabular-nums">{formatSettlementAmount(o.total)}</CardAction>
                      </CardHeader>
                      <CardContent>
                        <SettlementOrderItems items={o.items} />
                      </CardContent>
                      {locked || isSplitMode ? (
                        <CardFooter className="gap-1.5 text-xs">
                          {(() => {
                            const isComp = o.paymentMethod === 'comp'
                            const isSplit = o.paymentMethod === 'split' || (isSplitMode && !locked)
                            const m = o.paymentMethod && o.paymentMethod !== 'iyzico' && o.paymentMethod !== 'split' ? METHODS[o.paymentMethod] : null
                            const label = o.paymentMethod === 'iyzico'
                              ? 'İyzico · online'
                              : isSplit
                                ? locked ? 'Hesap bölüşme · ödendi' : 'Split ödeme bekleniyor'
                                : m ? m.label : 'Ödendi'
                            return (
                              <Badge variant={o.paymentMethod === 'iyzico' ? 'positive' : isSplit ? 'warning' : 'secondary'}>
                                {locked ? <Check /> : cardIcon}
                                {isComp ? `${label} · ₺0` : label}
                              </Badge>
                            )
                          })()}
                          {o.settledByLabel && <span className="text-muted-foreground">· {o.settledByLabel}</span>}
                        </CardFooter>
                      ) : (
                        <CardFooter className="block border-0 bg-transparent pt-0"><SettlementMethodPicker value={staged_m} disabled={busy} onChange={(method) => setMethod(o.id, method)} /></CardFooter>
                      )}
                    </Card>
                  )
                })}
              </div>

              {/* Tally */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {METHOD_LIST.map((m) => (
                  <Card key={m.id} size="sm"><CardHeader><CardTitle className="text-xs text-muted-foreground">{m.label}</CardTitle></CardHeader><CardContent className="sm-mono font-bold tabular-nums">{formatSettlementAmount(tally[m.id])}</CardContent></Card>
                ))}
              </div>
            </>
          )}
          </div>
        </ScrollArea>

        {loadState === 'ready' && orders !== null && (
          <DialogFooter className="mx-0 mb-0 flex-col gap-2 p-4 sm:flex-col">
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose} className="flex-1">Vazgeç</Button>
              <Button type="button" variant={allStaged ? 'positive' : 'default'} size="lg" aria-busy={committing} disabled={!allStaged || busy} onClick={() => void commit()} className="flex-[1.6]">
                {committing
                  ? <><Spinner data-icon="inline-start" />Kapatılıyor…</>
                  : allStaged
                    ? <><Check data-icon="inline-start" />Masayı kapat · {formatSettlementAmount(collected)} tahsil</>
                    : isSplitMode
                      ? `Split ödeme kalan ${formatSettlementAmount(splitRemaining)}`
                      : `Kalan ${formatSettlementAmount(remaining)} işaretle`}
              </Button>
            </div>

            {!abnormal ? (
              <Button type="button" variant="link" size="sm" disabled={busy} onClick={() => setAbnormal(true)}>Ödeme almadan kapat</Button>
            ) : (
              <Alert variant="destructive" className="w-full">
                <TriangleAlert />
                <AlertDescription className="flex flex-col gap-2">
                  Tahsilat kaydı olmadan kapatılacak — <b>anormal kapatma</b> olarak raporlanır. Sebep zorunlu.
                <FieldGroup className="gap-2">
                  <Field data-invalid={!abnormalReason.trim()}>
                  <Input
                  value={abnormalReason}
                  onChange={(e) => setAbnormalReason(e.target.value)}
                  placeholder="Sebep (örn. müşteri ödemeden ayrıldı)"
                  autoFocus
                  aria-invalid={!abnormalReason.trim()}
                />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={cancelAbnormal} className="flex-1">Vazgeç</Button>
                    <Button type="button" variant="destructive" size="sm" aria-busy={committing} disabled={busy || !abnormalReason.trim()} onClick={() => void confirmAbnormal()} className="flex-1">{committing && <Spinner data-icon="inline-start" />}Yine de kapat</Button>
                  </div>
                </FieldGroup>
                </AlertDescription>
              </Alert>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
