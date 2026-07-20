import type { Tables } from '@garsonless/db/types'

interface MenuManagerViewInput {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  activeCategoryId: string | null
  activeSubCategoryId: string | null
  selectedItem: Tables<'menu_items'> | null
  search: string
}

export function deriveMenuManagerView({
  categories,
  items,
  activeCategoryId,
  activeSubCategoryId,
  selectedItem,
  search,
}: MenuManagerViewInput) {
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? null
  const subCategories = activeCategoryId
    ? categories.filter((category) => category.parent_id === activeCategoryId)
    : []
  const activeCategoryIds = activeSubCategoryId
    ? [activeSubCategoryId]
    : activeCategoryId
      ? [activeCategoryId, ...subCategories.map((category) => category.id)]
      : null

  const normalizedSearch = search.toLowerCase()
  const visibleItems = items.filter((item) => {
    if (search) {
      return item.name.toLowerCase().includes(normalizedSearch)
        || (item.description ?? '').toLowerCase().includes(normalizedSearch)
    }
    return !activeCategoryIds || activeCategoryIds.includes(item.category_id)
  })

  return {
    activeCategory,
    subCategories,
    visibleItems,
    searchMatchedCategoryIds: search
      ? new Set(visibleItems.map((item) => item.category_id))
      : undefined,
    activeCategoryForPanel: selectedItem
      ? (categories.find((category) => category.id === selectedItem.category_id) ?? activeCategory)
      : activeCategory,
    navigationActiveId: activeSubCategoryId ?? activeCategoryId,
  }
}
