'use client'
import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Tables } from '@garsonless/db/types'
import type { MenuBulkChange } from '@garsonless/domain/menu-bulk'
import { useMenuDrafts } from './MenuDraftProvider'
export function useMenuBulkController({ items, setItems, setSelectedItem, pending, onError, onSuccess, onRefresh }: {
  items: Tables<'menu_items'>[]; setItems: Dispatch<SetStateAction<Tables<'menu_items'>[]>>
  setSelectedItem: Dispatch<SetStateAction<Tables<'menu_items'> | null>>
  pending: boolean; onError: (message: string) => void; onSuccess: (message: string) => void; onRefresh: () => void
}) {
  const [selection, setSelection] = useState<Tables<'menu_items'>[] | null>(null)
  const [scope, setScope] = useState<'all' | 'selected'>('selected')
  const { requestExit } = useMenuDrafts()
  function open(selectionIds: string[] | 'all') {
    const ids = selectionIds === 'all' ? items.map(item => item.id) : selectionIds
    if (pending) return
    if (ids.length > 500) { onError('Bir işlemde en fazla 500 ürün düzenlenebilir. Seçimi daraltın.'); return }
    requestExit(() => { setSelectedItem(null); setScope(selectionIds === 'all' ? 'all' : 'selected'); setSelection(items.filter(item => ids.includes(item.id))) })
  }
  function applied(changes: MenuBulkChange[]) {
    const byId = new Map(changes.map(change => [change.id, change]))
    setItems(current => current.map(item => {
      const change = byId.get(item.id)
      return change ? { ...item, ...change.after, updated_at: change.afterVersion ?? item.updated_at } : item
    }))
    onSuccess(`${changes.length} ürün güncellendi.`)
    onRefresh()
  }
  return { selection, scope, open, applied, close: () => setSelection(null) }
}
