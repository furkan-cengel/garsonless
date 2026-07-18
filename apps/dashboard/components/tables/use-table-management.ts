'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createTable, deleteTable, renameTable } from '../../lib/actions/tables'
import {
  deriveTableSlug,
  filterTables,
  removeTableFromList,
  renameTableInList,
} from './tables-builder-model'
import type { TableItem } from './tables-builder-types'

interface UseTableManagementOptions {
  restaurantId: string
  tables: TableItem[]
  setTables: Dispatch<SetStateAction<TableItem[]>>
  activeId: string
  setActiveId: Dispatch<SetStateAction<string>>
}

export function useTableManagement({
  restaurantId,
  tables,
  setTables,
  activeId,
  setActiveId,
}: UseTableManagementOptions) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const filteredTables = useMemo(() => filterTables(tables, query), [query, tables])

  const cancelAdding = useCallback(() => {
    setAdding(false)
    setNewLabel('')
    setAddError(null)
  }, [])

  const addTable = useCallback(async () => {
    const label = newLabel.trim()
    if (!label || saving) return

    setSaving(true)
    setAddError(null)
    const formData = new FormData()
    formData.append('restaurantId', restaurantId)
    formData.append('label', label)
    const result = await createTable(undefined, formData)
    setSaving(false)

    if ('error' in result) {
      setAddError(result.error)
      return
    }

    const nextTable = {
      id: result.id,
      qrToken: result.token,
      label,
      slug: deriveTableSlug(label, tables.length),
      orders: 0,
      status: 'idle',
    } satisfies TableItem
    setTables((current) => [...current, nextTable])
    setActiveId(nextTable.id)
    setNewLabel('')
    setAdding(false)
  }, [newLabel, restaurantId, saving, setActiveId, setTables, tables.length])

  const rename = useCallback(async (table: TableItem, label: string): Promise<string | null> => {
    const result = await renameTable({ restaurantId, tableId: table.id, label })
    if ('error' in result) return result.error

    setTables((current) => renameTableInList(current, table.id, label))
    return null
  }, [restaurantId, setTables])

  const remove = useCallback(async (table: TableItem): Promise<string | null> => {
    const result = await deleteTable({ restaurantId, tableId: table.id })
    if ('error' in result) return result.error

    const next = removeTableFromList(tables, table.id, activeId)
    setTables(next.tables)
    setActiveId(next.activeId)
    return null
  }, [activeId, restaurantId, setActiveId, setTables, tables])

  return {
    adding,
    startAdding: () => setAdding(true),
    cancelAdding,
    newLabel,
    setNewLabel,
    saving,
    query,
    setQuery,
    addError,
    filteredTables,
    addTable,
    rename,
    remove,
  }
}
