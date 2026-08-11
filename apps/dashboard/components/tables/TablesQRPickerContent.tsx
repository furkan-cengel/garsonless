'use client'

import Link from 'next/link'
import { QrCode, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TableItem } from './tables-builder-types'

export function TablesQRPickerContent({ restaurantId, tables, filtered, activeId, query, setQuery, onSelect, mobile = false }: {
  restaurantId: string
  tables: TableItem[]
  filtered: TableItem[]
  activeId: string
  query: string
  setQuery: (query: string) => void
  onSelect: (tableId: string) => void
  mobile?: boolean
}) {
  return (
    <>
      {!mobile && (
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <strong className="flex-1 text-sm">QR masaları</strong>
            <Badge variant="secondary">{tables.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Önizlenecek ve indirilecek masayı seçin.</p>
        </div>
      )}
      <div className="px-3 pb-1 pt-2.5">
        <InputGroup className="tb-tables__search h-9 bg-muted/60">
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput
            aria-label="QR masası ara"
            data-modal-initial-focus={mobile ? true : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Masa ara"
          />
        </InputGroup>
      </div>
      <ScrollArea className="tb-tables__nav-list min-h-0 flex-1">
        <div className="space-y-1 px-2 pb-3 pt-1.5">
          {filtered.map((table) => {
            const active = table.id === activeId
            return (
              <Button
                key={table.id}
                type="button"
                variant={active ? 'outline' : 'ghost'}
                aria-pressed={active}
                aria-label={`${table.label} QR kodunu düzenle`}
                onClick={() => onSelect(table.id)}
                className={cn('h-auto min-h-13 w-full justify-start gap-2.5 px-2.5 py-2 text-left', active && 'border-foreground bg-[var(--positive-bg)] hover:bg-[var(--positive-bg)]')}
              >
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background"><QrCode className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{table.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{table.qrToken ? 'QR etkin' : 'QR hazırlanıyor'}</span>
                </span>
                {active && <Badge variant="positive">Seçili</Badge>}
              </Button>
            )
          })}
          {filtered.length === 0 && (
            <Empty className="my-2 border py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><QrCode /></EmptyMedia>
                <EmptyTitle>{tables.length === 0 ? 'Henüz masa yok' : 'Eşleşen masa yok'}</EmptyTitle>
                <EmptyDescription>{tables.length === 0 ? 'Canlı Masalar bölümünden ilk masanızı ekleyin.' : 'Arama ifadesini değiştirin.'}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        <Button variant="outline" className="w-full" render={<Link href={`/dashboard/${restaurantId}/tables`} />}>
          Masaları yönet
        </Button>
      </div>
    </>
  )
}
