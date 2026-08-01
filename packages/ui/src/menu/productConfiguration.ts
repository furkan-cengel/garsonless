import type { MenuItem } from './types'

type ConfigurableMenuItem = Pick<MenuItem, 'modifier_groups' | 'ingredients'>

export function hasConfigurableModifierGroups(
  item: Pick<MenuItem, 'modifier_groups'>,
): boolean {
  return item.modifier_groups.some((group) => group.max > 0 && group.options.length > 0)
}

export function isProductConfigurable(item: ConfigurableMenuItem): boolean {
  return hasConfigurableModifierGroups(item)
    || item.ingredients.some((ingredient) => ingredient.removable)
}
