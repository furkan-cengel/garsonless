'use client'

import { useCallback, useTransition } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Tables } from '@garsonless/db/types'
import {
  deleteCategory,
  reorderCategories,
  setMenuItemsAvailability,
  updateItem,
} from '../../lib/actions/menu'
import { patchMenuItemCollection, removeCategoryTreeFromMenu } from './menu-manager-command-model'

type MenuCategory = Tables<'menu_categories'>
type MenuItem = Tables<'menu_items'>

interface UseMenuManagerCommandsOptions {
  restaurantId: string
  categories: MenuCategory[]
  setCategories: Dispatch<SetStateAction<MenuCategory[]>>
  items: MenuItem[]
  setItems: Dispatch<SetStateAction<MenuItem[]>>
  activeCategory: string | null
  setActiveCategory: Dispatch<SetStateAction<string | null>>
  setActiveSubCategory: Dispatch<SetStateAction<string | null>>
  selectedItem: MenuItem | null
  setSelectedItem: Dispatch<SetStateAction<MenuItem | null>>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export function useMenuManagerCommands({
  restaurantId,
  categories,
  setCategories,
  items,
  setItems,
  activeCategory,
  setActiveCategory,
  setActiveSubCategory,
  selectedItem,
  setSelectedItem,
  onError,
  onSuccess,
}: UseMenuManagerCommandsOptions) {
  const [, startTransition] = useTransition()

  const removeCategory = useCallback((categoryId: string) => {
    const snapshot = { categories, items, activeCategory }
    const projected = removeCategoryTreeFromMenu(snapshot, categoryId)
    setCategories(projected.categories)
    setItems(projected.items)
    setActiveCategory(projected.activeCategory)
    setActiveSubCategory(null)

    startTransition(async () => {
      const result = await deleteCategory(categoryId, restaurantId)
      if ('error' in result) {
        setCategories(snapshot.categories)
        setItems(snapshot.items)
        setActiveCategory(snapshot.activeCategory)
        onError(result.error)
        return
      }
      onSuccess('Kategori silindi')
    })
  }, [activeCategory, categories, items, onError, onSuccess, restaurantId, setActiveCategory, setActiveSubCategory, setCategories, setItems])

  const reorder = useCallback((reordered: MenuCategory[]) => {
    const snapshot = categories
    setCategories(reordered)
    startTransition(async () => {
      const topLevelIds = reordered.filter((category) => !category.parent_id).map((category) => category.id)
      const result = await reorderCategories(restaurantId, topLevelIds)
      if ('error' in result) {
        setCategories(snapshot)
        onError(result.error)
        return
      }
      onSuccess('Kategori sırası kaydedildi')
    })
  }, [categories, onError, onSuccess, restaurantId, setCategories])

  const quickUpdate = useCallback((itemId: string, patch: { price?: number; is_available?: boolean }) => {
    const original = items.find((item) => item.id === itemId)
    if (!original) return

    setItems((current) => patchMenuItemCollection(current, null, itemId, patch).items)
    setSelectedItem((current) => patchMenuItemCollection([], current, itemId, patch).selectedItem)

    startTransition(async () => {
      const formData = new FormData()
      formData.append('id', itemId)
      formData.append('restaurantId', restaurantId)
      if (patch.price !== undefined) formData.append('price', String(patch.price))
      if (patch.is_available !== undefined) formData.append('is_available', String(patch.is_available))
      const result = await updateItem(formData)
      if ('error' in result) {
        setItems((current) => patchMenuItemCollection(current, null, itemId, original).items)
        setSelectedItem((current) => patchMenuItemCollection([], current, itemId, original).selectedItem)
        onError(result.error)
        return
      }
      setItems((current) => patchMenuItemCollection(current, null, itemId, result.item).items)
      setSelectedItem((current) => patchMenuItemCollection([], current, itemId, result.item).selectedItem)
      onSuccess(patch.is_available === undefined
        ? 'Fiyat güncellendi'
        : patch.is_available ? 'Ürün yayına alındı' : 'Ürün pasife alındı')
    })
  }, [items, onError, onSuccess, restaurantId, setItems, setSelectedItem])

  const setBulkAvailability = useCallback(async (itemIds: string[], isAvailable: boolean) => {
    setItems((current) => current.map((item) => itemIds.includes(item.id) ? { ...item, is_available: isAvailable } : item))

    const result = await setMenuItemsAvailability(restaurantId, itemIds, isAvailable)
    if ('error' in result) {
      setItems(items)
      setSelectedItem(selectedItem)
      onError(result.error)
      return false
    }
    setSelectedItem((current) => current && itemIds.includes(current.id) ? { ...current, is_available: isAvailable } : current)
    onSuccess(`${itemIds.length} ürün ${isAvailable ? 'yayına alındı' : 'pasife alındı'}`)
    return true
  }, [items, onError, onSuccess, restaurantId, selectedItem, setItems, setSelectedItem])

  return { removeCategory, reorder, quickUpdate, setBulkAvailability }
}
