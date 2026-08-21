import type { MenuItem } from '../../../menu/types'
import {
  COMBO_RIBBON_MAX_GROUPS,
  COMBO_RIBBON_MAX_ITEMS,
  COMBO_RIBBON_MIN_ITEMS,
  resolveComboRibbonSelection,
  type ComboRibbonSelectionIssue,
  type ComboRibbonSelectionIssueCode,
} from '@garsonless/domain/menu'

export const MIN_COMBO_ITEMS = COMBO_RIBBON_MIN_ITEMS
export const MAX_COMBO_ITEMS = COMBO_RIBBON_MAX_ITEMS
export const MAX_COMBOS = COMBO_RIBBON_MAX_GROUPS

export type ComboRibbonIssueCode = ComboRibbonSelectionIssueCode
export type ComboRibbonResolutionIssue = ComboRibbonSelectionIssue

export interface ResolvedComboRibbonGroup {
  id: string
  index: number
  items: MenuItem[]
  catalogTotal: number
  total: number
  savings: number
  savingsPercent: number
  requiresConfiguration: boolean
  hasSpecialPrice: boolean
  hasLegacyNonPromotionalPrice: boolean
}

export interface ResolvedComboRibbonState {
  groups: ResolvedComboRibbonGroup[]
  issues: ComboRibbonResolutionIssue[]
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
  return resolveComboRibbonState(config, items).groups
}

/**
 * Resolve both public-ready combo cards and editor diagnostics from the same
 * catalog snapshot. Version 2 fails closed for incomplete bundles and for a
 * configured "campaign" price that is not lower than the live catalog total.
 * Unversioned themes keep their historical totals without presenting them as
 * a discount.
 */
export function resolveComboRibbonState(
  config: Record<string, string>,
  items: MenuItem[] = [],
): ResolvedComboRibbonState {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const resolved = resolveComboRibbonSelection(config, items.map((item) => ({
    id: item.id,
    price: item.price,
    position: item.position,
    isAvailable: item.is_available,
  })))
  const groups = resolved.groups.flatMap((group): ResolvedComboRibbonGroup[] => {
    const selected = group.itemIds.flatMap((id) => {
      const item = itemsById.get(id)
      return item ? [item] : []
    })
    if (selected.length !== group.itemIds.length) return []
    return [{
      id: `combo-${group.index}`,
      index: group.index,
      items: selected,
      catalogTotal: group.catalogTotal,
      total: group.total,
      savings: group.savings,
      savingsPercent: group.savingsPercent,
      requiresConfiguration: selected.some(itemNeedsConfiguration),
      hasSpecialPrice: group.hasPromotionalPrice,
      hasLegacyNonPromotionalPrice: group.hasLegacyNonPromotionalPrice,
    }]
  })
  return { groups, issues: resolved.issues }
}
