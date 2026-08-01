'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { TableLayoutSnapshot } from '@garsonless/application/tables'
import { getTableLayout, saveTableLayout } from '../../lib/actions/tables'
import type { TableItem } from './tables-builder-types'
import { applyLayoutSnapshotToTables, buildTableLayoutDraft, type TableLayoutDraft } from './table-floor-layout-model'
import type { LegacyTableLayoutCandidate } from './legacy-table-layout-model'

type Input = {
  restaurantId: string
  tables: TableItem[]
  setTables: Dispatch<SetStateAction<TableItem[]>>
  snapshot: TableLayoutSnapshot
  editing: boolean
  saving: boolean
  initialLayoutError: string | null
  layoutInvalidation: number
  setSnapshot: Dispatch<SetStateAction<TableLayoutSnapshot>>
  setDraft: Dispatch<SetStateAction<TableLayoutDraft>>
  setConflict: Dispatch<SetStateAction<TableLayoutSnapshot | null>>
  setError: Dispatch<SetStateAction<string | null>>
  setNotice: Dispatch<SetStateAction<string | null>>
}

export function useTableLayoutExternalSync(input: Input) {
  const {
    restaurantId, tables, setTables, snapshot, editing, saving, initialLayoutError,
    layoutInvalidation, setSnapshot, setDraft, setConflict, setError, setNotice,
  } = input
  const [legacyCandidate, setLegacyCandidate] = useState<LegacyTableLayoutCandidate | null>(null)
  const [legacyDismissed, setLegacyDismissed] = useState(false)
  const [legacyImporting, setLegacyImporting] = useState(false)
  const legacyRequestId = useRef<string | null>(null)
  const snapshotRef = useRef(snapshot)
  const editingRef = useRef(editing)
  const tablesRef = useRef(tables)
  snapshotRef.current = snapshot
  editingRef.current = editing
  tablesRef.current = tables

  const applySnapshot = useCallback((next: TableLayoutSnapshot) => {
    setSnapshot(next)
    setDraft(buildTableLayoutDraft(tablesRef.current, next))
    setTables((current) => applyLayoutSnapshotToTables(current, next))
  }, [setDraft, setSnapshot, setTables])

  useEffect(() => {
    if (initialLayoutError || snapshot.initializedAt || legacyDismissed) {
      setLegacyCandidate(null)
      return
    }
    const raw = window.localStorage.getItem(`garsonless-floor:${restaurantId}`)
    if (!raw) {
      setLegacyCandidate(null)
      return
    }
    let cancelled = false
    void import('./legacy-table-layout-model').then(({ parseLegacyTableLayout }) => {
      if (!cancelled) setLegacyCandidate(parseLegacyTableLayout(raw, tables))
    })
    return () => { cancelled = true }
  }, [initialLayoutError, restaurantId, snapshot.initializedAt, tables, legacyDismissed])

  useEffect(() => {
    if (layoutInvalidation < 1 || initialLayoutError || saving) return
    let cancelled = false
    void getTableLayout(restaurantId).then((result) => {
      if (cancelled || !result || 'error' in result) return
      const current = snapshotRef.current
      if (result.revision <= current.revision) return
      if (editingRef.current) {
        setConflict(result)
        setError('Salon düzeni başka bir çalışan tarafından değiştirildi. Taslağınız korunuyor.')
        return
      }
      applySnapshot(result)
      setConflict(null)
      setError(null)
      setNotice('Salon düzeni canlı olarak güncellendi.')
    }).catch(() => {
      if (!cancelled && editingRef.current) setError('Uzak salon düzeni doğrulanamadı. Taslağınız korunuyor.')
    })
    return () => { cancelled = true }
  }, [applySnapshot, initialLayoutError, layoutInvalidation, restaurantId, saving, setConflict, setError, setNotice])

  const importLegacy = useCallback(async () => {
    const candidate = legacyCandidate
    if (!candidate || legacyImporting || snapshot.initializedAt) return
    setLegacyImporting(true)
    setError(null)
    const requestId = legacyRequestId.current ?? crypto.randomUUID()
    legacyRequestId.current = requestId
    try {
      const result = await saveTableLayout({
        restaurantId,
        expectedRevision: snapshotRef.current.revision,
        requestId,
        entries: candidate.entries,
      })
      if ('error' in result) {
        setError(result.error)
      } else if ('conflict' in result) {
        applySnapshot(result.snapshot)
        setLegacyCandidate(null)
        setNotice('Sunucu salon düzeni bu sırada başlatıldı; güncel düzen yüklendi.')
      } else {
        applySnapshot(result.snapshot)
        setLegacyCandidate(null)
        legacyRequestId.current = null
        setNotice(`Eski salon planından ${candidate.entries.length} masa içe aktarıldı.${candidate.skippedCount > 0 ? ` ${candidate.skippedCount} geçersiz veya silinmiş masa atlandı.` : ''}`)
      }
    } catch {
      setError('Eski salon planı içe aktarılamadı. Aynı istek güvenli biçimde tekrar denenebilir.')
    } finally {
      setLegacyImporting(false)
    }
  }, [applySnapshot, legacyCandidate, legacyImporting, restaurantId, setError, setNotice, snapshot.initializedAt])

  return {
    applySnapshot,
    legacyCandidate,
    legacyImporting,
    importLegacy,
    dismissLegacy: () => setLegacyDismissed(true),
  }
}
