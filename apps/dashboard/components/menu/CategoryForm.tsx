'use client'

import { useState, useTransition } from 'react'
import { createCategory, updateCategory } from '../../lib/actions/menu'
import { InlineSpinner } from '@garsonless/ui'
import type { Tables } from '@garsonless/db'

interface Props {
  restaurantId: string
  parentId?: string
  existing?: Tables<'menu_categories'>
  onCreated?: (cat: Tables<'menu_categories'>) => void
  onUpdated?: (cat: Tables<'menu_categories'>) => void
  onCancel: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 7, background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
}

export default function CategoryForm({ restaurantId, parentId, existing, onCreated, onUpdated, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      if (existing) {
        const fd = new FormData()
        fd.append('id', existing.id)
        fd.append('restaurantId', restaurantId)
        fd.append('name', name)
        if (description) fd.append('description', description)
        const result = await updateCategory(fd)
        if ('error' in result) { setError(result.error); return }
        onUpdated?.({ ...existing, name, description: description ?? null })
      } else {
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('name', name)
        if (description) fd.append('description', description)
        if (parentId) fd.append('parentId', parentId)
        const result = await createCategory(null, fd)
        if ('error' in result) { setError(result.error); return }
        onCreated?.({
          id: result.id,
          restaurant_id: restaurantId,
          name,
          description: description ?? null,
          position: 0,
          is_visible: true,
          parent_id: parentId ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        } as Tables<'menu_categories'>)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 10px 8px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <input
        type="text"
        placeholder="Kategori adı"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Açıklama (opsiyonel)"
        value={description ?? ''}
        onChange={(e) => setDescription(e.target.value || null)}
        style={inputStyle}
      />
      {error && (
        <p style={{ fontSize: 11.5, color: 'var(--critical)', margin: 0 }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            flex: 1, height: 30, borderRadius: 6,
            background: 'var(--action)', color: 'var(--on-action)',
            border: 'none', fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', opacity: isPending ? 0.55 : 1,
          }}
        >
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : existing ? 'Kaydet' : 'Ekle'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 30, padding: '0 10px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-2)', fontSize: 12.5, cursor: 'pointer',
          }}
        >
          İptal
        </button>
      </div>
    </form>
  )
}
