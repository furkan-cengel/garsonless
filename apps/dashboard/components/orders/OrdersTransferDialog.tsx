'use client'

import { useMemo, useState } from 'react'
import { transferOrdersToTable } from '../../lib/actions/tables'
import type { Order } from './useOrdersRealtime'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'

export default function OrdersTransferDialog({ restaurantId, orders, tables, onClose, onDone }: {
  restaurantId: string
  orders: Order[]
  tables: Array<{ id: string; label: string }>
  onClose: () => void
  onDone: (operationId: string) => void
}) {
  const active = useMemo(() => orders.filter((order) => order.table_id && order.status !== 'cancelled' && order.status !== 'served'), [orders])
  const sourceIds = [...new Set(active.map((order) => order.table_id as string))]
  const [source, setSource] = useState(sourceIds[0] ?? '')
  const [target, setTarget] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sourceOrders = active.filter((order) => order.table_id === source)
  const label = (id: string) => tables.find((table) => table.id === id)?.label ?? 'Masa'

  const submit = async () => {
    if (!source || !target || selected.size === 0) {
      setError('Kaynak, hedef ve sipariş seçin.')
      return
    }
    setBusy(true)
    setError('')
    const result = await transferOrdersToTable({
      restaurantId,
      sourceTableId: source,
      targetTableId: target,
      orderIds: [...selected],
      requestId: crypto.randomUUID(),
    })
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onDone(result.operationId)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent showCloseButton={!busy} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Siparişleri başka masaya taşı</DialogTitle>
          <DialogDescription>Kaynak masadaki siparişleri seçip boş hedef masaya aktarın.</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Kaynak masa</FieldLabel>
            <Select value={source} onValueChange={(value) => { setSource(value ?? ''); setSelected(new Set()) }} disabled={busy}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Kaynak masa seçin" /></SelectTrigger>
              <SelectContent><SelectGroup>{sourceIds.map((id) => <SelectItem key={id} value={id}>{label(id)}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Taşınacak siparişler</FieldLabel>
            <ScrollArea className="max-h-56 rounded-lg border">
              <div className="flex flex-col gap-1 p-2">
                {sourceOrders.map((order) => (
                  <FieldLabel key={order.id} className="min-h-11 flex-row items-center rounded-md px-2 hover:bg-muted">
                    <Checkbox
                      checked={selected.has(order.id)}
                      disabled={busy}
                      onCheckedChange={(checked) => setSelected((current) => {
                        const next = new Set(current)
                        if (checked === true) next.add(order.id)
                        else next.delete(order.id)
                        return next
                      })}
                    />
                    <span className="min-w-0 flex-1 font-mono text-xs">#{order.id.slice(0, 6).toUpperCase()}</span>
                    <strong>₺{order.total.toLocaleString('tr-TR')}</strong>
                  </FieldLabel>
                ))}
              </div>
            </ScrollArea>
          </Field>

          <Field>
            <FieldLabel>Hedef masa</FieldLabel>
            <Select value={target} onValueChange={(value) => setTarget(value ?? '')} disabled={busy}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Masa seçin" /></SelectTrigger>
              <SelectContent><SelectGroup>{tables.filter((table) => table.id !== source).map((table) => <SelectItem key={table.id} value={table.id}>{table.label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <DialogFooter className="mt-1">
          <Button variant="outline" disabled={busy} onClick={onClose}>Vazgeç</Button>
          <Button disabled={busy || selected.size === 0 || !target} onClick={() => void submit()}>
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? 'Taşınıyor…' : `${selected.size} siparişi taşı`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
