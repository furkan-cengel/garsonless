'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import {
  activeOperationalFilterCount,
  filterOperationalTables,
  operationalStateCounts,
  tableLocationOptions,
  type TableOperationalFilter,
  TABLE_OPERATIONAL_SHORT_COPY,
  UNASSIGNED_LOCATION_FILTER,
} from './tables-operation-model'
import type { TablesFilterSummary } from './TablesFeedbackStates'
export function useOperationalNow(initialNow: number) {
  const [now, setNow] = useState(initialNow)
  useEffect(() => {
    let timer: number | null = null
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer)
      const current = Date.now(), nextMinute = 60_000 - (current % 60_000) + 25
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') setNow(Date.now())
        schedule()
      }, nextMinute)
    }
    const update = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
      schedule()
    }
    schedule()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return now
}
export function useTablesNavigationModel({
  tables,
  openSessions,
  query,
  setQuery,
  now,
}: {
  tables: TableItem[]
  openSessions: Record<string, OpenTableSessionView>
  query: string
  setQuery: (query: string) => void
  now: number
}) {
  const [statusFilter, setStatusFilter] = useState<TableOperationalFilter>('all')
  const [floorFilter, setFloorFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const stateCounts = useMemo(
    () => operationalStateCounts(tables, openSessions, now),
    [now, openSessions, tables],
  )
  const floorOptions = useMemo(() => tableLocationOptions(tables, 'floorLabel'), [tables])
  const areaOptions = useMemo(() => tableLocationOptions(tables, 'areaLabel'), [tables])
  const filteredTables = useMemo(
    () => filterOperationalTables(tables, openSessions, {
      query,
      state: statusFilter,
      floorLabel: floorFilter,
      areaLabel: areaFilter,
    }, now),
    [areaFilter, floorFilter, now, openSessions, query, statusFilter, tables],
  )
  const filtersActive = Boolean(query.trim() || statusFilter !== 'all' || floorFilter || areaFilter)
  const activeFilterCount = activeOperationalFilterCount({
    query,
    state: statusFilter,
    floorLabel: floorFilter,
    areaLabel: areaFilter,
  })
  const activeCount = stateCounts.new + stateCounts.open + stateCounts.late + stateCounts.stale + stateCounts.paid

  // Plain words for the empty view, so staff see why nothing matches.
  const filterSummary: TablesFilterSummary = {
    query,
    labels: [
      statusFilter !== 'all' ? TABLE_OPERATIONAL_SHORT_COPY[statusFilter] : '',
      floorFilter === UNASSIGNED_LOCATION_FILTER ? 'Atanmamış kat' : floorFilter,
      areaFilter === UNASSIGNED_LOCATION_FILTER ? 'Alanı atanmamış' : areaFilter,
    ].filter(Boolean),
  }
  const clearStateFilters = useCallback(() => { setStatusFilter('all'); setFloorFilter(''); setAreaFilter('') }, [])

  const clearFilters = useCallback(() => { setQuery(''); clearStateFilters() }, [clearStateFilters, setQuery])

  return {
    now,
    statusFilter,
    setStatusFilter,
    floorFilter,
    setFloorFilter,
    areaFilter,
    setAreaFilter,
    stateCounts,
    floorOptions,
    areaOptions,
    filteredTables,
    filtersActive,
    activeFilterCount,
    activeCount,
    clearFilters,
    filterSummary,
    clearStateFilters,
  }
}
