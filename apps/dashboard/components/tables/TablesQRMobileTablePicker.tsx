'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { filterTables } from './tables-builder-model'
import type { TableItem } from './tables-builder-types'
import { TablesQRPickerContent } from './TablesQRPickerContent'

export function TablesQRMobileTablePicker({ restaurantId, tables, activeId, setActiveId }: {
  restaurantId: string
  tables: TableItem[]
  activeId: string
  setActiveId: (tableId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterTables(tables, query), [query, tables])
  const activeTable = tables.find((table) => table.id === activeId)
  const select = (tableId: string) => {
    setActiveId(tableId)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="tb-qr-mobile-selector">
        <div><span>Seçili masa</span><strong>{activeTable?.label ?? 'Masa seçilmedi'}</strong></div>
        <SheetTrigger render={<Button type="button" variant="outline" />}>
          <Search />
          Masa seç
        </SheetTrigger>
      </div>
      <SheetContent side="bottom" className="tb-qr-mobile-picker-panel h-[min(82dvh,720px)] gap-0 p-0">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>Masa seçin</SheetTitle>
          <SheetDescription>Önizlenecek ve indirilecek QR masasını seçin.</SheetDescription>
        </SheetHeader>
        <TablesQRPickerContent mobile restaurantId={restaurantId} tables={tables} filtered={filtered} activeId={activeId} query={query} setQuery={setQuery} onSelect={select} />
      </SheetContent>
    </Sheet>
  )
}
