import type { MenuItem } from '../../../menu/types'

const MIN_ITEMS = 2
const MAX_ITEMS = 8

export function resolveFeaturedScrollItemCount(value: string | undefined, fallback = 4) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, parsed))
}

export function resolveFeaturedScrollItems(
  config: Record<string, string>,
  items: MenuItem[] = [],
) {
  const count = resolveFeaturedScrollItemCount(config.itemCount)
  const available = items
    .filter((item) => item.is_available)
    .sort((left, right) => {
      const leftRank = left.featuredRank ?? Number.MAX_SAFE_INTEGER
      const rightRank = right.featuredRank ?? Number.MAX_SAFE_INTEGER
      return leftRank - rightRank || left.position - right.position
    })

  return available.slice(0, count)
}
