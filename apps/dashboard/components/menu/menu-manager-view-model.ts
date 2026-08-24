import type { Tables } from '@garsonless/db/types'

interface MenuManagerViewInput {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  activeCategoryId: string | null
  activeSubCategoryId: string | null
  selectedItem: Tables<'menu_items'> | null
  search: string
}

type MenuManagerEmptyAction = 'add-category' | 'add-item' | 'select-item'

export type MenuWorkspaceStage = 'categories' | 'items' | 'editor'

export function normalizeMenuSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ı', 'i')
}

export interface MenuManagerEmptyState {
  title: string
  description: string
  action: MenuManagerEmptyAction
}

export function deriveMenuManagerEmptyState({
  categoryCount,
  itemCount,
}: {
  categoryCount: number
  itemCount: number
}): MenuManagerEmptyState {
  if (categoryCount === 0) {
    return {
      title: 'Menünü oluşturmaya başla',
      description: 'Önce ürünlerini gruplayacağın bir kategori ekle.',
      action: 'add-category',
    }
  }

  if (itemCount === 0) {
    return {
      title: 'İlk ürününü ekle',
      description: 'Kategorin hazır. Şimdi müşterilerinin göreceği ilk ürünü oluştur.',
      action: 'add-item',
    }
  }

  return {
    title: 'Bir ürün seç',
    description: 'Düzenlemek istediğin ürünü tıkla.',
    action: 'select-item',
  }
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

  const normalizedSearch = normalizeMenuSearch(search)
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const childIdsByParentId = new Map<string, string[]>()
  for (const category of categories) {
    if (!category.parent_id) continue
    childIdsByParentId.set(category.parent_id, [
      ...(childIdsByParentId.get(category.parent_id) ?? []),
      category.id,
    ])
  }

  function categoryTreeIds(categoryId: string): string[] {
    const result = [categoryId]
    for (const childId of childIdsByParentId.get(categoryId) ?? []) {
      result.push(...categoryTreeIds(childId))
    }
    return result
  }

  const directlyMatchedCategoryIds = normalizedSearch
    ? new Set(categories
      .filter((category) => normalizeMenuSearch(category.name).includes(normalizedSearch))
      .flatMap((category) => categoryTreeIds(category.id)))
    : new Set<string>()
  const visibleItems = items.filter((item) => {
    if (normalizedSearch) {
      return normalizeMenuSearch(item.name).includes(normalizedSearch)
        || normalizeMenuSearch(item.description ?? '').includes(normalizedSearch)
        || directlyMatchedCategoryIds.has(item.category_id)
    }
    return !activeCategoryIds || activeCategoryIds.includes(item.category_id)
  })

  const searchMatchedCategoryIds = normalizedSearch
    ? new Set<string>()
    : undefined
  if (searchMatchedCategoryIds) {
    for (const item of visibleItems) {
      let category = categoryById.get(item.category_id)
      while (category) {
        searchMatchedCategoryIds.add(category.id)
        category = category.parent_id ? categoryById.get(category.parent_id) : undefined
      }
    }
  }

  return {
    activeCategory,
    subCategories,
    visibleItems,
    searchMatchedCategoryIds,
    activeCategoryForPanel: selectedItem
      ? (categories.find((category) => category.id === selectedItem.category_id) ?? activeCategory)
      : activeCategory,
    navigationActiveId: activeSubCategoryId ?? activeCategoryId,
  }
}
