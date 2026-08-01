'use client'

import { useEffect, useState } from 'react'
import { getSessionSettlement } from '../../lib/actions/settlement'
import type { SettlementLineItem } from '../../lib/settlement-items'
import { getTransferHistory, moveTable, transferOrderItemsToTable, transferOrdersToTable, undoTransfer, type TransferHistoryItem } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { AccessibleDialog } from './AccessibleDialog'
import { SETTLEMENT_LOAD_ERROR, withSettlementLoadTimeout } from './settlement-load'
import { TableTransferOrderSelector } from './TableTransferOrderSelector'
import { TableTransferHistory, type TransferHistoryLoadState } from './TableTransferHistory'
import {
  buildInitialTransferItemSelection,
  fullySelectedOrderIds,
  selectedTransferItems,
  selectedTransferUnitCount,
  selectionNeedsOrderSplit,
  type TransferItemSelectionState,
} from './table-transfer-selection-model'
type Mode = 'table_move' | 'account_transfer' | 'history'
type OrdersLoadState = 'idle' | 'loading' | 'ready' | 'error'
type TransferOrder = { id: string; total: number; items: SettlementLineItem[]; paid_at: string | null }
const EMPTY_ORDER_IDS: string[] = []

export default function TableTransferDialog({ open, mode: initialMode, sourceTableId, restaurantId, tables, sessions, initialOrderIds = EMPTY_ORDER_IDS, selectAllInitially = false, onClose, onChanged }: {
  open: boolean; mode: Mode; sourceTableId: string | null; restaurantId: string; tables: Array<{ id: string; label: string }>; sessions: Record<string, OpenSessionInfo>
  initialOrderIds?: string[]
  selectAllInitially?: boolean
  onClose: () => void; onChanged: (operationId?: string) => void
}) {
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
    if (initialMode === 'account_transfer' && sourceSession) {
      setOrders([])
      setOrdersLoadError('')
      setOrdersLoadState('loading')
      void withSettlementLoadTimeout(() => getSessionSettlement(sourceSession.sessionId, restaurantId))
        .then((result) => {
          if (!active) return
          if ('error' in result) {
            setOrdersLoadError(result.error)
            setOrdersLoadState('error')
            return
          }
          const nextOrders = result.orders.map(({ id, total, items, paidAt }) => ({ id, total, items, paid_at: paidAt }))
          setOrders(nextOrders)
          setSelected(buildInitialTransferItemSelection(nextOrders, initialOrderIds, selectAllInitially || Boolean(wholeAccountOnlyReason)))
          setOrdersLoadState('ready')
        })
        .catch(() => {
          if (!active) return
          setOrdersLoadError(SETTLEMENT_LOAD_ERROR)
          setOrdersLoadState('error')
        })
    }
    return () => { active = false }
  }, [historyReloadKey, initialMode, initialOrderIds, open, restaurantId, sourceSession, ordersReloadKey, selectAllInitially, wholeAccountOnlyReason])

  if (!open) return null
  const targets = tables.filter((table) => table.id !== sourceTableId && (mode !== 'table_move' || !sessions[table.id]))
  const dialogTitle = mode === 'history' ? 'Taşıma Geçmişi' : mode === 'table_move' ? 'Masayı taşı' : 'Ürün veya sipariş taşı'
  const submit = async () => {
    if (!sourceTableId || !targetId || !sourceSession) { setError('Kaynak ve hedef masa seçin.'); return }
    const itemSelections = selectedTransferItems(orders, selected)
    if (mode === 'account_transfer' && itemSelections.length === 0) { setError('En az bir ürün seçin.'); return }
    setBusy(true); setError('')
    try {
      const requestId = crypto.randomUUID()
      const result = mode === 'table_move'
        ? await moveTable({ restaurantId, sourceTableId, targetTableId: targetId, requestId })
        : selectionNeedsOrderSplit(orders, selected)
          ? await transferOrderItemsToTable({ restaurantId, sourceTableId, targetTableId: targetId, selections: itemSelections, requestId })
          : await transferOrdersToTable({ restaurantId, sourceTableId, targetTableId: targetId, orderIds: fullySelectedOrderIds(orders, selected), requestId })
      if ('error' in result) { setError(result.error); return }
      onChanged(result.operationId); onClose()
    } catch {
      setError('Taşıma tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
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

  return <AccessibleDialog labelledBy="table-transfer-dialog-title" onClose={onClose} closeDisabled={busy} style={{ position:'fixed',inset:0,zIndex:180,background:'rgba(0,0,0,.38)',display:'grid',placeItems:'center',padding:20 }}>
    <div className="tb-transfer-dialog-panel" style={{ width:'min(560px,100%)',maxHeight:'82vh',overflow:'hidden',display:'flex',flexDirection:'column',background:'var(--surface)',borderRadius:14,border:'1px solid var(--border)',boxShadow:'0 24px 80px rgba(0,0,0,.28)' }}>
      <div style={{ padding:'16px 18px',borderBottom:'1px solid var(--divider)',display:'flex',alignItems:'center',gap:8 }}>
        <strong id="table-transfer-dialog-title" style={{ flex:1 }}>{dialogTitle}</strong>
        <button type="button" data-modal-initial-focus disabled={busy} aria-label="Pencereyi kapat" onClick={onClose} style={{ width:44,height:44,display:'grid',placeItems:'center',border:'1px solid var(--border)',borderRadius:10,background:'var(--surface-2)',fontSize:20,cursor:busy?'not-allowed':'pointer',color:'var(--text-3)',opacity:busy?.6:1 }}>×</button>
      </div>
      <div className="tb-transfer-dialog-scroll" style={{ padding:18,display:'grid',gap:14,overflowY:'auto',overscrollBehavior:'contain' }}>
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
          <div style={{fontSize:12.5,color:'var(--text-3)'}}><strong style={{color:'var(--text)'}}>{sourceTableId?tableLabel(sourceTableId):'Masa'}</strong> üzerindeki {mode==='table_move'?'açık adisyon bütünüyle boş hedef masaya taşınacak.':'taşınacak ürünleri ve adetleri seçin. Tam seçilen siparişler bütün olarak korunur.'}</div>
          {mode==='account_transfer'&&<div style={{display:'grid',gap:7}}>
            {ordersLoadState==='loading'&&<div role="status" style={{padding:12,textAlign:'center',color:'var(--text-3)',fontSize:12.5}}>Siparişler yükleniyor…</div>}
            {ordersLoadState==='error'&&<div role="alert" style={{padding:12,borderRadius:8,background:'var(--critical-bg)',color:'var(--critical)',fontSize:12}}>{ordersLoadError||SETTLEMENT_LOAD_ERROR}<button type="button" onClick={()=>setOrdersReloadKey((value)=>value+1)} style={{display:'block',marginTop:9,border:'1px solid currentColor',borderRadius:7,background:'transparent',color:'inherit',padding:'6px 9px',fontWeight:700,cursor:'pointer'}}>Tekrar dene</button></div>}
            {ordersLoadState==='ready'&&orders.length===0&&<div style={{padding:12,textAlign:'center',color:'var(--text-3)',fontSize:12.5}}>Taşınabilecek sipariş yok.</div>}
            {wholeAccountOnlyReason&&<div role="status" style={{padding:10,borderRadius:8,background:'var(--warning-bg)',color:'var(--warning)',fontSize:12}}>{wholeAccountOnlyReason}</div>}
            {ordersLoadState==='ready'&&orders.length>0&&<TableTransferOrderSelector orders={orders} selected={selected} wholeAccountOnlyReason={wholeAccountOnlyReason} onChange={setSelected} />}
          </div>}
          <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>Hedef masa<select value={targetId} onChange={(event)=>setTargetId(event.target.value)} style={{height:38,border:'1px solid var(--border-strong)',borderRadius:8,background:'var(--surface)',padding:'0 10px'}}><option value="">Masa seçin</option>{targets.map((table)=><option key={table.id} value={table.id}>{table.label}{sessions[table.id]?' · Dolu, adisyon birleşir':' · Boş'}</option>)}</select></label>
          {targetId&&sessions[targetId]&&mode==='account_transfer'&&<div role="status" style={{padding:10,borderRadius:8,background:'var(--warning-bg)',color:'var(--warning)',fontSize:12}}>Hedef masada açık adisyon var. Seçili ürünler mevcut hesaba eklenecek.</div>}
          <button className="tb-transfer-dialog-submit" disabled={busy||!targetId||(mode==='account_transfer'&&(ordersLoadState!=='ready'||selectedTransferUnitCount(selected)===0))} type="button" onClick={()=>void submit()} style={{height:44,position:'sticky',bottom:0,zIndex:2,border:'none',borderRadius:8,background:'var(--action)',color:'var(--on-action)',fontWeight:750,cursor:'pointer',boxShadow:'0 -10px 20px var(--surface)'}}>{busy?'Taşınıyor…':mode==='account_transfer'?`Taşımayı onayla · ${selectedTransferUnitCount(selected)} adet`:'Taşımayı onayla'}</button>
        </>}
        {error&&<div role="alert" style={{padding:10,borderRadius:8,background:'var(--critical-bg)',color:'var(--critical)',fontSize:12}}>{error}</div>}
      </div>
    </div>
  </AccessibleDialog>
}
