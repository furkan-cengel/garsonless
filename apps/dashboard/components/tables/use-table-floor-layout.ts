'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TableLayoutSnapshot } from '@garsonless/application/tables'
import { getTableLayout, saveTableLayout } from '../../lib/actions/tables'
import type { TableItem } from './tables-builder-types'
import {
  buildTableLayoutDraft,
  collidingTableIds,
  patchTableLayoutEntry,
  tableLayoutEntries,
} from './table-floor-layout-model'
import { useTableLayoutExternalSync } from './use-table-layout-external-sync'

export function useTableFloorLayout({
  restaurantId,
  tables,
  setTables,
  initialSnapshot,
  initialLayoutError: initialError,
  layoutInvalidation,
}: {
  restaurantId: string
  tables: TableItem[]
  setTables: Dispatch<SetStateAction<TableItem[]>>
  initialSnapshot: TableLayoutSnapshot
  initialLayoutError: string | null
  layoutInvalidation: number
}) {
  const [initialLayoutError, setLayoutLoadError] = useState(initialError)
  const [retrying, setRetrying] = useState(false)
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [draft, setDraft] = useState(() => buildTableLayoutDraft(tables, initialSnapshot))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(initialLayoutError)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState<TableLayoutSnapshot | null>(null)
  const collisions = useMemo(() => collidingTableIds(tables, draft), [draft, tables])
  const external = useTableLayoutExternalSync({
    restaurantId, tables, setTables, snapshot, editing, saving, initialLayoutError,
    layoutInvalidation, setSnapshot, setDraft, setConflict, setError, setNotice,
  })

  useEffect(() => {
    const rebuilt = buildTableLayoutDraft(tables, snapshot)
    if (!editing) {
      setDraft(rebuilt)
      return
    }
    setDraft((current) => Object.fromEntries(tables.flatMap((table) => {
      const entry = current[table.id] ?? rebuilt[table.id]
      return entry ? [[table.id, entry]] : []
    })))
  }, [editing, snapshot, tables])

  const retryLayout = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      const result = await getTableLayout(restaurantId)
      if (!result || 'error' in result) {
        setError(result && 'error' in result ? result.error : 'Salon yerleşimi alınamadı.')
        return
      }
      external.applySnapshot(result)
      setLayoutLoadError(null)
      setError(null)
      setNotice('Salon yerleşimi yüklendi. Düzenleyebilirsiniz.')
    } catch {
      setError('Salon yerleşimi alınamadı. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setRetrying(false)
    }
  }

  const patchEntry = useCallback((tableId: string, patch: Parameters<typeof patchTableLayoutEntry>[2]) => {
    setNotice(null)
    setDraft((current) => patchTableLayoutEntry(current, tableId, patch))
  }, [])

  const startEditing = useCallback(() => {
    setDraft(buildTableLayoutDraft(tables, snapshot))
    setEditing(true)
    setError(null)
    setNotice(null)
    setConflict(null)
  }, [snapshot, tables])

  const cancelEditing = useCallback(() => {
    setDraft(buildTableLayoutDraft(tables, snapshot))
    setEditing(false)
    setError(initialLayoutError)
    setConflict(null)
  }, [initialLayoutError, snapshot, tables])

  const save = async () => {
    if (collisions.size > 0) {
      setError('Çakışan masaları ayırmadan düzen kaydedilemez.')
      return
    }
    if (initialLayoutError) {
      setError('Sunucu yerleşimi doğrulanamadığı için düzenleme güvenli biçimde kaydedilemiyor.')
      return
    }
    setSaving(true)
    setError(null)
    setConflict(null)
    try {
      const result = await saveTableLayout({
        restaurantId,
        expectedRevision: snapshot.revision,
        requestId: crypto.randomUUID(),
        entries: tableLayoutEntries(draft),
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      if ('conflict' in result) {
        setConflict(result.snapshot)
        setError('Bu yerleşim başka bir cihazdan kaydedildi. Seninki kaydedilirse o değişiklikler kaybolur.')
        return
      }
      external.applySnapshot(result.snapshot)
      setEditing(false)
      setNotice(result.idempotent ? 'Salon düzeni daha önce kaydedilmişti.' : 'Salon düzeni kaydedildi.')
    } catch {
      setError('Salon düzeni kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  const loadRemoteConflict = () => {
    if (!conflict) return
    external.applySnapshot(conflict)
    setConflict(null)
    setError(null)
    setNotice('Güncel salon düzeni yüklendi.')
  }

  const keepLocalDraft = () => {
    if (!conflict) return
    setSnapshot(conflict)
    setConflict(null)
    setError(null)
    setNotice('Taslağın korundu. Kaydedersen diğer cihazdaki değişikliklerin üzerine yazılır.')
  }

  return {
    loadError: initialLayoutError,
    retrying,
    retryLayout,
    draft,
    editing,
    saving,
    error,
    notice,
    conflict,
    collisions,
    patchEntry,
    startEditing,
    cancelEditing,
    save,
    loadRemoteConflict,
    keepLocalDraft,
    dismissNotice: () => setNotice(null),
    legacyCandidate: external.legacyCandidate,
    legacyImporting: external.legacyImporting,
    importLegacy: external.importLegacy,
    dismissLegacy: external.dismissLegacy,
  }
}
