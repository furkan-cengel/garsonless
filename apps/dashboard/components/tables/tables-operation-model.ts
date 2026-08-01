import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import {
  projectTableOperation,
  TABLE_LATE_AFTER_MINUTES,
  type TableOperationalState,
} from '@garsonless/application/table-operations'

export { TABLE_LATE_AFTER_MINUTES }
export const UNASSIGNED_LOCATION_FILTER = '__unassigned__'

export type { TableOperationalState }
export type TableOperationalFilter = 'all' | TableOperationalState

export interface TableOperationalFilters {
  query: string
  state: TableOperationalFilter
  floorLabel: string
  areaLabel: string
}

export const TABLE_OPERATIONAL_COPY: Record<TableOperationalState, string> = {
  empty: 'Boş',
  new: 'Yeni açıldı',
  open: 'Açık',
  late: 'Gecikiyor',
}

export function resolveTableDeepLink(
  requestedTableId: unknown,
  visibleTables: ReadonlyArray<{ id: string }>,
): string | null {
  if (typeof requestedTableId !== 'string' || requestedTableId.length === 0 || requestedTableId.length > 100) {
    return null
  }
  return visibleTables.some((table) => table.id === requestedTableId) ? requestedTableId : null
}

export function normalizeTableLocation(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized ? normalized.slice(0, 40) : null
}

export function tableOperationalState(
  session: OpenTableSessionView | undefined,
  now: number,
): TableOperationalState {
  return projectTableOperation(session, now).state
}

function matchesLocation(value: string | null, filter: string): boolean {
  if (!filter) return true
  if (filter === UNASSIGNED_LOCATION_FILTER) return value === null
  return value === filter
}

export function filterOperationalTables(
  tables: TableItem[],
  sessions: Record<string, OpenTableSessionView>,
  filters: TableOperationalFilters,
  now: number,
): TableItem[] {
  const query = filters.query.trim().toLocaleLowerCase('tr-TR')
  return tables.filter((table) => {
    const state = tableOperationalState(sessions[table.id], now)
    if (filters.state !== 'all' && filters.state !== state) return false
    if (!matchesLocation(table.floorLabel, filters.floorLabel)) return false
    if (!matchesLocation(table.areaLabel, filters.areaLabel)) return false
    if (!query) return true
    return [table.label, table.slug, table.floorLabel, table.areaLabel]
      .some((value) => value?.toLocaleLowerCase('tr-TR').includes(query))
  })
}

export function activeOperationalFilterCount(filters: TableOperationalFilters): number {
  return [
    Boolean(filters.query.trim()),
    filters.state !== 'all',
    Boolean(filters.floorLabel),
    Boolean(filters.areaLabel),
  ].filter(Boolean).length
}

export function operationalStateCounts(
  tables: TableItem[],
  sessions: Record<string, OpenTableSessionView>,
  now: number,
): Record<TableOperationalState, number> {
  const counts: Record<TableOperationalState, number> = { empty: 0, new: 0, open: 0, late: 0 }
  for (const table of tables) counts[tableOperationalState(sessions[table.id], now)] += 1
  return counts
}

export function tableLocationOptions(
  tables: TableItem[],
  key: 'floorLabel' | 'areaLabel',
): { values: string[]; hasUnassigned: boolean } {
  const values = new Set<string>()
  let hasUnassigned = false
  for (const table of tables) {
    const value = table[key]
    if (value) values.add(value)
    else hasUnassigned = true
  }
  return {
    values: [...values].sort((first, second) => first.localeCompare(second, 'tr-TR')),
    hasUnassigned,
  }
}

export function sessionDuration(openedAt: string, now: number): string {
  const timestamp = new Date(openedAt).getTime()
  const minutes = Number.isFinite(timestamp)
    ? Math.max(0, Math.floor((now - timestamp) / 60_000))
    : 0
  if (minutes < 60) return `${minutes}dk`
  return `${Math.floor(minutes / 60)}s ${minutes % 60}dk`
}
