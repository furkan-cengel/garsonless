'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tables } from '@garsonless/db'

type MenuCategory = Tables<'menu_categories'>
type MenuItem = Tables<'menu_items'>

export function useMenuManagerShellState({
  initialCategories,
  initialItems,
}: {
  initialCategories: MenuCategory[]
  initialItems: MenuItem[]
}) {
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialCategories.find((category) => !category.parent_id)?.id ?? null,
  )
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [itemEditDirty, setItemEditDirty] = useState(false)
  const [pendingEditorExit, setPendingEditorExit] = useState<(() => void) | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const showError = useCallback((message: string) => {
    setToastMessage(message)
    setToastTone('error')
  }, [])

  const showSuccess = useCallback((message: string) => {
    setToastMessage(message)
    setToastTone('success')
  }, [])

  function requestEditorExit(action: () => void) {
    if (!itemEditDirty) action()
    else setPendingEditorExit(() => action)
  }

  function selectItem(item: MenuItem) {
    if (selectedItem?.id === item.id) return
    requestEditorExit(() => setSelectedItem(item))
  }

  function selectCategory(id: string) {
    requestEditorExit(() => {
      const category = categories.find((candidate) => candidate.id === id)
      if (category?.parent_id) {
        setActiveCategory(category.parent_id)
        setActiveSubCategory(id)
      } else {
        setActiveCategory(id)
        setActiveSubCategory(null)
      }
      setSelectedItem(null)
    })
  }

  function selectSubCategory(id: string | null) {
    requestEditorExit(() => {
      setActiveSubCategory(id)
      setSelectedItem(null)
    })
  }

  function addCategory(category: MenuCategory) {
    setCategories((current) => [...current, category])
    if (category.parent_id) {
      setActiveCategory(category.parent_id)
      setActiveSubCategory(category.id)
    } else {
      setActiveCategory(category.id)
      setActiveSubCategory(null)
    }
  }

  function updateCategory(category: MenuCategory) {
    setCategories((current) => current.map((candidate) => candidate.id === category.id ? category : candidate))
  }

  function saveItem(item: MenuItem) {
    setItems((current) => current.map((candidate) => candidate.id === item.id ? item : candidate))
    setSelectedItem(item)
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId))
    setSelectedItem(null)
  }

  function createItem(item: MenuItem) {
    setItems((current) => [...current, item])
    setShowAddItem(false)
    setSelectedItem(item)
  }

  function closeItemEditor() {
    requestEditorExit(() => setSelectedItem(null))
  }

  function keepEditing() {
    setPendingEditorExit(null)
  }

  function discardPendingChanges() {
    const action = pendingEditorExit
    setPendingEditorExit(null)
    setItemEditDirty(false)
    action?.()
  }

  function notify(message: string, tone: 'error' | 'success') {
    setToastMessage(message)
    setToastTone(tone)
  }

  return {
    mounted,
    categories,
    setCategories,
    items,
    setItems,
    activeCategory,
    setActiveCategory,
    activeSubCategory,
    setActiveSubCategory,
    selectedItem,
    setSelectedItem,
    setItemEditDirty,
    pendingEditorExit,
    showAddItem,
    setShowAddItem,
    search,
    setSearch,
    searchFocused,
    setSearchFocused,
    searchInputRef,
    toastMessage,
    toastTone,
    clearToast: () => setToastMessage(null),
    showError,
    showSuccess,
    notify,
    requestEditorExit,
    selectItem,
    selectCategory,
    selectSubCategory,
    addCategory,
    updateCategory,
    saveItem,
    removeItem,
    createItem,
    closeItemEditor,
    keepEditing,
    discardPendingChanges,
  }
}
