'use client'

import Link from 'next/link'
import { LockKeyhole, Pencil, Plus, QrCode, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { TableItem } from './tables-builder-types'
import type { TableManagementModel } from './TablesQRTablePicker'

export function TablesQRPickerContent({
  restaurantId, tables, filtered, activeId, query, setQuery, onSelect,
  management, onEdit, tableOperationsAllowed, mobile = false,
}: {
  restaurantId: string
  tables: TableItem[]
  filtered: TableItem[]
  activeId: string
  query: string
  setQuery: (query: string) => void
  onSelect: (tableId: string) => void
  management: TableManagementModel
  onEdit: (table: TableItem) => void
  tableOperationsAllowed: boolean
  mobile?: boolean
}) {
  return (
    <>
      {!mobile && (
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2"><strong className="flex-1 text-sm">QR masaları</strong><Badge variant="secondary">{tables.length}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">Her masa için kalıcı QR oluşturun; paketi yükseltince yeniden baskı gerekmez.</p>
        </div>
      )}
      <div className="px-3 pb-1 pt-2.5">
        <InputGroup className="tb-tables__search h-9 bg-muted/60">
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput aria-label="QR masası ara" data-modal-initial-focus={mobile ? true : undefined} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Masa ara" />
        </InputGroup>
      </div>
      <ScrollArea className="tb-tables__nav-list min-h-0 flex-1">
        <div className="space-y-1 px-2 pb-3 pt-1.5">
          {filtered.map((table) => {
            const active = table.id === activeId
            return (
              <div key={table.id} className={cn('flex items-center rounded-md', active && 'border border-foreground bg-[var(--positive-bg)]')}>
                <Button type="button" variant="ghost" aria-pressed={active} aria-label={`${table.label} QR kodunu düzenle`} onClick={() => onSelect(table.id)} className="h-auto min-h-13 min-w-0 flex-1 justify-start gap-2.5 px-2.5 py-2 text-left hover:bg-transparent">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background"><QrCode className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{table.label}</span><span className="block text-xs font-normal text-muted-foreground">{table.qrToken ? 'QR etkin' : 'QR hazırlanıyor'}</span></span>
                  {active && <Badge variant="positive">Seçili</Badge>}
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`${table.label} bilgilerini düzenle`} onClick={() => onEdit(table)} className="mr-1 shrink-0"><Pencil /></Button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <Empty className="my-2 border py-8"><EmptyHeader><EmptyMedia variant="icon"><QrCode /></EmptyMedia><EmptyTitle>{tables.length === 0 ? 'Henüz masa yok' : 'Eşleşen masa yok'}</EmptyTitle><EmptyDescription>{tables.length === 0 ? 'İlk masanızı burada oluşturup kalıcı QR kodunu hazırlayın.' : 'Arama ifadesini değiştirin.'}</EmptyDescription></EmptyHeader></Empty>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        {management.adding ? (
          <FieldGroup className="gap-1.5">
            <Input autoFocus aria-label="Yeni masa adı" value={management.newLabel} onChange={(event) => management.setNewLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') management.addTable(); if (event.key === 'Escape') management.cancelAdding() }} placeholder="örn. Masa 1" />
            <div className="grid grid-cols-2 gap-1.5"><Input aria-label="Yeni masa katı" value={management.newFloorLabel} onChange={(event) => management.setNewFloorLabel(event.target.value)} placeholder="Kat" /><Input aria-label="Yeni masa alanı" value={management.newAreaLabel} onChange={(event) => management.setNewAreaLabel(event.target.value)} placeholder="Alan" /></div>
            <div className="flex gap-1.5"><Button type="button" size="sm" disabled={management.saving || !management.newLabel.trim()} onClick={management.addTable} className="flex-1">{management.saving ? <Spinner /> : <Plus />}{management.saving ? 'Ekleniyor…' : 'Masayı oluştur'}</Button><Button type="button" size="sm" variant="outline" onClick={management.cancelAdding}>İptal</Button></div>
            {management.addError && <FieldError>{management.addError}</FieldError>}
          </FieldGroup>
        ) : <Button type="button" variant="outline" className="w-full" onClick={management.startAdding}><Plus />Masa ekle</Button>}
        <Button variant="ghost" className="mt-2 w-full" render={<Link href={`/dashboard/${restaurantId}/tables`} />}>{!tableOperationsAllowed && <LockKeyhole />}{tableOperationsAllowed ? 'Canlı Masaları aç' : 'Canlı Masalar · Plus'}</Button>
      </div>
    </>
  )
}
