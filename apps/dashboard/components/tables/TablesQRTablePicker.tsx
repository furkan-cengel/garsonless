'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { filterTables } from './tables-builder-model'
import type { TableItem } from './tables-builder-types'
import { TablesQRPickerContent } from './TablesQRPickerContent'
import type { useTableManagement } from './use-table-management'

export type TableManagementModel = ReturnType<typeof useTableManagement>

const TablesQRMobileTablePicker = dynamic(
  () => import('./TablesQRMobileTablePicker').then((module) => module.TablesQRMobileTablePicker),
  { ssr: false },
)

export function TablesQRTablePicker({ restaurantId, tables, activeId, setActiveId, management, onEdit, tableOperationsAllowed }: {
  restaurantId: string
  tables: TableItem[]
  activeId: string
  setActiveId: (tableId: string) => void
  management: TableManagementModel
  onEdit: (table: TableItem) => void
  tableOperationsAllowed: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterTables(tables, query), [query, tables])

  return (
    <>
      <TablesQRMobileTablePicker restaurantId={restaurantId} tables={tables} activeId={activeId} setActiveId={setActiveId} management={management} onEdit={onEdit} tableOperationsAllowed={tableOperationsAllowed} />
      <aside className="tb-tables__nav tb-qr-picker-desktop flex shrink-0 flex-col border-r bg-background" aria-label="QR masası seçimi" style={{ width: 'var(--nav)' }}>
        <TablesQRPickerContent restaurantId={restaurantId} tables={tables} filtered={filtered} activeId={activeId} query={query} setQuery={setQuery} onSelect={setActiveId} management={management} onEdit={onEdit} tableOperationsAllowed={tableOperationsAllowed} />
      </aside>
    </>
  )
}
