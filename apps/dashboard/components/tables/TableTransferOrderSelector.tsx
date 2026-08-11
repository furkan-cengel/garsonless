'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldLegend, FieldSet } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
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

function ProductSelection({ orderId, item, selected, locked, onChange }: {
  orderId: string
  item: SettlementLineItem
  selected: TransferItemSelectionState
  locked: boolean
  onChange: (next: TransferItemSelectionState) => void
}) {
  const key = transferItemKey(orderId, item.lineIndex)
  const quantity = selected[key]
  return <Field orientation="horizontal" data-transfer-product-row className="min-h-14 border-t py-2">
    <Checkbox aria-label={`${item.name} ürününü seç`} checked={Boolean(quantity)} disabled={locked} onCheckedChange={(checked)=>onChange(toggleTransferItem(selected,orderId,item,checked))} />
    <FieldContent><SettlementOrderItems items={[item]} compact /></FieldContent>
    <div data-transfer-product-value className="flex w-24 justify-end">
      {quantity ? <NativeSelect aria-label={`${item.name} taşınacak adet`} value={quantity} disabled={locked} size="sm" onChange={(event)=>onChange(setTransferItemQuantity(selected,orderId,item,Number(event.target.value)))} className="w-24">
        {Array.from({length:item.quantity},(_,index)=>index+1).map((value)=><NativeSelectOption key={value} value={value}>{value} / {item.quantity}</NativeSelectOption>)}
      </NativeSelect> : <strong className="whitespace-nowrap text-xs">₺{item.total.toLocaleString('tr-TR')}</strong>}
    </div>
  </Field>
}

export function TableTransferOrderSelector({ orders, selected, wholeAccountOnlyReason, onChange }: {
  orders: TransferOrder[]
  selected: TransferItemSelectionState
  wholeAccountOnlyReason?: string | null
  onChange: (next: TransferItemSelectionState) => void
}) {
  return <FieldSet className="gap-2">
    <FieldLegend className="sr-only">Taşınacak ürünler</FieldLegend>
    {orders.map((order,index)=>{
      const state=orderSelectionState(order,selected)
      return <Card key={order.id} size="sm" className={state === 'none' ? undefined : 'bg-muted/40'}>
        <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-3 border-b pb-3">
          <Checkbox checked={state === 'all'} indeterminate={state === 'partial'} aria-label={`${index+1}. siparişin tamamını seç`} disabled={Boolean(wholeAccountOnlyReason)} onCheckedChange={(checked)=>onChange(toggleTransferOrder(selected,order,checked))} />
          <CardTitle>{index+1}. sipariş</CardTitle>
          <CardAction className="flex items-center gap-2">{order.paid_at&&<Badge variant="positive">Tahsil edildi</Badge>}<strong className="text-sm tabular-nums">₺{order.total.toLocaleString('tr-TR')}</strong></CardAction>
        </CardHeader>
        <CardContent>
          {order.paid_at&&<p className="mb-2 text-xs text-muted-foreground">Tahsil edilmiş sipariş yalnız bütün olarak taşınabilir.</p>}
          {order.items.map((item)=><ProductSelection key={item.lineIndex} orderId={order.id} item={item} selected={selected} locked={Boolean(order.paid_at||wholeAccountOnlyReason)} onChange={onChange} />)}
        </CardContent>
      </Card>
    })}
  </FieldSet>
}
