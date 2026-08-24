'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tables } from '@garsonless/db/types'
import type { MenuWorkspaceStage } from './menu-manager-view-model'

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
  const [categoryAddRequest, setCategoryAddRequest] = useState(0)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [workspaceStage, setWorkspaceStage] = useState<MenuWorkspaceStage>('categories')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const editorReturnFocusRef = useRef<HTMLElement | null>(null)
  const itemEditDirtyRef = useRef(itemEditDirty)

  useEffect(() => setMounted(true), [])
  useEffect(() => { itemEditDirtyRef.current = itemEditDirty }, [itemEditDirty])

  useEffect(() => {
    if (itemEditDirtyRef.current) return
    setCategories(initialCategories)
    setItems(initialItems)
    setSelectedItem((current) => current
      ? (initialItems.find((item) => item.id === current.id) ?? null)
      : null)
    setActiveCategory((current) => (
      current && initialCategories.some((category) => category.id === current)
        ? current
        : initialCategories.find((category) => !category.parent_id)?.id ?? null
    ))
    setActiveSubCategory((current) => (
      current && initialCategories.some((category) => category.id === current)
        ? current
        : null
    ))
  }, [initialCategories, initialItems])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (
        event.key === 'Escape'
        && search
        && workspaceStage !== 'editor'
        && !document.querySelector('[role="dialog"][aria-modal="true"]')
      ) {
        event.preventDefault()
        setSearch('')
        setWorkspaceStage('categories')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [search, workspaceStage])

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
    const source = document.activeElement
    if (source instanceof HTMLElement) editorReturnFocusRef.current = source
    requestEditorExit(() => {
      setSelectedItem(item)
      setWorkspaceStage('editor')
    })
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
      setWorkspaceStage('items')
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

  function requestAddCategory() {
    setWorkspaceStage('categories')
    setCategoryAddRequest((current) => current + 1)
  }

  function requestAddItem() {
    const targetCategoryId = activeSubCategory
      ?? activeCategory
      ?? categories.find((category) => !category.parent_id)?.id
      ?? categories[0]?.id

    if (!targetCategoryId) {
      requestAddCategory()
      return
    }

    const targetCategory = categories.find((category) => category.id === targetCategoryId)
    if (targetCategory?.parent_id) {
      setActiveCategory(targetCategory.parent_id)
      setActiveSubCategory(targetCategory.id)
    } else {
      setActiveCategory(targetCategoryId)
      setActiveSubCategory(null)
    }
    setWorkspaceStage('items')
    setShowAddItem(true)
  }

  function closeItemEditor() {
    requestEditorExit(() => {
      setSelectedItem(null)
      setWorkspaceStage('items')
      requestAnimationFrame(() => editorReturnFocusRef.current?.focus())
    })
  }

  function updateSearch(value: string) {
    setSearch(value)
    if (value) setWorkspaceStage('items')
  }

  function goBack() {
    if (workspaceStage === 'editor') {
      closeItemEditor()
      return
    }
    setWorkspaceStage('categories')
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
    itemEditDirty,
    setItemEditDirty,
    pendingEditorExit,
    showAddItem,
    setShowAddItem,
    categoryAddRequest,
    search,
    setSearch: updateSearch,
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
    requestAddCategory,
    requestAddItem,
    closeItemEditor,
    keepEditing,
    discardPendingChanges,
    workspaceStage,
    setWorkspaceStage,
    goBack,
  }
}
