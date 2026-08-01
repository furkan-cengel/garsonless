'use client'

import { useEffect, useRef } from 'react'
import type { SettlementLineItem } from '../../lib/settlement-items'
import { SettlementOrderItems } from './SettlementOrderItems'
import {
  orderSelectionState,
  setTransferItemQuantity,
  toggleTransferItem,
  toggleTransferOrder,
  transferItemKey,
  type TransferItemSelectionState,
  type TransferSelectionOrder,
} from './table-transfer-selection-model'

type TransferOrder = TransferSelectionOrder & { total: number; paid_at: string | null }

function OrderCheckbox({ state, label, disabled = false, onChange }: { state: 'none' | 'partial' | 'all'; label: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = state === 'partial' }, [state])
  return <label style={{width:44,height:44,display:'grid',placeItems:'center',margin:'-10px 0'}}><input ref={ref} type="checkbox" aria-label={label} checked={state === 'all'} disabled={disabled} onChange={(event) => onChange(event.target.checked)} style={{ width:20,height:20,margin:0 }} /></label>
}

function ProductSelection({ orderId, item, selected, locked, onChange }: {
  orderId: string
  item: SettlementLineItem
  selected: TransferItemSelectionState
  locked: boolean
  onChange: (next: TransferItemSelectionState) => void
}) {
  const key = transferItemKey(orderId, item.lineIndex)
  const quantity = selected[key]
  return <div data-transfer-product-row style={{display:'grid',gridTemplateColumns:'44px minmax(0,1fr) 92px',gap:6,alignItems:'center',minHeight:58,padding:'7px 0',borderTop:'1px solid var(--divider)'}}>
    <label style={{width:44,height:44,display:'grid',placeItems:'center'}}><input type="checkbox" aria-label={`${item.name} ürününü seç`} checked={Boolean(quantity)} disabled={locked} onChange={(event)=>onChange(toggleTransferItem(selected,orderId,item,event.target.checked))} style={{width:20,height:20,margin:0}} /></label>
    <SettlementOrderItems items={[item]} compact />
    <div data-transfer-product-value style={{width:92,height:44,display:'grid',placeItems:'center end'}}>
      {quantity ? <select aria-label={`${item.name} taşınacak adet`} value={quantity} disabled={locked} onChange={(event)=>onChange(setTransferItemQuantity(selected,orderId,item,Number(event.target.value)))} style={{width:92,height:44,border:'1px solid var(--border-strong)',borderRadius:7,background:'var(--surface)',color:'var(--text)',padding:'0 8px',fontWeight:750}}>
        {Array.from({length:item.quantity},(_,index)=>index+1).map((value)=><option key={value} value={value}>{value} / {item.quantity}</option>)}
      </select> : <strong style={{fontSize:11.5,whiteSpace:'nowrap'}}>₺{item.total.toLocaleString('tr-TR')}</strong>}
    </div>
  </div>
}

export function TableTransferOrderSelector({ orders, selected, wholeAccountOnlyReason, onChange }: {
  orders: TransferOrder[]
  selected: TransferItemSelectionState
  wholeAccountOnlyReason?: string | null
  onChange: (next: TransferItemSelectionState) => void
}) {
  return <div role="group" aria-label="Taşınacak ürünler" style={{display:'grid',gap:9}}>
    {orders.map((order,index)=>{
      const state=orderSelectionState(order,selected)
      return <section key={order.id} style={{padding:'10px 11px 0',border:'1px solid var(--border)',borderRadius:10,background:state==='none'?'var(--surface)':'color-mix(in srgb, var(--action) 4%, var(--surface))'}}>
        <header style={{display:'flex',alignItems:'center',gap:9,paddingBottom:9}}>
          <OrderCheckbox state={state} label={`${index+1}. siparişin tamamını seç`} disabled={Boolean(wholeAccountOnlyReason)} onChange={(checked)=>onChange(toggleTransferOrder(selected,order,checked))} />
          <strong style={{flex:1,fontSize:12.5}}>{index+1}. sipariş</strong>
          {order.paid_at&&<span style={{fontSize:10.5,fontWeight:750,color:'var(--positive)'}}>Tahsil edildi</span>}
          <strong style={{fontSize:12.5}}>₺{order.total.toLocaleString('tr-TR')}</strong>
        </header>
        {order.paid_at&&<p style={{margin:'0 0 8px 27px',color:'var(--text-3)',fontSize:10.5}}>Tahsil edilmiş sipariş yalnız bütün olarak taşınabilir.</p>}
        {order.items.map((item)=><ProductSelection key={item.lineIndex} orderId={order.id} item={item} selected={selected} locked={Boolean(order.paid_at||wholeAccountOnlyReason)} onChange={onChange} />)}
      </section>
    })}
  </div>
}
