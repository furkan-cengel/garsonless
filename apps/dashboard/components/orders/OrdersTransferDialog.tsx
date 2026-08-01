'use client'
import { useMemo, useState } from 'react'
import { transferOrdersToTable } from '../../lib/actions/tables'
import type { Order } from './useOrdersRealtime'
import { AccessibleDialog } from '../tables/AccessibleDialog'

export default function OrdersTransferDialog({ restaurantId, orders, tables, onClose, onDone }: { restaurantId:string;orders:Order[];tables:Array<{id:string;label:string}>;onClose:()=>void;onDone:(operationId:string)=>void }) {
  const active = useMemo(()=>orders.filter((order)=>order.table_id&&order.status!=='cancelled'&&order.status!=='served'),[orders])
  const sourceIds=[...new Set(active.map((order)=>order.table_id as string))]
  const [source,setSource]=useState(sourceIds[0]??'')
  const [target,setTarget]=useState('')
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const sourceOrders=active.filter((order)=>order.table_id===source)
  const label=(id:string)=>tables.find((table)=>table.id===id)?.label??'Masa'
  const submit=async()=>{if(!source||!target||selected.size===0){setError('Kaynak, hedef ve sipariş seçin.');return}setBusy(true);setError('');const result=await transferOrdersToTable({restaurantId,sourceTableId:source,targetTableId:target,orderIds:[...selected],requestId:crypto.randomUUID()});setBusy(false);if('error'in result){setError(result.error);return}onDone(result.operationId);onClose()}
  return (
    <AccessibleDialog
      labelledBy="orders-transfer-title"
      onClose={onClose}
      closeDisabled={busy}
      className="orders-transfer-overlay"
      style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.4)',display:'grid',placeItems:'center',padding:20}}
    >
      <style>{`@media(max-width:600px){.orders-transfer-overlay{padding:0!important}.orders-transfer-dialog{width:100%!important;height:100dvh;max-height:none!important;border-radius:0!important}}`}</style>
      <div className="orders-transfer-dialog" style={{width:'min(560px,100%)',maxHeight:'82vh',overflow:'auto',background:'var(--surface)',borderRadius:14,boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{padding:'10px 12px 10px 18px',borderBottom:'1px solid var(--divider)',display:'flex',alignItems:'center',gap:8}}>
          <strong id="orders-transfer-title" style={{flex:1}}>Siparişleri başka masaya taşı</strong>
          <button data-modal-initial-focus disabled={busy} type="button" aria-label="Hesap taşıma penceresini kapat" onClick={onClose} style={{width:44,height:44,border:0,borderRadius:8,background:'transparent',fontSize:20,cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:18,display:'grid',gap:12}}>
          <label style={{display:'grid',gap:5,fontSize:12,fontWeight:700}}>
            Kaynak masa
            <select value={source} onChange={(e)=>{setSource(e.target.value);setSelected(new Set())}} style={{height:44,border:'1px solid var(--border-strong)',borderRadius:8,background:'var(--surface)',padding:'0 10px'}}>{sourceIds.map((id)=><option key={id} value={id}>{label(id)}</option>)}</select>
          </label>
          <div style={{display:'grid',gap:7}}>{sourceOrders.map((order)=><label key={order.id} style={{display:'flex',alignItems:'center',minHeight:44,gap:9,padding:9,border:'1px solid var(--border)',borderRadius:8}}><input type="checkbox" checked={selected.has(order.id)} onChange={(e)=>setSelected((current)=>{const next=new Set(current);if(e.target.checked)next.add(order.id);else next.delete(order.id);return next})}/><span style={{flex:1}}>#{order.id.slice(0,6).toUpperCase()}</span><strong>₺{order.total.toLocaleString('tr-TR')}</strong></label>)}</div>
          <label style={{display:'grid',gap:5,fontSize:12,fontWeight:700}}>
            Hedef masa
            <select value={target} onChange={(e)=>setTarget(e.target.value)} style={{height:44,border:'1px solid var(--border-strong)',borderRadius:8,background:'var(--surface)',padding:'0 10px'}}><option value="">Masa seçin</option>{tables.filter((table)=>table.id!==source).map((table)=><option key={table.id} value={table.id}>{table.label}</option>)}</select>
          </label>
          {error&&<div role="alert" style={{padding:10,background:'var(--critical-bg)',color:'var(--critical)',borderRadius:8}}>{error}</div>}
          <button disabled={busy} type="button" onClick={()=>void submit()} style={{minHeight:44,border:0,borderRadius:8,background:'var(--action)',color:'var(--on-action)',fontWeight:750}}>{busy?'Taşınıyor…':`${selected.size} siparişi taşı`}</button>
        </div>
      </div>
    </AccessibleDialog>
  )
}
