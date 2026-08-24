'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readOrderLineSnapshots, type PaymentMethod } from '@garsonless/db/browser'
import { getOrderHistory, type HistoryOrder } from '../../lib/actions/orders'
import { historyTerminalAt } from './order-history-model'
import { I } from '../../lib/ui'
import { formatCurrency } from '../../lib/utils'
import { paymentMethodBadge } from '../../lib/payment-method'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Tab = 'all' | 'done' | 'cancelled'

function dayLabel(iso: string): string {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Dün'
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })
}

export default function HistoryModal({ restaurantId, tableLabels, onClose, onReceipt }: {
  restaurantId: string
  tableLabels: Record<string, string>
  onClose: () => void
  onReceipt: (order: HistoryOrder, tableLabel: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [truncated, setTruncated] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)

  const loadHistory = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await getOrderHistory(restaurantId)
      if (request !== requestRef.current) return
      if ('error' in res) setError(res.error)
      else { setOrders(res.orders); setTruncated(res.truncated) }
    } catch {
      if (request === requestRef.current) setError('Geçmiş siparişler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void loadHistory()
    return () => { requestRef.current += 1 }
  }, [loadHistory])

  const counts = useMemo(() => ({
    all: orders.length,
    done: orders.filter(o => o.status === 'served').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders])

  const ql = q.trim().toLowerCase()
  const rows = orders.filter(o => {
    if (tab === 'done' && o.status !== 'served') return false
    if (tab === 'cancelled' && o.status !== 'cancelled') return false
    if (ql) {
      const label = (tableLabels[o.table_id ?? ''] ?? '').toLowerCase()
      if (!o.id.toLowerCase().startsWith(ql) && !label.includes(ql)) return false
    }
    return true
  })
  const groups = rows.reduce<Record<string, HistoryOrder[]>>((acc, o) => {
    const k = dayLabel(historyTerminalAt(o));(acc[k] ||= []).push(o); return acc
  }, {})

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'all', label: 'Tümü', n: counts.all },
    { id: 'done', label: 'Tamamlanan', n: counts.done },
    { id: 'cancelled', label: 'İptal', n: counts.cancelled },
  ]

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex h-[min(84dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Geçmiş siparişler</DialogTitle>
          <DialogDescription>Son 30 günün tamamlanan ve iptal edilen siparişleri</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 border-b px-5 py-3 sm:flex-row sm:items-center">
          <InputGroup className="h-9 flex-1 bg-muted/50">
            <InputGroupAddon><I.search size={14} /></InputGroupAddon>
            <InputGroupInput ref={searchRef} aria-label="Geçmiş siparişlerde ara" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sipariş #, masa..." />
          </InputGroup>
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList className="w-full sm:w-auto">
              {tabs.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="min-w-0 px-2 text-xs">
                  {item.label}{item.n > 0 && <span className="font-mono text-[10px] opacity-60">{item.n}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="min-h-0 flex-1" aria-busy={loading}>
          <div className="px-5 pb-5 pt-2">
          {truncated && !loading && !error && (
            <Alert className="my-2 border-[var(--warning)]/20 bg-[var(--warning-bg)]"><AlertDescription className="text-[var(--warning)]">Son 200 kayıt gösteriliyor. Daha eski kayıtlar için rapor dışa aktarımını kullanın.</AlertDescription></Alert>
          )}
          {loading && <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Geçmiş siparişler yükleniyor…</div>}
          {error && <Alert className="my-3 items-center" variant="destructive"><AlertDescription className="flex flex-1 flex-wrap items-center justify-between gap-3"><span>{error}</span><Button type="button" size="sm" variant="outline" onClick={() => void loadHistory()}>Tekrar dene</Button></AlertDescription></Alert>}
          {!loading && !error && rows.length === 0 && (
            <Empty className="min-h-52">
              <EmptyHeader>
                <EmptyMedia variant="icon"><I.history /></EmptyMedia>
                <EmptyTitle>Kayıt bulunamadı</EmptyTitle>
                <EmptyDescription>Arama metnini veya durum filtresini değiştirin.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!loading && !error && Object.entries(groups).map(([day, list]) => (
            <div key={day}>
              <div className="sticky top-0 z-10 bg-popover px-0.5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{day} · {list.length} sipariş</div>
              <div className="flex flex-col gap-2">
                {list.map(o => <HistoryRow key={o.id} order={o} tableLabel={tableLabels[o.table_id ?? ''] ?? (o.table_id ? 'Masa' : 'Kasa')} onReceipt={onReceipt} />)}
              </div>
            </div>
          ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function HistoryRow({ order, tableLabel, onReceipt }: {
  order: HistoryOrder
  tableLabel: string
  onReceipt: (order: HistoryOrder, tableLabel: string) => void
}) {
  const cancelled = order.status === 'cancelled'
  const items = readOrderLineSnapshots(order.items)
  const names = items.map(i => `${i.quantity}× ${i.name}${i.promotion?.offer === 'freebie' && i.promotion.role === 'reward' ? ' (hediye)' : ''}`).join(' · ')
  const time = new Date(historyTerminalAt(order)).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const isPaid = order.paid_at !== null
  const methodBadge = isPaid ? paymentMethodBadge((order.payment_method as PaymentMethod | null | undefined) ?? null) : null

  return (
    <Card size="sm" className="flex-row items-center gap-3 p-3 transition-shadow hover:shadow-sm">
      <div className={cancelled ? 'grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive' : 'grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--positive-bg)] text-[var(--positive)]'}>
        {cancelled ? <I.close size={16} /> : <I.check size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{tableLabel}</span>
          <span className="font-mono text-[10px] text-muted-foreground">#{order.id.slice(0, 6).toUpperCase()}</span>
          {methodBadge && (
            <Badge className={methodBadge.isComp ? 'border border-dashed' : ''} style={{ color: methodBadge.fg, background: methodBadge.bg }}>{methodBadge.label}</Badge>
          )}
          {cancelled && <Badge variant="destructive">İptal</Badge>}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {time} · {names || '—'}
        </div>
      </div>
      <span className={cancelled ? 'font-mono text-sm font-semibold text-muted-foreground line-through' : 'font-mono text-sm font-semibold'}>{formatCurrency(order.total)}</span>
      {!cancelled && (
        <Button type="button" size="sm" variant="outline" aria-label={`${tableLabel} siparişinin fişini göster`} onClick={() => onReceipt(order, tableLabel)}>
          <I.history size={12} />Fiş
        </Button>
      )}
    </Card>
  )
}
