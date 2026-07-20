'use client'

import { useRef, useState, useTransition } from 'react'
import { createCategory, updateCategory } from '../../lib/actions/menu'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { InlineSpinner } from '@garsonless/ui'
import type { Tables } from '@garsonless/db/types'

interface Props {
  restaurantId: string
  parentId?: string
  existing?: Tables<'menu_categories'>
  kitchenStations?: Tables<'kitchen_stations'>[]
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

const VAT_PRESETS = [1, 10, 20]

export default function CategoryForm({ restaurantId, parentId, existing, kitchenStations = [], onCreated, onUpdated, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? null)
  const [vatRate, setVatRate] = useState(String(existing?.vat_rate ?? 10))
  const [kitchenStationId, setKitchenStationId] = useState(existing?.kitchen_station_id ?? '')
  const [imageUrl, setImageUrl] = useState(existing?.image_url ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setUploading(true)
    setError('')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const categoryKey = existing?.id ?? crypto.randomUUID()
    const path = `restaurants/${restaurantId}/categories/${categoryKey}/${Date.now()}.${ext}`
    const supabase = createDashboardBrowserClient()
    const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true })
    if (uploadError) { setError(uploadError.message); setUploading(false); return }
    const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
    setImageUrl(data.publicUrl)
    setUploading(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const submittedVatRate = vatRate.trim() === '' ? String(existing?.vat_rate ?? 10) : vatRate
      const submittedVatNumber = Number(submittedVatRate)
      if (existing) {
        const fd = new FormData()
        fd.append('id', existing.id)
        fd.append('restaurantId', restaurantId)
        fd.append('name', name)
        fd.append('vat_rate', submittedVatRate)
        fd.append('kitchen_station_id', kitchenStationId)
        fd.append('image_url', imageUrl)
        if (description) fd.append('description', description)
        const result = await updateCategory(fd)
        if ('error' in result) { setError(result.error); return }
        onUpdated?.({ ...existing, name, description: description ?? null, image_url: imageUrl || null, vat_rate: Number.isFinite(submittedVatNumber) ? submittedVatNumber : 0, kitchen_station_id: kitchenStationId || null })
      } else {
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('name', name)
        fd.append('vat_rate', submittedVatRate)
        fd.append('kitchen_station_id', kitchenStationId)
        fd.append('image_url', imageUrl)
        if (description) fd.append('description', description)
        if (parentId) fd.append('parentId', parentId)
        const result = await createCategory(null, fd)
        if ('error' in result) { setError(result.error); return }
        onCreated?.({
          id: result.id,
          restaurant_id: restaurantId,
          name,
          description: description ?? null,
          image_url: imageUrl || null,
          position: 0,
          is_visible: true,
          parent_id: parentId ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          vat_rate: Number.isFinite(submittedVatNumber) ? submittedVatNumber : 10,
          kitchen_station_id: kitchenStationId || null,
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
      <div style={{ display: 'grid', gridTemplateColumns: imageUrl ? '56px 1fr' : '1fr', gap: 8, alignItems: 'center' }}>
        {imageUrl && <img src={imageUrl} alt="Kategori görseli" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />}
        <div style={{ display: 'flex', gap: 6 }}>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleImageUpload} hidden />
          <button className="category-form-action category-form-upload" type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} style={{ ...inputStyle, cursor: uploading ? 'not-allowed' : 'pointer', width: 'auto', flex: 1 }}>
            {uploading ? 'Yükleniyor…' : imageUrl ? 'Görseli değiştir' : 'Kategori görseli yükle'}
          </button>
          {imageUrl && <button type="button" onClick={() => setImageUrl('')} aria-label="Kategori görselini kaldır" style={{ width: 34, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>×</button>}
        </div>
      </div>
      <input
        type="text"
        placeholder="Açıklama (opsiyonel)"
        value={description ?? ''}
        onChange={(e) => setDescription(e.target.value || null)}
        style={inputStyle}
      />
      <div style={{ display: 'grid', gap: 5 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)' }}>Varsayılan KDV oranı</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 86px', gap: 5 }}>
          {VAT_PRESETS.map((rate) => {
            const active = Number(vatRate) === rate
            return (
              <button
                key={rate}
                type="button"
                onClick={() => setVatRate(String(rate))}
                style={{
                  height: 30,
                  borderRadius: 7,
                  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                  background: active ? 'var(--text)' : 'var(--surface)',
                  color: active ? 'var(--surface)' : 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                %{rate}
              </button>
            )
          })}
          <input
            aria-label="Özel KDV oranı"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            style={{ ...inputStyle, height: 30, textAlign: 'right', fontFamily: "'Geist Mono', monospace" }}
          />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)' }}>Varsayılan mutfak istasyonu</label>
        <select
          value={kitchenStationId}
          onChange={(e) => setKitchenStationId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Atanmamış</option>
          {kitchenStations.filter((station) => station.is_active).map((station) => (
            <option key={station.id} value={station.id}>{station.name}</option>
          ))}
        </select>
        {kitchenStations.length === 0 && (
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: 'var(--text-3)' }}>
            Henüz istasyon oluşturulmamış. <a href={`/dashboard/${restaurantId}/settings#kitchen-stations`} style={{ color: 'var(--text)', fontWeight: 700, textUnderlineOffset: 2 }}>Mutfak istasyonu oluştur</a>
          </p>
        )}
      </div>
      {error && (
        <p style={{ fontSize: 11.5, color: 'var(--critical)', margin: 0 }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          className="category-form-action category-form-submit"
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
          className="category-form-action category-form-cancel"
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
