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
