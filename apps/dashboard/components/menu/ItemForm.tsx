'use client'

import { useState, useTransition } from 'react'
import { createItem, updateItem } from '../../lib/actions/menu'
import { InlineSpinner } from '@garsonless/ui'
import ModifierGroupBuilder, { type ModifierGroup } from './ModifierGroupBuilder'
import type { Tables } from '@garsonless/db'

interface Props {
  restaurantId: string
  categoryId: string
  existing?: Tables<'menu_items'>
  onCreated?: (item: Tables<'menu_items'>) => void
  onUpdated?: (item: Tables<'menu_items'>) => void
  onCancel: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 11px',
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
}

export default function ItemForm({ restaurantId, categoryId, existing, onCreated, onUpdated, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [price, setPrice] = useState(String(existing?.price ?? ''))
  const [isAvailable, setIsAvailable] = useState(existing?.is_available ?? true)
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>(
    (existing?.modifier_groups as ModifierGroup[] | null) ?? [],
  )
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const fd = new FormData()
      fd.append('restaurantId', restaurantId)
      fd.append('categoryId', categoryId)
      fd.append('name', name)
      if (description) fd.append('description', description)
      fd.append('price', price)
      fd.append('is_available', String(isAvailable))
      fd.append('modifier_groups', JSON.stringify(modifierGroups))

      if (existing) {
        fd.append('id', existing.id)
        const result = await updateItem(fd)
        if ('error' in result) { setError(result.error); return }
        onUpdated?.({
          ...existing,
          name,
          description: description || null,
          price: Number(price),
          is_available: isAvailable,
          modifier_groups: modifierGroups as unknown as import('@garsonless/db').Json,
        })
      } else {
        const result = await createItem(null, fd)
        if ('error' in result) { setError(result.error); return }
        onCreated?.({
          id: result.id,
          category_id: categoryId,
          name,
          description: description || null,
          price: Number(price),
          is_available: isAvailable,
          images: [] as unknown as import('@garsonless/db').Json,
          modifier_groups: modifierGroups as unknown as import('@garsonless/db').Json,
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        } as Tables<'menu_items'>)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Name */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
          Ürün adı <span style={{ color: 'var(--critical)' }}>*</span>
        </div>
        <input
          type="text"
          placeholder="ör. Türk Kahvesi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          style={inputStyle}
        />
      </div>

      {/* Price + availability row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
            Fiyat (₺) <span style={{ color: 'var(--critical)' }}>*</span>
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={price}
            min={0}
            step={0.01}
            onChange={(e) => setPrice(e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 13, color: 'var(--text-2)', cursor: 'pointer',
          height: 38, whiteSpace: 'nowrap',
        }}>
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            style={{ width: 15, height: 15, margin: 0, cursor: 'pointer' }}
          />
          Menüde görünür
        </label>
      </div>

      {/* Description */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
          Açıklama <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(opsiyonel)</span>
        </div>
        <textarea
          placeholder="Kısa tanım…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{
            ...inputStyle, height: 'auto', padding: '8px 11px',
            resize: 'none', lineHeight: 1.5,
          }}
        />
      </div>

      {/* Modifiers */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 7 }}>
          Modifier grupları
        </div>
        <ModifierGroupBuilder value={modifierGroups} onChange={setModifierGroups} />
      </div>

      {error && (
        <p style={{ fontSize: 12.5, color: 'var(--critical)', margin: 0 }}>{error}</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            height: 38, padding: '0 20px', borderRadius: 8,
            background: 'var(--action)', color: 'var(--on-action)',
            border: 'none', fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', opacity: isPending ? 0.55 : 1,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)',
          }}
        >
          {isPending ? <InlineSpinner size={14} color="var(--on-action)" /> : existing ? 'Kaydet' : 'Ürün ekle'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 38, padding: '0 16px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-2)', fontSize: 13.5, cursor: 'pointer',
          }}
        >
          İptal
        </button>
      </div>
    </form>
  )
}
