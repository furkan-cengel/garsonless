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
