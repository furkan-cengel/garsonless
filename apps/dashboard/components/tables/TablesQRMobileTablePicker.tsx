'use client'

import React, { useMemo, useState } from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import { AccessibleDialog } from './AccessibleDialog'
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
    <>
      <div className="tb-qr-mobile-selector">
        <div><span>Seçili masa</span><strong>{activeTable?.label ?? 'Masa seçilmedi'}</strong></div>
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          {React.cloneElement(AppIconNodes.search as React.ReactElement<{ size?: number }>, { size: 16 })}
          Masa seç
        </button>
      </div>
      {open && (
        <AccessibleDialog labelledBy="qr-mobile-picker-title" onClose={() => setOpen(false)} className="tb-qr-mobile-picker-overlay" style={{ position: 'fixed', inset: 0, zIndex: 160, display: 'flex', alignItems: 'flex-end', background: 'rgba(17,17,19,.42)' }}>
          <div className="tb-qr-mobile-picker-panel">
            <header>
              <div><span>QR Studio</span><strong id="qr-mobile-picker-title">Masa seçin</strong></div>
              <button type="button" aria-label="Masa seçimini kapat" onClick={() => setOpen(false)}>×</button>
            </header>
            <TablesQRPickerContent mobile restaurantId={restaurantId} tables={tables} filtered={filtered} activeId={activeId} query={query} setQuery={setQuery} onSelect={select} />
          </div>
        </AccessibleDialog>
      )}
    </>
  )
}
