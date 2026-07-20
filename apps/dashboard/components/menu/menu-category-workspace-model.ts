import type { Tables } from '@garsonless/db/types'

type Category = Tables<'menu_categories'>
type MenuItem = Tables<'menu_items'>

export interface CategoryWorkspaceView {
  topLevel: Category[]
  activeTopId: string | null
  totalItems: number
  availableItems: number
  unavailableItems: number
}

export function deriveCategoryWorkspaceView({
  categories,
  items,
  activeId,
  visibleCategoryIds,
}: {
  categories: Category[]
  items: MenuItem[]
  activeId: string | null
  visibleCategoryIds?: Set<string>
}): CategoryWorkspaceView {
  const allTopLevel = categories.filter((category) => !category.parent_id)
  const topLevel = visibleCategoryIds
    ? allTopLevel.filter((category) =>
        visibleCategoryIds.has(category.id) ||
        categories.some(
          (child) => child.parent_id === category.id && visibleCategoryIds.has(child.id),
        ),
      )
    : allTopLevel
  const activeCategory = categories.find((category) => category.id === activeId)
  const availableItems = items.filter((item) => item.is_available).length

  return {
    topLevel,
    activeTopId: activeCategory?.parent_id ?? activeId,
    totalItems: items.length,
    availableItems,
    unavailableItems: items.length - availableItems,
  }
}

export function collectCategoryTreeIds(categories: Category[], categoryId: string) {
  const ids = new Set([categoryId])
  let changed = true
  while (changed) {
    changed = false
    for (const category of categories) {
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id)
        changed = true
      }
    }
  }
  return Array.from(ids)
}

export function mergeTopLevelCategoryOrder(categories: Category[], orderedTopLevelIds: string[]) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const orderedTopLevel = orderedTopLevelIds
    .map((id) => byId.get(id))
    .filter((category): category is Category => Boolean(category && !category.parent_id))
  const included = new Set(orderedTopLevel.map((category) => category.id))
  const remainingTopLevel = categories.filter(
    (category) => !category.parent_id && !included.has(category.id),
  )
  const children = categories.filter((category) => category.parent_id)
  return [...orderedTopLevel, ...remainingTopLevel, ...children]
}
