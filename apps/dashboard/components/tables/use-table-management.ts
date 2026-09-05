'use client'

import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createTable, deleteTable, renameTable } from '../../lib/actions/tables'
import {
  deriveTableSlug,
  removeTableFromList,
  renameTableInList,
} from './tables-builder-model'
import { normalizeTableLocation } from './tables-operation-model'
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
  const [listOpenRequest, setListOpenRequest] = useState(0)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newFloorLabel, setNewFloorLabel] = useState('')
  const [newAreaLabel, setNewAreaLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const cancelAdding = useCallback(() => {
    setAdding(false)
    setNewLabel('')
    setNewFloorLabel('')
    setNewAreaLabel('')
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
    formData.append('floorLabel', newFloorLabel)
    formData.append('areaLabel', newAreaLabel)
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
      floorLabel: normalizeTableLocation(newFloorLabel),
      areaLabel: normalizeTableLocation(newAreaLabel),
      layoutXBp: null,
      layoutYBp: null,
      layoutShape: 'rectangle',
      layoutRotation: 0,
      seatCount: 4,
      orders: 0,
      status: 'idle',
    } satisfies TableItem
    setTables((current) => [...current, nextTable])
    setActiveId(nextTable.id)
    setNewLabel('')
    setNewFloorLabel('')
    setNewAreaLabel('')
    setAdding(false)
  }, [newAreaLabel, newFloorLabel, newLabel, restaurantId, saving, setActiveId, setTables, tables.length])

  const rename = useCallback(async (table: TableItem, input: { label: string; floorLabel: string; areaLabel: string }): Promise<string | null> => {
    const result = await renameTable({ restaurantId, tableId: table.id, ...input })
    if ('error' in result) return result.error

    setTables((current) => renameTableInList(current, table.id, input.label).map((item) => item.id === table.id ? {
      ...item,
      floorLabel: normalizeTableLocation(input.floorLabel),
      areaLabel: normalizeTableLocation(input.areaLabel),
    } : item))
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
    listOpenRequest,
    startAdding: () => { setAdding(true); setListOpenRequest((value) => value + 1) },
    cancelAdding,
    newLabel,
    setNewLabel,
    newFloorLabel,
    setNewFloorLabel,
    newAreaLabel,
    setNewAreaLabel,
    saving,
    query,
    setQuery,
    addError,
    addTable,
    rename,
    remove,
  }
}
