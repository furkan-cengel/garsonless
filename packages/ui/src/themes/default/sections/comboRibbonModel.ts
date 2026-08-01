import type { MenuItem } from '../../../menu/types'
import { parseBundlePrice } from '@garsonless/domain/menu'

const MIN_COMBO_ITEMS = 2
const MAX_COMBO_ITEMS = 3
const MAX_COMBOS = 3

export interface ResolvedComboRibbonGroup {
  id: string
  index: number
  items: MenuItem[]
  catalogTotal: number
  total: number
  requiresConfiguration: boolean
  hasSpecialPrice: boolean
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function resolveComboCount(value: string | undefined) {
  return boundedInteger(value, 2, 1, MAX_COMBOS)
}

function resolveComboItemCount(value: string | undefined) {
  return boundedInteger(value, 2, MIN_COMBO_ITEMS, MAX_COMBO_ITEMS)
}

function itemNeedsConfiguration(item: MenuItem) {
  return item.modifier_groups.length > 0 || item.ingredients.some((ingredient) => ingredient.removable)
}

/**
 * Resolve combo cards only from live, available menu products. Automatic mode
 * partitions products so the same product is not repeated across cards. Manual
 * mode preserves the editor order and ignores stale/duplicate product ids.
 */
export function resolveComboRibbonGroups(
  config: Record<string, string>,
  items: MenuItem[] = [],
): ResolvedComboRibbonGroup[] {
  const comboCount = resolveComboCount(config.comboCount)
  const itemsPerCombo = resolveComboItemCount(config.itemsPerCombo)
  const available = items
    .filter((item) => item.is_available)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
  const manual = (config.selectionMode || 'automatic') === 'manual'
  const groups: ResolvedComboRibbonGroup[] = []

  for (let comboIndex = 1; comboIndex <= comboCount; comboIndex += 1) {
    let selected: MenuItem[]

    if (manual) {
      const byId = new Map(available.map((item) => [item.id, item]))
      const seen = new Set<string>()
      selected = []
      for (let itemIndex = 1; itemIndex <= MAX_COMBO_ITEMS; itemIndex += 1) {
        const itemId = config[`combo${comboIndex}Item${itemIndex}Id`]?.trim()
        if (!itemId || seen.has(itemId)) continue
        const item = byId.get(itemId)
        if (!item) continue
        seen.add(itemId)
        selected.push(item)
        if (selected.length === itemsPerCombo) break
      }
    } else {
      const start = (comboIndex - 1) * itemsPerCombo
      selected = available.slice(start, start + itemsPerCombo)
    }

    // A single item is a featured product, not a combo. Fail closed instead of
    // showing a misleading bundle card.
    if (selected.length < MIN_COMBO_ITEMS) continue

    const catalogTotal = selected.reduce((sum, item) => sum + item.price, 0)
    const specialPrice = parseBundlePrice(config[`combo${comboIndex}Price`])
    groups.push({
      id: `combo-${comboIndex}`,
      index: comboIndex,
      items: selected,
      catalogTotal,
      total: specialPrice ?? catalogTotal,
      requiresConfiguration: selected.some(itemNeedsConfiguration),
      hasSpecialPrice: specialPrice !== null && specialPrice !== catalogTotal,
    })
  }

  return groups
}
