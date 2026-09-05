'use client'

import { useMemo } from 'react'
import { itemMatchesMenuFilters } from '@garsonless/ui/menu'
import type { CartItem, MenuCategory, MenuFilterDefinition, MenuItem } from '@garsonless/ui/menu'
import { buildCatalogCartQuantityByItemId } from '../cart-quantity-projection'

export function useMenuCatalog({
  items,
  categories,
  menuFilters,
  cartItems,
}: {
  items: MenuItem[]
  categories: MenuCategory[]
  menuFilters: MenuFilterDefinition[]
  cartItems: CartItem[]
}) {
  return useMemo(() => {
    const filteredItems = menuFilters.length === 0
      ? items
      : items.filter((item) => itemMatchesMenuFilters(item, menuFilters))
    const visibleIds = new Set(filteredItems.map((item) => item.category_id))
    let changed = true
    while (changed) {
      changed = false
      for (const category of categories) {
        if (!visibleIds.has(category.id) || !category.parent_id || visibleIds.has(category.parent_id)) continue
        visibleIds.add(category.parent_id)
        changed = true
      }
    }
    const visibleCategories = categories.filter((category) => visibleIds.has(category.id))
    const itemsByCategory = Object.fromEntries(
      visibleCategories.map((category) => [category.id, [] as MenuItem[]]),
    ) as Record<string, MenuItem[]>
    for (const item of filteredItems) itemsByCategory[item.category_id]?.push(item)

    const childrenByParent = new Map<string, string[]>()
    for (const category of visibleCategories) {
      if (!category.parent_id) continue
      childrenByParent.set(category.parent_id, [
        ...(childrenByParent.get(category.parent_id) ?? []),
        category.id,
      ])
    }
    const descendants = (categoryId: string): string[] => [
      categoryId,
      ...(childrenByParent.get(categoryId) ?? []).flatMap(descendants),
    ]
    const categoryMeta = visibleCategories.reduce<Record<string, { imageUrl: string | null; itemCount: number }>>((result, category) => {
      const categoryItems = descendants(category.id).flatMap((id) => itemsByCategory[id] ?? [])
      result[category.id] = {
        imageUrl: category.image_url ?? categoryItems.find((item) => item.images.length > 0)?.images[0] ?? null,
        itemCount: categoryItems.length,
      }
      return result
    }, {})
    const cartQuantityByItemId = buildCatalogCartQuantityByItemId(cartItems)
    const cartSummary = cartItems.reduce((summary, item) => ({
      count: summary.count + item.quantity,
      subtotal: summary.subtotal + (item.price + item.modifiersPriceDelta) * item.quantity,
    }), { count: 0, subtotal: 0 })

    return {
      filteredItems,
      visibleCategories,
      itemsByCategory,
      categoryMeta,
      cartQuantityByItemId,
      cartSummary,
    }
  }, [cartItems, categories, items, menuFilters])
}
