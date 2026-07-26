import type { MenuItem } from '../../../menu/types'

const MIN_ITEMS = 1
const MAX_ITEMS = 4

export function resolveChefPickItemCount(value: string | undefined, fallback = 3) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, parsed))
}

export function resolveChefPickItems(
  config: Record<string, string>,
  items: MenuItem[] = [],
) {
  const count = resolveChefPickItemCount(config.itemCount)
  const available = items
    .filter((item) => item.is_available)
    .sort((left, right) => left.position - right.position)

  if ((config.selectionMode || 'automatic') !== 'manual') {
    return available.slice(0, count)
  }

  const byId = new Map(available.map((item) => [item.id, item]))
  const selected: MenuItem[] = []
  const seen = new Set<string>()

  for (let index = 1; index <= MAX_ITEMS; index += 1) {
    const id = config[`item${index}Id`]?.trim()
    if (!id || seen.has(id)) continue
    const item = byId.get(id)
    if (!item) continue
    seen.add(id)
    selected.push(item)
    if (selected.length === count) break
  }

  return selected
}
