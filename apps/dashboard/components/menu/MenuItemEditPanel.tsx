'use client'

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { Tables } from '@garsonless/db/types'
import type { MenuModifierGroup as ModifierGroup } from '@garsonless/db/browser'
import { calculateMarginPercent } from '@garsonless/domain/menu'
import { InlineSpinner } from '@garsonless/ui'
import { deleteItem, updateItem } from '../../lib/actions/menu'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { I, S, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import NutritionFields, {
  appendNutritionToFormData,
  applyNutritionPatch,
  nutritionFromItem,
  NutritionStatusPill,
  type NutritionState,
} from './NutritionFields'
import { MenuConfirmDialog } from './MenuConfirmDialog'
import { isMenuItemEditorDirty, type MenuItemEditorSnapshot } from './menu-item-editor-model'
import { MenuItemEditorFrame } from './MenuItemEditorFrame'
import { MenuModifierGroupEditor } from './MenuModifierGroupEditor'
import { normalizeGroups, tintFor } from './menu-manager-utils'

const VAT_RATE_PRESETS = [1, 10, 20]

/* ============================================================
   ITEM EDIT PANEL
   ============================================================ */
export function MenuItemEditPanel({
  item,
  categoryName,
  categoryVatRate,
  categoryStationId,
  kitchenStations,
  restaurantId,
  onClose,
  onSaved,
  onDeleted,
  onError,
  onDirtyChange,
}: {
  item: Tables<'menu_items'>
  categoryName: string
  categoryVatRate: number
  categoryStationId: string | null
  kitchenStations: Tables<'kitchen_stations'>[]
  restaurantId: string
  onClose: () => void
  onSaved: (updated: Tables<'menu_items'>) => void
  onDeleted: (id: string) => void
  onError: (msg: string) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [vatMode, setVatMode] = useState<'category' | 'custom'>(item.vat_rate == null ? 'category' : 'custom')
  const [vatRate, setVatRate] = useState(String(item.vat_rate ?? categoryVatRate))
  const [stationMode, setStationMode] = useState<'category' | 'custom'>(item.kitchen_station_id == null ? 'category' : 'custom')
  const [kitchenStationId, setKitchenStationId] = useState(item.kitchen_station_id ?? categoryStationId ?? '')
  const [isAvailable, setIsAvailable] = useState(item.is_available)
  const [earnsStamp, setEarnsStamp] = useState<boolean>(item.earns_stamp ?? false)
  const [nutri, setNutri] = useState<NutritionState>(() => nutritionFromItem(item))
  const setN = (patch: Partial<NutritionState>) => setNutri((current) => applyNutritionPatch(current, patch))
  const [cost, setCost] = useState(item.cost == null ? '' : String(item.cost))
  const [images, setImages] = useState<string[]>(() =>
    Array.isArray(item.images) ? (item.images as string[]) : [],
  )
  const [modifiers, setModifiers] = useState<ModifierGroup[]>(() => normalizeGroups(item.modifier_groups))
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const tint = tintFor(item.id)
  const marginPercent = calculateMarginPercent(
    Number(price),
    cost.trim() === '' ? null : Number(cost),
  )
  const initialSnapshot: MenuItemEditorSnapshot = {
    name: item.name,
    description: item.description ?? '',
    price: String(item.price),
    cost: item.cost == null ? '' : String(item.cost),
    vatMode: item.vat_rate == null ? 'category' : 'custom',
    vatRate: String(item.vat_rate ?? categoryVatRate),
    stationMode: item.kitchen_station_id == null ? 'category' : 'custom',
    kitchenStationId: item.kitchen_station_id ?? categoryStationId ?? '',
    isAvailable: item.is_available,
    earnsStamp: item.earns_stamp ?? false,
    nutrition: nutritionFromItem(item),
    images: Array.isArray(item.images) ? item.images : [],
    modifiers: normalizeGroups(item.modifier_groups),
  }
  const isDirty = isMenuItemEditorDirty({
    name,
    description,
    price,
    cost,
    vatMode,
    vatRate,
    stationMode,
    kitchenStationId,
    isAvailable,
    earnsStamp,
    nutrition: nutri,
    images,
    modifiers,
  }, initialSnapshot)

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => onDirtyChange(false)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const prevImages = images
    setUploading(true)
    const supabase = createDashboardBrowserClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `restaurants/${restaurantId}/items/${item.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, { upsert: true })
    if (uploadError) {
      setUploading(false)
      onError(uploadError.message)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
    const newImages = [publicUrl, ...prevImages.slice(1)]
    setImages(newImages)
    setUploading(false)
    const fd = new FormData()
    fd.append('id', item.id)
    fd.append('restaurantId', restaurantId)
    fd.append('images', JSON.stringify(newImages))
    const result = await updateItem(fd)
    if ('error' in result) {
      setImages(prevImages)
      onError(result.error)
    } else {
      onSaved(result.item)
    }
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append('id', item.id)
      fd.append('restaurantId', restaurantId)
      fd.append('name', name)
      fd.append('description', description)
      fd.append('price', price)
      fd.append('vat_rate', vatMode === 'category' ? '' : vatRate)
      fd.append('kitchen_station_id', stationMode === 'category' ? '' : kitchenStationId)
      fd.append('is_available', String(isAvailable))
      fd.append('earns_stamp', String(earnsStamp))
      appendNutritionToFormData(fd, nutri)
      fd.append('cost', cost)
      fd.append('images', JSON.stringify(images))
      fd.append('modifier_groups', JSON.stringify(modifiers))
      const result = await updateItem(fd)
      if ('error' in result) { onError(result.error); return }
      onSaved(result.item)
    })
  }

  function handleDelete() {
    setDeleteConfirmOpen(true)
  }

  function confirmDelete() {
    setDeleting(true)
    startTransition(async () => {
      const result = await deleteItem(item.id, restaurantId)
      if ('error' in result) {
        setDeleting(false)
        onError(result.error)
        return
      }
      setDeleteConfirmOpen(false)
      onDeleted(item.id)
    })
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '6px 10px',
    background: 'var(--surface-2)', border: '1px solid var(--divider)',
    borderRadius: 6, fontSize: 12.5, color: 'var(--text)', outline: 'none',
  }

  const mainImage = images[0] ?? null

  return (
    <MenuItemEditorFrame
      itemId={item.id}
      itemName={item.name}
      position={item.position}
      createdAt={item.created_at}
      updatedAt={item.updated_at}
      tint={tint}
      onClose={onClose}
      footer={(
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <NutritionStatusPill s={nutri} />
              {isDirty && <Tag tone="warning">Kaydedilmemiş değişiklik</Tag>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="menu-item-footer-action menu-item-delete-action"
              type="button"
              onClick={handleDelete}
              disabled={deleting || isPending}
              style={{ ...btnGhost({ color: 'var(--critical)', borderColor: 'var(--critical-bg)' }), flex: 1, justifyContent: 'center' }}
            >
              <I.trash size={13} />Sil
            </button>
            <button
              className="menu-item-footer-action menu-item-save-action"
              type="button"
              onClick={handleSave}
              disabled={isPending || uploading || !isDirty}
              style={{ ...btnPrimary(), flex: 2, justifyContent: 'center', opacity: !isDirty ? 0.5 : 1 }}
            >
              {isPending ? <><InlineSpinner size={13} color="var(--on-action)" />Kaydediliyor…</> : 'Değişiklikleri kaydet'}
            </button>
          </div>
        </>
      )}
      overlay={deleteConfirmOpen ? (
        <MenuConfirmDialog
          title="Ürün silinsin mi?"
          message={`"${item.name}" ürünü menüden kaldırılacak. Bu işlem geri alınamaz.`}
          confirmLabel="Ürünü sil"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => {
            if (!deleting) setDeleteConfirmOpen(false)
          }}
        />
      ) : null}
    >
        {/* Image */}
        <div style={{ padding: 16 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <div style={{
            aspectRatio: '4/3', borderRadius: 10, background: tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(17,17,19,.34)',
            position: 'relative', overflow: 'hidden',
          }}>
            {mainImage
              ? <img src={mainImage} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <I.cutlery size={58} />}
            {uploading && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(17,17,19,.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <InlineSpinner size={22} color="#fff" />
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 4 }}>
              {mainImage && !uploading && (
                <button
                  className="menu-item-image-action menu-item-image-remove"
                  type="button"
                  onClick={async () => {
                    const prev = images
                    setImages([])
                    const fd = new FormData()
                    fd.append('id', item.id)
                    fd.append('restaurantId', restaurantId)
                    fd.append('images', JSON.stringify([]))
                    const result = await updateItem(fd)
                    if ('error' in result) { setImages(prev); onError(result.error) }
                    else onSaved(result.item)
                  }}
                  style={{
                    background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(6px)',
                    border: 'none', borderRadius: 6, padding: '5px 8px',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--critical)',
                  }}
                >
                  <I.trash size={12} />
                </button>
              )}
              <button
                className="menu-item-image-action"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(6px)',
                  border: 'none', borderRadius: 6, padding: '5px 10px',
                  fontSize: 11, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text)',
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                <I.image size={12} />{uploading ? 'Yükleniyor…' : 'Görsel değiştir'}
              </button>
            </div>
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {images.slice(1).map((url, i) => (
                <div key={i} style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Genel */}
        <PanelSection title="Genel">
          <FieldRow label="Ad">
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </FieldRow>
          <FieldRow label="Açıklama">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
            />
          </FieldRow>
          <FieldRow label="Kategori">
            <span style={{
              display: 'inline-flex', padding: '3px 9px', background: 'var(--accent-soft)',
              color: 'var(--accent)', borderRadius: 6, fontSize: 12, fontWeight: 500,
            }}>{categoryName}</span>
          </FieldRow>
          <FieldRow label="İstasyon">
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  type="button"
                  aria-pressed={stationMode === 'category'}
                  onClick={() => setStationMode('category')}
                  style={{
                    height: 32,
                    borderRadius: 7,
                    border: `1px solid ${stationMode === 'category' ? 'var(--text)' : 'var(--border)'}`,
                    background: stationMode === 'category' ? 'var(--text)' : 'var(--surface)',
                    color: stationMode === 'category' ? 'var(--surface)' : 'var(--text-2)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Kategori
                </button>
                <button
                  type="button"
                  aria-pressed={stationMode === 'custom'}
                  onClick={() => setStationMode('custom')}
                  style={{
                    height: 32,
                    borderRadius: 7,
                    border: `1px solid ${stationMode === 'custom' ? 'var(--text)' : 'var(--border)'}`,
                    background: stationMode === 'custom' ? 'var(--text)' : 'var(--surface)',
                    color: stationMode === 'custom' ? 'var(--surface)' : 'var(--text-2)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Özel
                </button>
              </div>
              {stationMode === 'custom' ? (
                <div>
                  <select value={kitchenStationId} onChange={e => setKitchenStationId(e.target.value)} style={inputStyle}>
                    <option value="">Atanmamış</option>
                    {kitchenStations.filter((station) => station.is_active).map((station) => (
                      <option key={station.id} value={station.id}>{station.name}</option>
                    ))}
                  </select>
                  {kitchenStations.length === 0 && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>Henüz istasyon yok. <a href={`/dashboard/${restaurantId}/settings#kitchen-stations`} style={{ color: 'var(--text)', fontWeight: 700 }}>İstasyon oluştur</a></div>}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.4 }}>
                  {categoryStationId
                    ? `Kategori varsayılanı: ${kitchenStations.find((station) => station.id === categoryStationId)?.name ?? 'Atanmamış'}`
                    : 'Kategori için varsayılan istasyon yok; sipariş Atanmamış görünür.'}
                </div>
              )}
            </div>
          </FieldRow>
        </PanelSection>

        {/* Fiyatlandırma */}
        <PanelSection title="Fiyatlandırma">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FieldInline label="Satış fiyatı">
              <input
                type="number" value={price} onChange={e => setPrice(e.target.value)}
                style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}
              />
            </FieldInline>
            <FieldInline label="Maliyet">
              <input
                type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="—"
                style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace" }}
              />
            </FieldInline>
          </div>
          {marginPercent !== null && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--accent-soft)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>Kâr marjı</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>%{marginPercent}</span>
            </div>
          )}
          <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>KDV oranı</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  Fiyatlar müşteriye KDV dahil görünür.
                </div>
              </div>
              <span style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-3)' }}>
                Etkin %{vatMode === 'category' ? categoryVatRate : (Number(vatRate) || 0)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
              <button
                type="button"
                aria-pressed={vatMode === 'category'}
                onClick={() => setVatMode('category')}
                style={{
                  height: 32,
                  borderRadius: 7,
                  border: `1px solid ${vatMode === 'category' ? 'var(--text)' : 'var(--border)'}`,
                  background: vatMode === 'category' ? 'var(--text)' : 'var(--surface)',
                  color: vatMode === 'category' ? 'var(--surface)' : 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Kategori oranı (%{categoryVatRate})
              </button>
              <button
                type="button"
                aria-pressed={vatMode === 'custom'}
                onClick={() => setVatMode('custom')}
                style={{
                  height: 32,
                  borderRadius: 7,
                  border: `1px solid ${vatMode === 'custom' ? 'var(--text)' : 'var(--border)'}`,
                  background: vatMode === 'custom' ? 'var(--text)' : 'var(--surface)',
                  color: vatMode === 'custom' ? 'var(--surface)' : 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Özel oran
              </button>
            </div>
            {vatMode === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 76px', gap: 6, marginTop: 8 }}>
                {VAT_RATE_PRESETS.map((rate) => {
                  const active = Number(vatRate) === rate
                  return (
                    <button
                      key={rate}
                      type="button"
                      aria-pressed={active}
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
                  aria-label="Özel ürün KDV oranı"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vatRate}
                  onChange={e => setVatRate(e.target.value)}
                  style={{ ...inputStyle, height: 30, textAlign: 'right', fontFamily: "'Geist Mono', monospace" }}
                />
              </div>
            )}
          </div>
        </PanelSection>

        {/* İçindekiler · Alerjenler · Özel içerik · Kontrol */}
        <NutritionFields s={nutri} set={setN} />

        {/* Varyantlar */}
        <PanelSection title="Varyantlar">
          <MenuModifierGroupEditor groups={modifiers} onChange={(next) => { setModifiers(next); setN({ reviewed: false }) }} />
        </PanelSection>

        {/* Görünürlük */}
        <PanelSection title="Görünürlük">
          <FieldRow label="Yayında">
            <button
              type="button"
              role="switch"
              aria-checked={isAvailable}
              onClick={() => setIsAvailable(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px',
                background: isAvailable ? 'var(--positive-bg)' : 'var(--surface-3)',
                color: isAvailable ? 'var(--positive)' : 'var(--text-3)',
                border: 'none', borderRadius: 999, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: isAvailable ? 'var(--positive)' : 'var(--text-3)', display: 'inline-block' }} />
              {isAvailable ? 'Açık' : 'Kapalı'}
            </button>
          </FieldRow>
        </PanelSection>

        <PanelSection title="Sadakat">
          <FieldRow label="Damga kazandırır">
            <button
              type="button"
              role="switch"
              aria-checked={earnsStamp}
              onClick={() => setEarnsStamp(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px',
                background: earnsStamp ? 'var(--positive-bg)' : 'var(--surface-3)',
                color: earnsStamp ? 'var(--positive)' : 'var(--text-3)',
                border: 'none', borderRadius: 999, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: earnsStamp ? 'var(--positive)' : 'var(--text-3)', display: 'inline-block' }} />
              {earnsStamp ? 'Evet' : 'Hayır'}
            </button>
          </FieldRow>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '6px 16px 0', lineHeight: 1.4 }}>
            Bu ürün sadakat damgası kazandırır (ör. kahve). Her adet bir damga sayılır.
          </p>
        </PanelSection>
    </MenuItemEditorFrame>
  )
}
function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ ...S.label, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', width: 80, flexShrink: 0, paddingTop: 6 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function FieldInline({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}
