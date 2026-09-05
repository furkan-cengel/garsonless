'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { SettlementLineItem } from '../../lib/settlement-items'
import { getTransferHistory, moveTable, transferOrderItemsToTable, transferOrdersToTable, undoTransfer, type TransferHistoryItem } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { clearRecentSettlementLoads, SETTLEMENT_LOAD_ERROR } from './settlement-load'
import { TableTransferOrderSelector } from './TableTransferOrderSelector'
import { TableTransferHistory, type TransferHistoryLoadState } from './TableTransferHistory'
import { loadTransferableOrders, transferOrdersLoadKey } from './transfer-orders-load'
import {
  buildInitialTransferItemSelection,
  fullySelectedOrderIds,
  selectedTransferItems,
  selectedTransferUnitCount,
  selectionNeedsOrderSplit,
  type TransferItemSelectionState,
} from './table-transfer-selection-model'
import { createTransferRequestIds } from './table-transfer-request'
type Mode = 'table_move' | 'account_transfer' | 'history'
type OrdersLoadState = 'idle' | 'loading' | 'ready' | 'error'
type TransferOrder = { id: string; total: number; items: SettlementLineItem[]; paidAt: string | null }
const EMPTY_ORDER_IDS: string[] = []

export default function TableTransferDialog({ open, mode: initialMode, sourceTableId, restaurantId, tables, sessions, initialOrderIds = EMPTY_ORDER_IDS, selectAllInitially = false, onClose, onChanged }: {
  open: boolean; mode: Mode; sourceTableId: string | null; restaurantId: string; tables: Array<{ id: string; label: string }>; sessions: Record<string, OpenSessionInfo>
  initialOrderIds?: string[]
  selectAllInitially?: boolean
  onClose: () => void; onChanged: (operationId?: string) => void
}) {
  const requestIds = useMemo(createTransferRequestIds, [])
  const submitting = useRef(false)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [targetId, setTargetId] = useState('')
  const [orders, setOrders] = useState<TransferOrder[]>([])
  const [ordersLoadState, setOrdersLoadState] = useState<OrdersLoadState>('idle')
  const [ordersLoadError, setOrdersLoadError] = useState('')
  const [ordersReloadKey, setOrdersReloadKey] = useState(0)
  const [selected, setSelected] = useState<TransferItemSelectionState>({})
  const [history, setHistory] = useState<TransferHistoryItem[]>([])
  const [historyLoadState, setHistoryLoadState] = useState<TransferHistoryLoadState>('idle')
  const [historyLoadError, setHistoryLoadError] = useState('')
  const [historyReloadKey, setHistoryReloadKey] = useState(0)
  const [historyNotice, setHistoryNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sourceSession = sourceTableId ? sessions[sourceTableId] : undefined
  const sourceSessionId = sourceSession?.sessionId
  const sourceSessionRevisionKey = sourceSession
    ? transferOrdersLoadKey(restaurantId, sourceSession)
    : null
  const wholeAccountOnlyReason = sourceSession && (sourceSession.splitSettledTotal > 0 || sourceSession.splitDeclaredCashTotal > 0)
    ? 'Bu adisyonda bölünmüş ödeme var; yalnız hesabın tamamı taşınabilir.'
    : null
  const tableLabels = Object.fromEntries(tables.map((table) => [table.id, table.label]))
  const tableLabel = (id: string) => tableLabels[id] ?? 'Masa'

  useEffect(() => {
    if (!open) return
    let active = true
    setMode(initialMode); setTargetId(''); setError(''); setHistoryNotice(''); setSelected({})
    if (initialMode === 'history') {
      setHistory([])
      setHistoryLoadError('')
      setHistoryLoadState('loading')
      void getTransferHistory(restaurantId)
        .then((result) => {
          if (!active) return
          if (!Array.isArray(result)) {
            setHistoryLoadError(result.error)
            setHistoryLoadState('error')
            return
          }
          setHistory(result)
          setHistoryLoadState('ready')
        })
        .catch(() => {
          if (!active) return
          setHistoryLoadError('Taşıma geçmişi alınamadı. Lütfen tekrar deneyin.')
          setHistoryLoadState('error')
        })
      return () => { active = false }
    }
    if (initialMode === 'account_transfer' && sourceSessionId) {
      setOrders([])
      setOrdersLoadError('')
      setOrdersLoadState('loading')
      void loadTransferableOrders(restaurantId, sourceSessionId, sourceSessionRevisionKey ?? '')
        .then((result) => {
          if (!active) return
          if ('error' in result) {
            setOrdersLoadError(result.error)
            setOrdersLoadState('error')
            return
          }
          setOrders(result)
          setSelected(buildInitialTransferItemSelection(result, initialOrderIds, selectAllInitially || Boolean(wholeAccountOnlyReason)))
          setOrdersLoadState('ready')
        })
        .catch(() => {
          if (!active) return
          setOrdersLoadError(SETTLEMENT_LOAD_ERROR)
          setOrdersLoadState('error')
        })
    }
    return () => { active = false }
  }, [historyReloadKey, initialMode, initialOrderIds, open, restaurantId, sourceSessionId, sourceSessionRevisionKey, ordersReloadKey, selectAllInitially, wholeAccountOnlyReason])

  if (!open) return null
  const targets = tables.filter((table) => table.id !== sourceTableId && (mode !== 'table_move' || !sessions[table.id]))
  const dialogTitle = mode === 'history' ? 'Taşıma Geçmişi' : mode === 'table_move' ? 'Masayı taşı' : 'Ürün veya sipariş taşı'
  const submit = async () => {
    if (submitting.current) return
    if (!sourceTableId || !targetId || !sourceSession) { setError('Kaynak ve hedef masa seçin.'); return }
    const itemSelections = selectedTransferItems(orders, selected)
    if (mode === 'account_transfer' && itemSelections.length === 0) { setError('En az bir ürün seçin.'); return }
    submitting.current = true
    setBusy(true); setError('')
    try {
      const intent = JSON.stringify([restaurantId, sourceSession.sessionId, sourceTableId, targetId, mode,
        [...itemSelections].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])
      const requestId = requestIds.forIntent(intent)
      const result = mode === 'table_move'
        ? await moveTable({ restaurantId, sourceTableId, targetTableId: targetId, requestId })
        : selectionNeedsOrderSplit(orders, selected)
          ? await transferOrderItemsToTable({ restaurantId, sourceTableId, targetTableId: targetId, selections: itemSelections, requestId })
          : await transferOrdersToTable({ restaurantId, sourceTableId, targetTableId: targetId, orderIds: fullySelectedOrderIds(orders, selected), requestId })
      if ('error' in result) { setError(result.error); return }
      clearRecentSettlementLoads(`transfer:${restaurantId}:`)
      clearRecentSettlementLoads(`settlement:${restaurantId}:`)
      requestIds.clear()
      onChanged(result.operationId); onClose()
    } catch {
      setError('Taşımanın sonucu doğrulanamadı. Aynı seçimle tekrar deneyin; tamamlanan işlem ikinci kez uygulanmaz.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const undo = async (item: TransferHistoryItem) => {
    setBusy(true); setError('')
    setHistoryNotice('')
    try {
      const result = await undoTransfer({ restaurantId, operationId: item.id })
      if ('error' in result) { setError(result.error); return }
      setHistoryLoadState('loading')
      const next = await getTransferHistory(restaurantId)
      if (!Array.isArray(next)) {
        setHistoryLoadError(next.error)
        setHistoryLoadState('error')
      } else {
        setHistory(next)
        setHistoryLoadState('ready')
        setHistoryNotice('Taşıma geri alındı.')
      }
      onChanged()
    } catch {
      setError('Taşıma geri alınamadı. Lütfen tekrar deneyin.')
    } finally {
      setBusy(false)
    }
  }

  const submitDisabled = busy || !targetId || (mode === 'account_transfer' && (ordersLoadState !== 'ready' || selectedTransferUnitCount(selected) === 0))

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose() }}>
    <DialogContent showCloseButton={false} className="tb-transfer-dialog-panel flex max-h-[82dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader className="flex-row items-center gap-3 border-b px-5 py-4">
        <DialogTitle id="table-transfer-dialog-title" className="flex-1">{dialogTitle}</DialogTitle>
        <DialogClose disabled={busy} render={<Button type="button" variant="outline" size="icon" aria-label="Pencereyi kapat" />}>
          <X /><span className="sr-only">Pencereyi kapat</span>
        </DialogClose>
      </DialogHeader>
      <DialogDescription className="sr-only">Masa, sipariş veya ürün taşıma işlemini tamamlayın.</DialogDescription>
      <ScrollArea className="tb-transfer-dialog-scroll min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-5">
        {mode==='history' ? <TableTransferHistory
          history={history}
          loadState={historyLoadState}
          loadError={historyLoadError}
          notice={historyNotice}
          busy={busy}
          tableLabels={tableLabels}
          onRetry={() => setHistoryReloadKey((value) => value + 1)}
          onClose={onClose}
          onUndo={(item) => { void undo(item) }}
        /> : <>
          <p className="text-sm text-muted-foreground"><strong className="text-foreground">{sourceTableId?tableLabel(sourceTableId):'Masa'}</strong> üzerindeki {mode==='table_move'?'açık adisyon bütünüyle boş hedef masaya taşınacak.':'taşınacak ürünleri ve adetleri seçin. Tam seçilen siparişler bütün olarak korunur.'}</p>
          {mode==='account_transfer'&&<div className="flex flex-col gap-2">
            {ordersLoadState==='loading'&&<div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Siparişler yükleniyor…</div>}
            {ordersLoadState==='error'&&<Alert variant="destructive"><AlertDescription className="flex flex-col gap-2">{ordersLoadError||SETTLEMENT_LOAD_ERROR}<Button type="button" variant="outline" size="sm" className="w-fit" onClick={()=>setOrdersReloadKey((value)=>value+1)}>Tekrar dene</Button></AlertDescription></Alert>}
            {ordersLoadState==='ready'&&orders.length===0&&<Empty className="border"><EmptyHeader><EmptyTitle>Taşınabilecek sipariş yok</EmptyTitle><EmptyDescription>Bu masada aktarılabilecek açık ürün bulunmuyor.</EmptyDescription></EmptyHeader></Empty>}
            {wholeAccountOnlyReason&&<Alert><AlertDescription>{wholeAccountOnlyReason}</AlertDescription></Alert>}
            {ordersLoadState==='ready'&&orders.length>0&&<TableTransferOrderSelector orders={orders} selected={selected} wholeAccountOnlyReason={wholeAccountOnlyReason} onChange={setSelected} />}
          </div>}
          <Field>
            <FieldLabel htmlFor="table-transfer-target">Hedef masa</FieldLabel>
            <Select value={targetId || null} onValueChange={(value) => setTargetId(value ?? '')}>
              <SelectTrigger id="table-transfer-target" className="h-10 w-full">
                <SelectValue placeholder="Masa seçin">{targetId ? tableLabel(targetId) : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent><SelectGroup>{targets.map((table)=><SelectItem key={table.id} value={table.id}>{table.label}{sessions[table.id]?' · Dolu, adisyon birleşir':' · Boş'}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          {targetId&&sessions[targetId]&&mode==='account_transfer'&&<Alert><AlertDescription>Hedef masada açık adisyon var. Seçili ürünler mevcut hesaba eklenecek.</AlertDescription></Alert>}
        </>}
        {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
      </ScrollArea>
      {mode !== 'history' && <DialogFooter className="mx-0 mb-0 p-4">
        <Button className="tb-transfer-dialog-submit w-full" size="lg" aria-busy={busy} disabled={submitDisabled} type="button" onClick={()=>void submit()}>
          {busy && <Spinner aria-hidden="true" data-icon="inline-start" />}{busy ? 'Taşınıyor…' : mode==='account_transfer'?`Taşımayı onayla · ${selectedTransferUnitCount(selected)} adet`:'Taşımayı onayla'}
        </Button>
      </DialogFooter>}
    </DialogContent>
  </Dialog>
}
