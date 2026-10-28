const collator = new Intl.Collator('tr-TR', { numeric: true, sensitivity: 'base' })

/** Tables in the order a person reads them: "Masa 2" before "Masa 10", "Teras 1" after "Masa 11". */
export function sortTablesForPicker<T extends { label: string }>(tables: readonly T[], query = ''): T[] {
  const needle = query.trim().toLocaleLowerCase('tr-TR')
  return tables
    .filter((table) => !needle || table.label.toLocaleLowerCase('tr-TR').includes(needle))
    .sort((a, b) => collator.compare(a.label, b.label))
}

/** A search box earns its place once the grid stops fitting at a glance. */
export const TABLE_PICKER_SEARCH_THRESHOLD = 8

const NO_AREA = 'Diğer'

/** Areas in reading order; tables without one go last under "Diğer". Fewer than two areas means no tabs. */
export function tableAreas<T extends { areaLabel?: string | null }>(tables: readonly T[]): string[] {
  const names = [...new Set(tables.map((table) => table.areaLabel?.trim() || NO_AREA))]
  return names.length < 2 ? [] : names.sort((a, b) => (a === NO_AREA ? 1 : b === NO_AREA ? -1 : collator.compare(a, b)))
}

/** Sorted tables grouped by area; one unnamed group when the floor has no areas. */
export function groupTablesForPicker<T extends { label: string; areaLabel?: string | null }>(tables: readonly T[], query: string, area: string | null): Array<{ area: string | null; tables: T[] }> {
  const sorted = sortTablesForPicker(tables, query)
  const areas = tableAreas(tables)
  if (areas.length === 0) return sorted.length ? [{ area: null, tables: sorted }] : []
  return areas
    .filter((name) => area === null || name === area)
    .map((name) => ({ area: name, tables: sorted.filter((table) => (table.areaLabel?.trim() || NO_AREA) === name) }))
    .filter((group) => group.tables.length > 0)
}
