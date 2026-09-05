'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Tables } from '@garsonless/db/types'
import {
  deleteCategory,
  reorderCategories,
  setMenuItemsAvailability,
  updateItem,
} from '../../lib/actions/menu'
import { createMenuMutationLock } from './menu-mutation-lock'
import { collectCategoryTreeIds } from './menu-category-workspace-model'
import { patchMenuItemCollection } from './menu-manager-command-model'

type MenuCategory = Tables<'menu_categories'>
type MenuItem = Tables<'menu_items'>

interface UseMenuManagerCommandsOptions {
  restaurantId: string
  categories: MenuCategory[]
  setCategories: Dispatch<SetStateAction<MenuCategory[]>>
  items: MenuItem[]
  setItems: Dispatch<SetStateAction<MenuItem[]>>
  setActiveCategory: Dispatch<SetStateAction<string | null>>
  setActiveSubCategory: Dispatch<SetStateAction<string | null>>
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
  setActiveCategory,
  setActiveSubCategory,
  setSelectedItem,
  onError,
  onSuccess,
}: UseMenuManagerCommandsOptions) {
  const [, startTransition] = useTransition()
  const lock = useRef(createMenuMutationLock())
  const [pending, setPending] = useState(lock.current.snapshot)
  const acquire = useCallback((ids: string[] | null) => {
    const release = lock.current.acquire(ids)
    if (!release) {
      onError('Bu ürün için kayıt sürüyor. Tamamlanmasını bekleyin.')
      return null
    }
    setPending(lock.current.snapshot())
    return () => { release(); setPending(lock.current.snapshot()) }
  }, [onError])

  const removeCategory = useCallback((categoryId: string) => {
    const release = acquire(null)
    if (!release) return
    startTransition(async () => {
      try {
        const result = await deleteCategory(categoryId, restaurantId)
        if ('error' in result) { onError(result.error); return }
        const removed = new Set(collectCategoryTreeIds(categories, categoryId))
        setCategories((current) => current.filter((category) => !removed.has(category.id)))
        setItems((current) => current.filter((item) => !removed.has(item.category_id)))
        setSelectedItem((current) => current && removed.has(current.category_id) ? null : current)
        setActiveCategory((current) => current && removed.has(current) ? null : current)
        setActiveSubCategory((current) => current && removed.has(current) ? null : current)
        onSuccess('Kategori silindi')
      } catch { onError('Kategori silinemedi. Menüyü yenileyip tekrar deneyin.') }
      finally { release() }
    })
  }, [acquire, categories, onError, onSuccess, restaurantId, setActiveCategory, setActiveSubCategory, setCategories, setItems, setSelectedItem])

  const reorder = useCallback((reordered: MenuCategory[]) => {
    const release = acquire(null)
    if (!release) return
    startTransition(async () => {
      try {
        const topLevelIds = reordered.filter((category) => !category.parent_id).map((category) => category.id)
        const result = await reorderCategories(restaurantId, topLevelIds)
        if ('error' in result) { onError(result.error); return }
        const rank = new Map(reordered.map((category, index) => [category.id, index]))
        setCategories((current) => [...current].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)))
        onSuccess('Kategori sırası kaydedildi')
      } catch { onError('Kategori sırası kaydedilemedi. Tekrar deneyin.') }
      finally { release() }
    })
  }, [acquire, onError, onSuccess, restaurantId, setCategories])

  const quickUpdate = useCallback((itemId: string, patch: { price?: number; is_available?: boolean }) => {
    const original = items.find((item) => item.id === itemId)
    if (!original) return
    const release = acquire([itemId])
    if (!release) return
    const apply = (value: typeof patch) => {
      setItems((current) => patchMenuItemCollection(current, null, itemId, value).items)
      setSelectedItem((current) => patchMenuItemCollection([], current, itemId, value).selectedItem)
    }
    const rollback = {
      ...(patch.price !== undefined ? { price: original.price } : {}),
      ...(patch.is_available !== undefined ? { is_available: original.is_available } : {}),
    }
    apply(patch)
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('id', itemId)
        formData.append('restaurantId', restaurantId)
        if (patch.price !== undefined) formData.append('price', String(patch.price))
        if (patch.is_available !== undefined) formData.append('is_available', String(patch.is_available))
        const result = await updateItem(formData)
        if ('error' in result) { apply(rollback); onError(result.error); return }
        // Do not overwrite unrelated fields changed by the editor or live feed.
        apply({
          ...(patch.price !== undefined ? { price: result.item.price } : {}),
          ...(patch.is_available !== undefined ? { is_available: result.item.is_available } : {}),
        })
        onSuccess(patch.is_available === undefined ? 'Fiyat güncellendi' : patch.is_available ? 'Ürün yayına alındı' : 'Ürün pasife alındı')
      } catch { apply(rollback); onError('Ürün kaydedilemedi. Menüyü yenileyip tekrar deneyin.') }
      finally { release() }
    })
  }, [acquire, items, onError, onSuccess, restaurantId, setItems, setSelectedItem])

  const setBulkAvailability = useCallback(async (itemIds: string[], isAvailable: boolean) => {
    const ids = [...new Set(itemIds)]
    if (ids.length === 0) return false
    const release = acquire(ids)
    if (!release) return false
    const before = new Map(items.filter((item) => ids.includes(item.id)).map((item) => [item.id, item.is_available]))
    const apply = (rollback = false) => {
      const patch = (item: MenuItem) => before.has(item.id)
        ? { ...item, is_available: rollback ? before.get(item.id)! : isAvailable } : item
      setItems((current) => current.map(patch))
      setSelectedItem((current) => current ? patch(current) : current)
    }
    apply()
    try {
      const result = await setMenuItemsAvailability(restaurantId, ids, isAvailable)
      if ('error' in result) { apply(true); onError(result.error); return false }
      onSuccess(`${ids.length} ürün ${isAvailable ? 'yayına alındı' : 'pasife alındı'}`)
      return true
    } catch { apply(true); onError('Ürünler kaydedilemedi. Menüyü yenileyip tekrar deneyin.'); return false }
    finally { release() }
  }, [acquire, items, onError, onSuccess, restaurantId, setItems, setSelectedItem])

  return {
    removeCategory, reorder, quickUpdate, setBulkAvailability,
    pendingItemIds: pending.itemIds,
    structuralPending: pending.structural,
    pending: pending.structural || pending.itemIds.size > 0,
  }
}
