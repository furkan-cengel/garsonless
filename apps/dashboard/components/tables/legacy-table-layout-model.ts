import type { TableLayoutWriteEntry } from '@garsonless/application/tables'
import type { TableItem } from './tables-builder-types'
import { clampTableLayoutEntry } from './table-floor-layout-model'

export interface LegacyTableLayoutCandidate {
  entries: TableLayoutWriteEntry[]
  sourceCount: number
  skippedCount: number
}

function finitePercent(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null
}

function seatCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20
    ? value
    : fallback
}

export function legacyTableLayoutStorageKey(restaurantId: string): string {
  return `garsonless-floor:${restaurantId}`
}

export function parseLegacyTableLayout(
  raw: string,
  tables: TableItem[],
): LegacyTableLayoutCandidate | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const knownTables = new Map(tables.map((table) => [table.id, table]))
  const sourceEntries = Object.entries(parsed as Record<string, unknown>).slice(0, 1_000)
  const entries: TableLayoutWriteEntry[] = []
  let skippedCount = 0

  for (const [tableId, value] of sourceEntries) {
    const table = knownTables.get(tableId)
    if (!table || !value || typeof value !== 'object' || Array.isArray(value)) {
      skippedCount += 1
      continue
    }
    const legacy = value as Record<string, unknown>
    const x = finitePercent(legacy['x'])
    const y = finitePercent(legacy['y'])
    if (x === null || y === null) {
      skippedCount += 1
      continue
    }
    entries.push(clampTableLayoutEntry({
      tableId,
      xBp: Math.round(x * 100),
      yBp: Math.round(y * 100),
      shape: table.layoutShape,
      rotation: table.layoutRotation,
      seatCount: seatCount(legacy['seats'], table.seatCount),
    }))
  }

  if (entries.length === 0) return null
  return {
    entries: entries.sort((first, second) => first.tableId.localeCompare(second.tableId)),
    sourceCount: sourceEntries.length,
    skippedCount,
  }
}
