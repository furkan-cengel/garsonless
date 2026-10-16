import type { Tables } from '@garsonless/db/types'
import { collectCategoryTreeIds } from './menu-category-workspace-model'

type MenuCategory = Tables<'menu_categories'>
type MenuItem = Tables<'menu_items'>

export interface MenuManagerCollectionState {
  categories: MenuCategory[]
  items: MenuItem[]
  activeCategory: string | null
}

export function removeCategoryTreeFromMenu(
  state: MenuManagerCollectionState,
  categoryId: string,
): MenuManagerCollectionState {
  const deletedCategory = state.categories.find((category) => category.id === categoryId)
  const deletedIds = collectCategoryTreeIds(state.categories, categoryId)
  const categories = state.categories.filter((category) => !deletedIds.includes(category.id))
  const items = state.items.filter((item) => !deletedIds.includes(item.category_id))

  if (!state.activeCategory || !deletedIds.includes(state.activeCategory)) {
    return { categories, items, activeCategory: state.activeCategory }
  }

  const remainingTopLevel = categories.filter((category) => !category.parent_id)
  const activeCategory = remainingTopLevel.find(
    (category) => category.id !== (deletedCategory?.parent_id ?? categoryId),
  )?.id ?? remainingTopLevel[0]?.id ?? null

  return { categories, items, activeCategory }
}

export function patchMenuItemCollection(
  items: MenuItem[],
  selectedItem: MenuItem | null,
  itemId: string,
  patch: Partial<MenuItem>,
): { items: MenuItem[]; selectedItem: MenuItem | null } {
  return {
    items: items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
    selectedItem: selectedItem?.id === itemId ? { ...selectedItem, ...patch } : selectedItem,
  }
}

/**
 * Apply a manual product order to one category. The category's products keep
 * the array slots they occupied (other categories never move) and take the new
 * sequence, with `position` rewritten to match what the server stores.
 */
export function applyMenuItemOrder(items: MenuItem[], categoryId: string, orderedIds: string[]): MenuItem[] {
  const byId = new Map(items.filter((item) => item.category_id === categoryId).map((item) => [item.id, item]))
  if (byId.size !== orderedIds.length || orderedIds.some((id) => !byId.has(id))) return items
  let next = 0
  return items.map((item) => {
    if (item.category_id !== categoryId) return item
    const position = next++
    return { ...byId.get(orderedIds[position]!)!, position }
  })
}
