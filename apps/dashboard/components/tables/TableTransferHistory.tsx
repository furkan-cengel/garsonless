'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import {
  EMPTY_TRANSFER_HISTORY_FILTERS,
  filterTransferHistory,
  transferKindLabel,
  transferSessionOutcome,
  transferStatusLabel,
  type TransferHistoryFilters,
  type TransferHistoryViewItem,
} from './table-transfer-history-model'

export type TransferHistoryLoadState = 'idle' | 'loading' | 'ready' | 'error'

function AuditValue({ children }: { children: string }) {
  return <code style={{ fontSize: 10.5, color: 'var(--text-2)', overflowWrap: 'anywhere' }}>{children}</code>
}

export function TableTransferHistory({
  history,
  loadState,
  loadError,
  notice,
  busy,
  tableLabels,
  onRetry,
  onClose,
  onUndo,
}: {
  history: TransferHistoryViewItem[]
  loadState: TransferHistoryLoadState
  loadError: string
  notice: string
  busy: boolean
  tableLabels: Record<string, string>
  onRetry: () => void
  onClose: () => void
  onUndo: (item: TransferHistoryViewItem) => void
}) {
  const [filters, setFilters] = useState<TransferHistoryFilters>(EMPTY_TRANSFER_HISTORY_FILTERS)
  const filtered = useMemo(
    () => filterTransferHistory(history, filters, tableLabels),
    [filters, history, tableLabels],
  )
  const filtersActive = filters.query.trim() !== '' || filters.kind !== 'all' || filters.status !== 'all'

  if (loadState === 'idle' || loadState === 'loading') {
    return <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Spinner />Taşıma geçmişi yükleniyor…</div>
  }
  if (loadState === 'error') {
    return (
      <Alert variant="destructive"><AlertDescription className="flex flex-col gap-2">{loadError || 'Taşıma geçmişi alınamadı.'}<Button type="button" variant="outline" size="sm" className="w-fit" onClick={onRetry}>Tekrar dene</Button></AlertDescription></Alert>
    )
  }
  if (loadState === 'ready' && history.length === 0) {
    return (
      <Empty className="border bg-muted/30"><EmptyHeader><EmptyTitle>Henüz taşıma yok</EmptyTitle><EmptyDescription>İlk masa veya hesap taşımanız tamamlandığında burada görünecek.</EmptyDescription></EmptyHeader><Button type="button" variant="outline" onClick={onClose}>Masalara dön</Button></Empty>
    )
  }

  return (
    <>
      <div aria-label="Taşıma geçmişi filtreleri" className="grid gap-2">
        <InputGroup>
          <InputGroupInput
          type="search"
          aria-label="Taşıma geçmişinde ara"
          placeholder="Masa, yetkili veya işlem kimliği ara"
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          />
          <InputGroupAddon><Search /></InputGroupAddon>
        </InputGroup>
        <div className="grid grid-cols-2 gap-2">
          <NativeSelect aria-label="Taşıma türü filtresi" value={filters.kind} onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value as TransferHistoryFilters['kind'] }))} className="w-full">
            <NativeSelectOption value="all">Tüm işlemler</NativeSelectOption><NativeSelectOption value="table_move">Masa taşıma</NativeSelectOption><NativeSelectOption value="account_transfer">Hesap taşıma</NativeSelectOption><NativeSelectOption value="item_transfer">Ürün taşıma</NativeSelectOption>
          </NativeSelect>
          <NativeSelect aria-label="Taşıma durumu filtresi" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TransferHistoryFilters['status'] }))} className="w-full">
            <NativeSelectOption value="all">Tüm durumlar</NativeSelectOption><NativeSelectOption value="active">Aktif</NativeSelectOption><NativeSelectOption value="undone">Geri alındı</NativeSelectOption><NativeSelectOption value="locked">Kilitli</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex min-h-7 items-center gap-2 text-xs text-muted-foreground">
          <span className="flex-1">{filtered.length} / {history.length} işlem</span>
          {filtersActive && <Button type="button" variant="link" size="xs" className="px-0" onClick={() => setFilters(EMPTY_TRANSFER_HISTORY_FILTERS)}>Filtreleri temizle</Button>}
        </div>
      </div>

      {filtered.length === 0 && (
        <Empty className="border"><EmptyHeader><EmptyTitle>Taşıma bulunamadı</EmptyTitle><EmptyDescription>Filtreleri değiştirerek tekrar deneyin.</EmptyDescription></EmptyHeader></Empty>
      )}

      {filtered.map((item) => {
        const statusLabel = transferStatusLabel(item.status)
        return (
          <Card key={item.id} size="sm">
            <CardHeader className="border-b">
              <CardTitle className="flex flex-wrap items-center gap-2">{transferKindLabel(item.kind)} · {item.orderCount} sipariş <Badge variant={item.status === 'active' ? 'positive' : item.status === 'locked' ? 'destructive' : 'secondary'}>{statusLabel}</Badge></CardTitle>
              <div className="text-xs text-muted-foreground">
                  {tableLabels[item.sourceTableId] ?? 'Masa'} → {tableLabels[item.targetTableId] ?? 'Masa'}
              </div>
              <div className="text-xs text-muted-foreground">
                  İşlemi yapan: <strong>{item.actorLabel}</strong> · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('tr-TR')}</time>
              </div>
              {item.lockReason && <Alert variant="destructive"><AlertDescription>{item.lockReason}</AlertDescription></Alert>}
              {item.status === 'active' && <CardAction><Button disabled={busy} type="button" variant="outline" size="sm" onClick={() => onUndo(item)}>Geri al</Button></CardAction>}
            </CardHeader>
            <CardContent>
            <Collapsible>
              <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="w-full justify-between" />}>Audit ayrıntıları<ChevronDown data-icon="inline-end" /></CollapsibleTrigger>
              <CollapsibleContent>
              <dl style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '7px 10px', margin: '8px 0 0', fontSize: 11 }}>
                <dt style={{ color: 'var(--text-3)' }}>Sonuç</dt><dd style={{ margin: 0 }}>{transferSessionOutcome(item)}</dd>
                <dt style={{ color: 'var(--text-3)' }}>İşlem kimliği</dt><dd style={{ margin: 0 }}><AuditValue>{item.id}</AuditValue></dd>
                <dt style={{ color: 'var(--text-3)' }}>İstek kimliği</dt><dd style={{ margin: 0 }}><AuditValue>{item.requestId}</AuditValue></dd>
                <dt style={{ color: 'var(--text-3)' }}>Kaynak adisyon</dt><dd style={{ margin: 0 }}><AuditValue>{item.sourceSessionId}</AuditValue></dd>
                <dt style={{ color: 'var(--text-3)' }}>Hedef adisyon</dt><dd style={{ margin: 0 }}><AuditValue>{item.targetSessionId}</AuditValue></dd>
                {item.undoneAt && <><dt style={{ color: 'var(--text-3)' }}>Geri alma</dt><dd style={{ margin: 0 }}>{item.undoActorLabel ?? 'Başka bir yetkili'} · <time dateTime={item.undoneAt}>{new Date(item.undoneAt).toLocaleString('tr-TR')}</time></dd></>}
              </dl>
              </CollapsibleContent>
            </Collapsible>
            </CardContent>
          </Card>
        )
      })}
      {notice && <Alert className="border-[var(--positive)]/30 bg-[var(--positive-bg)] text-[var(--positive)]"><AlertDescription className="text-current" role="status" aria-live="polite">{notice}</AlertDescription></Alert>}
    </>
  )
}
