import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import {
  projectTableAttentionState,
  TABLE_LATE_AFTER_MINUTES,
  type TableAttentionState as TableOperationalState,
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
  stale: 'Önceki günden açık',
  paid: 'Tahsil edildi',
}

/** Badge text where space is tight (cards, chips); the full copy stays in labels and the legend. */
export const TABLE_OPERATIONAL_SHORT_COPY: Record<TableOperationalState, string> = {
  empty: 'Boş',
  new: 'Yeni',
  open: 'Açık',
  late: 'Gecikiyor',
  stale: 'Dünden açık',
  paid: 'Tahsil edildi',
}

/** Most urgent first: lists, chips and the legend follow this order. */
export const TABLE_ATTENTION_ORDER: readonly TableOperationalState[] = ['late', 'stale', 'paid', 'open', 'new', 'empty']

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
  return projectTableAttentionState(session, now, session?.restaurantDayStart)
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
  const counts: Record<TableOperationalState, number> = { empty: 0, new: 0, open: 0, late: 0, stale: 0, paid: 0 }
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
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) return `${Math.floor(hours / 24)} gün ${hours % 24} sa`
  return `${hours} sa ${minutes % 60} dk`
}

/**
 * Whether the floor layout editor can open. Floors come from each table's floor
 * name; with none set every table is "Atanmamış", so that bucket is offered
 * directly instead of asking for a floor that cannot be picked.
 */
export function resolveLayoutEditAccess(
  tables: ReadonlyArray<{ floorLabel: string | null }>,
  floorFilter: string,
  loadError: string | null,
): { disabledReason: string | null; canEditUnassigned: boolean } {
  if (loadError) return { disabledReason: loadError, canEditUnassigned: false }
  if (floorFilter) return { disabledReason: null, canEditUnassigned: false }
  const hasNamedFloor = tables.some((table) => Boolean(table.floorLabel?.trim()))
  if (hasNamedFloor) return { disabledReason: 'Düzeni düzenlemek için soldaki filtreden bir kat seçin.', canEditUnassigned: false }
  return {
    disabledReason: 'Henüz kat adı yok; kat adlarını masa ayarlarından verebilirsin.',
    canEditUnassigned: tables.length > 0,
  }
}
