import type { MenuItem } from '../../../menu/types'

const MIN_ITEMS = 1
const MAX_ITEMS = 4

export type ChefPickSelectionIssue =
  | { type: 'duplicate'; slot: number; productId: string }
  | { type: 'missing'; slot: number; productId: string }
  | { type: 'unavailable'; slot: number; productId: string; productName: string }

export interface ChefPickSelectionInspection {
  mode: 'automatic' | 'manual'
  items: MenuItem[]
  issues: ChefPickSelectionIssue[]
  requestedCount: number
}

export function resolveChefPickItemCount(value: string | undefined, fallback = 3) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, parsed))
}

export function resolveChefPickItems(
  config: Record<string, string>,
  items: MenuItem[] = [],
) {
  return inspectChefPickSelection(config, items).items
}

export function inspectChefPickSelection(
  config: Record<string, string>,
  items: MenuItem[] = [],
): ChefPickSelectionInspection {
  const count = resolveChefPickItemCount(config.itemCount)
  const available = items
    .filter((item) => item.is_available)
    .sort((left, right) => left.position - right.position)

  if ((config.selectionMode || 'automatic') !== 'manual') {
    return {
      mode: 'automatic',
      items: available.slice(0, count),
      issues: [],
      requestedCount: count,
    }
  }

  const byId = new Map(items.map((item) => [item.id, item]))
  const selected: MenuItem[] = []
  const issues: ChefPickSelectionIssue[] = []
  const seen = new Set<string>()

  for (let index = 1; index <= MAX_ITEMS; index += 1) {
    const id = config[`item${index}Id`]?.trim()
    if (!id) continue
    if (seen.has(id)) {
      issues.push({ type: 'duplicate', slot: index, productId: id })
      continue
    }
    seen.add(id)
    const item = byId.get(id)
    if (!item) {
      issues.push({ type: 'missing', slot: index, productId: id })
      continue
    }
    if (!item.is_available) {
      issues.push({ type: 'unavailable', slot: index, productId: id, productName: item.name })
      continue
    }
    selected.push(item)
    if (selected.length === count) break
  }

  return {
    mode: 'manual',
    items: selected,
    issues,
    requestedCount: count,
  }
}
