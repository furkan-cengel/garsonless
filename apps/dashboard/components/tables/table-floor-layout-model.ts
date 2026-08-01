import type {
  TableLayoutEntry,
  TableLayoutSnapshot,
  TableLayoutWriteEntry,
} from '@garsonless/application/tables'
import type { TableItem } from './tables-builder-types'

export type TableLayoutDraft = Record<string, TableLayoutWriteEntry>

const AUTO_COLUMNS = 5
const AUTO_X_START = 450
const AUTO_Y_START = 650
const AUTO_X_GAP = 1950
const AUTO_Y_GAP = 1900

export function tableLayoutDimensions(entry: Pick<TableLayoutWriteEntry, 'shape' | 'rotation'>): {
  widthBp: number
  heightBp: number
} {
  if (entry.shape === 'square') return { widthBp: 1500, heightBp: 1500 }
  return entry.rotation === 90
    ? { widthBp: 1450, heightBp: 1850 }
    : { widthBp: 1850, heightBp: 1450 }
}

export function clampTableLayoutEntry(entry: TableLayoutWriteEntry): TableLayoutWriteEntry {
  const { widthBp, heightBp } = tableLayoutDimensions(entry)
  return {
    ...entry,
    xBp: Math.max(0, Math.min(10000 - widthBp, Math.round(entry.xBp))),
    yBp: Math.max(0, Math.min(10000 - heightBp, Math.round(entry.yBp))),
    seatCount: Math.max(1, Math.min(20, Math.round(entry.seatCount))),
  }
}

function autoEntry(table: TableItem, index: number): TableLayoutWriteEntry {
  return clampTableLayoutEntry({
    tableId: table.id,
    xBp: AUTO_X_START + (index % AUTO_COLUMNS) * AUTO_X_GAP,
    yBp: AUTO_Y_START + Math.floor(index / AUTO_COLUMNS) * AUTO_Y_GAP,
    shape: table.layoutShape,
    rotation: table.layoutRotation,
    seatCount: table.seatCount,
  })
}

export function buildTableLayoutDraft(
  tables: TableItem[],
  snapshot?: TableLayoutSnapshot | null,
): TableLayoutDraft {
  const snapshotEntries = new Map(snapshot?.entries.map((entry) => [entry.tableId, entry]) ?? [])
  const sorted = [...tables].sort((first, second) => first.label.localeCompare(second.label, 'tr-TR', {
    numeric: true,
    sensitivity: 'base',
  }))
  const floorIndexes = new Map<string, number>()
  return Object.fromEntries(sorted.map((table) => {
    const floorKey = table.floorLabel ?? ''
    const floorIndex = floorIndexes.get(floorKey) ?? 0
    floorIndexes.set(floorKey, floorIndex + 1)
    const persisted = snapshotEntries.get(table.id)
    const coordinates = persisted?.xBp != null && persisted.yBp != null
      ? persisted
      : table.layoutXBp != null && table.layoutYBp != null
        ? {
            tableId: table.id,
            xBp: table.layoutXBp,
            yBp: table.layoutYBp,
            shape: table.layoutShape,
            rotation: table.layoutRotation,
            seatCount: table.seatCount,
          } satisfies TableLayoutEntry
        : null
    return [table.id, coordinates?.xBp != null && coordinates.yBp != null
      ? clampTableLayoutEntry({
          tableId: table.id,
          xBp: coordinates.xBp,
          yBp: coordinates.yBp,
          shape: coordinates.shape,
          rotation: coordinates.rotation,
          seatCount: coordinates.seatCount,
        })
      : autoEntry(table, floorIndex)]
  }))
}

/**
 * The authoritative coordinates are floor-local. In the all-floors overview
 * those coordinate spaces must not be stacked on top of each other, so the
 * overview receives its own deterministic, read-only arrangement.
 */
export function buildTableLayoutOverviewDraft(tables: TableItem[]): TableLayoutDraft {
  return buildTableLayoutDraft(tables.map((table) => ({ ...table, floorLabel: null })))
}

export function patchTableLayoutEntry(
  draft: TableLayoutDraft,
  tableId: string,
  patch: Partial<Omit<TableLayoutWriteEntry, 'tableId'>>,
): TableLayoutDraft {
  const current = draft[tableId]
  if (!current) return draft
  return { ...draft, [tableId]: clampTableLayoutEntry({ ...current, ...patch }) }
}

export function tableLayoutEntries(draft: TableLayoutDraft): TableLayoutWriteEntry[] {
  return Object.values(draft).sort((first, second) => first.tableId.localeCompare(second.tableId))
}

function overlaps(first: TableLayoutWriteEntry, second: TableLayoutWriteEntry): boolean {
  const firstSize = tableLayoutDimensions(first)
  const secondSize = tableLayoutDimensions(second)
  return first.xBp < second.xBp + secondSize.widthBp
    && first.xBp + firstSize.widthBp > second.xBp
    && first.yBp < second.yBp + secondSize.heightBp
    && first.yBp + firstSize.heightBp > second.yBp
}

export function collidingTableIds(tables: TableItem[], draft: TableLayoutDraft): Set<string> {
  const collisions = new Set<string>()
  for (let firstIndex = 0; firstIndex < tables.length; firstIndex += 1) {
    const firstTable = tables[firstIndex]
    if (!firstTable) continue
    const firstEntry = draft[firstTable.id]
    if (!firstEntry) continue
    for (let secondIndex = firstIndex + 1; secondIndex < tables.length; secondIndex += 1) {
      const secondTable = tables[secondIndex]
      if (!secondTable || firstTable.floorLabel !== secondTable.floorLabel) continue
      const secondEntry = draft[secondTable.id]
      if (secondEntry && overlaps(firstEntry, secondEntry)) {
        collisions.add(firstTable.id)
        collisions.add(secondTable.id)
      }
    }
  }
  return collisions
}

export function applyLayoutSnapshotToTables(
  tables: TableItem[],
  snapshot: TableLayoutSnapshot,
): TableItem[] {
  const entries = new Map(snapshot.entries.map((entry) => [entry.tableId, entry]))
  return tables.map((table) => {
    const entry = entries.get(table.id)
    return entry ? {
      ...table,
      layoutXBp: entry.xBp,
      layoutYBp: entry.yBp,
      layoutShape: entry.shape,
      layoutRotation: entry.rotation,
      seatCount: entry.seatCount,
    } : table
  })
}
