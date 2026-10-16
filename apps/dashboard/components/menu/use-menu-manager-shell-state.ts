'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMenuDrafts } from './MenuDraftProvider'
import type { Tables } from '@garsonless/db/types'
import type { MenuWorkspaceStage } from './menu-manager-view-model'
import { focusMenuField } from './menu-manager-utils'

type MenuCategory = Tables<'menu_categories'>
type MenuItem = Tables<'menu_items'>

export function useMenuManagerShellState({
  initialCategories,
  initialItems,
}: {
  initialCategories: MenuCategory[]
  initialItems: MenuItem[]
}) {
  const { registry, requestExit } = useMenuDrafts()
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialCategories.find((category) => !category.parent_id)?.id ?? null,
  )
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [categoryAddRequest, setCategoryAddRequest] = useState(0)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [workspaceStage, setWorkspaceStage] = useState<MenuWorkspaceStage>('categories')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const editorReturnFocusRef = useRef<HTMLElement | null>(null)
  const addItemReturnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (registry.dirty || registry.pending) return
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
  }, [initialCategories, initialItems, registry])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k' && !document.querySelector('[role=dialog], [role=alertdialog]')) {
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
    requestExit(action)
  }

  function selectItem(item: MenuItem) {
    if (selectedItem?.id === item.id && workspaceStage === 'editor') return
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
    setWorkspaceStage('editor')
    // The wizard has no photo step; land the owner on it so the product is not born "missing".
    if (!(Array.isArray(item.images) && item.images.length > 0)) focusMenuField(item.id, 'image')
  }

  function requestAddCategory() {
    requestExit(() => {
      setSelectedItem(null)
      setWorkspaceStage('categories')
      setCategoryAddRequest((current) => current + 1)
    })
  }

  function openAddItem(event?: { currentTarget: EventTarget | null }) {
    const trigger = event?.currentTarget ?? document.activeElement
    addItemReturnFocusRef.current = trigger instanceof HTMLElement ? trigger : null
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

  function requestAddItem(event?: { currentTarget: EventTarget | null }) {
    const currentTarget = event?.currentTarget ?? document.activeElement
    requestExit(() => { setSelectedItem(null); openAddItem({ currentTarget }) })
  }

  function closeAddItem() {
    setShowAddItem(false)
    requestAnimationFrame(() => addItemReturnFocusRef.current?.focus())
  }

  function closeItemEditor() {
    requestEditorExit(() => {
      setSelectedItem(null)
      setWorkspaceStage('items')
      requestAnimationFrame(() => editorReturnFocusRef.current?.focus())
    })
  }

  function updateSearch(value: string) {
    const update = () => { setSearch(value); if (value) { setSelectedItem(null); setWorkspaceStage('items') } }
    if (selectedItem) requestExit(update)
    else update()
  }

  function goBack() {
    if (workspaceStage === 'editor') {
      closeItemEditor()
      return
    }
    requestExit(() => setWorkspaceStage('categories'))
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
    showAddItem,
    closeAddItem,
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
    workspaceStage,
    setWorkspaceStage,
    goBack,
  }
}
