'use client'

import { useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'

import { I } from '../../lib/ui'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type { SectionSettingField } from './theme-editor-properties-model'
import {
  getSectionSettingLabel,
  getVisibleSectionSettingFields,
  groupMenuItems,
  isPromoSliderFields,
  resolveSectionSettingValue,
  sectionSettingControlId,
} from './theme-section-settings-model'

type MenuCategoryRef = { id: string; name: string }
type MenuItemRef = { id: string; name: string; categoryId: string; categoryName: string }

const sectionInputStyle: CSSProperties = {
  width: '100%', minWidth: 0, height: 32, borderRadius: 7,
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 12.5, padding: '0 9px', outline: 'none',
}

const menuLinkStyle = {
  fontSize: 11.5, color: 'var(--text-2)', background: 'none', border: 'none',
  padding: 0, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: 3,
} as const

export function SectionSettingsEditor({ fields, values, menuCategories, menuItems, menuHref, onChange }: {
  fields: SectionSettingField[]
  values: Record<string, string>
  menuCategories: MenuCategoryRef[]
  menuItems: MenuItemRef[]
  menuHref?: string
  onChange: (key: string, value: string) => void
}) {
  const targetType = values.targetType || 'none'
  const promoSlider = isPromoSliderFields(fields)
  const visibleFields = getVisibleSectionSettingFields(fields, values)

  return (
    <div data-section-settings-editor style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {visibleFields.map((field) => {
        if (field.type === 'heading') {
          return (
            <div key={field.key} style={{
              marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border-strong)',
              fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--text-3)',
              textTransform: 'uppercase',
            }}>{field.label}</div>
          )
        }
        const controlId = sectionSettingControlId(field.key)
        return (
          <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', alignItems: 'start', gap: 10, minHeight: 32 }}>
            <label htmlFor={controlId} style={{ paddingTop: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
              {getSectionSettingLabel(field, targetType)}
            </label>
            <SectionSettingControl
              field={field}
              value={resolveSectionSettingValue(field, values, promoSlider)}
              controlId={controlId}
              targetType={targetType}
              menuCategories={menuCategories}
              menuItems={menuItems}
              {...(menuHref ? { menuHref } : {})}
              onChange={(value) => onChange(field.key, value)}
            />
          </div>
        )
      })}
    </div>
  )
}

function SectionSettingControl({ field, value, controlId, targetType, menuCategories = [], menuItems = [], menuHref, onChange }: {
  field: SectionSettingField
  value: string
  controlId: string
  targetType?: string
  menuCategories?: MenuCategoryRef[]
  menuItems?: MenuItemRef[]
  menuHref?: string
  onChange: (value: string) => void
}) {
  if (field.type === 'product-select') {
    const groups = groupMenuItems(menuItems)
    if (menuItems.length === 0 && menuHref) {
      return (
        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
          Henüz ürün yok —{' '}
          <button type="button" style={menuLinkStyle} onClick={() => window.open(menuHref, '_blank', 'noopener')}>
            Menü&apos;den ekle <I.arrow size={11} />
          </button>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <select id={controlId} value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle(36, Boolean(value))}>
          <option value="">— Ürün seç —</option>
          {groups.map((group) => (
            <optgroup key={group.categoryName} label={group.categoryName}>
              {group.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </optgroup>
          ))}
        </select>
        {value && menuHref && (
          <button type="button" style={{ ...menuLinkStyle, alignSelf: 'flex-start' }} onClick={() => window.open(menuHref, '_blank', 'noopener')}>
            Düzenle <I.arrow size={11} />
          </button>
        )}
      </div>
    )
  }

  if (field.type === 'category-select') {
    return (
      <select id={controlId} value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle(36, Boolean(value))}>
        <option value="">— Kategori seç —</option>
        {menuCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
    )
  }

  if (field.key === 'targetId' && (targetType === 'category' || targetType === 'product')) {
    const options = targetType === 'category'
      ? menuCategories.map((category) => ({ value: category.id, label: category.name, meta: 'Kategori' }))
      : menuItems.map((item) => ({ value: item.id, label: item.name, meta: item.categoryName }))
    return (
      <select id={controlId} value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle(32, Boolean(value))}>
        <option value="">{targetType === 'category' ? 'Kategori seç' : 'Ürün seç'}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.meta}</option>)}
      </select>
    )
  }

  if (field.type === 'color') {
    const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : field.placeholder || '#000000'
    return (
      <div style={{ height: 32, display: 'flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden', background: 'var(--surface)' }}>
        <input aria-label={`${field.label} renk seçici`} type="color" value={colorValue} onChange={(event) => onChange(event.target.value)} style={{ width: 34, height: 32, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }} />
        <input id={controlId} type="text" value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} style={sectionInputStyle} />
      </div>
    )
  }

  if (field.type === 'range' && field.key === 'cols') {
    return <TileOptions controlId={controlId} value={value || '2'} options={['1', '2', '3']} onChange={onChange} render={(option) => <ColumnIcon columns={Number(option)} />} />
  }

  if (field.type === 'range') {
    const fallback = field.min ?? 0
    const numeric = Number(value)
    const numericValue = Number.isFinite(numeric) ? numeric : fallback
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32 }}>
        <input id={controlId} type="range" min={field.min} max={field.max} step={field.step} value={numericValue} onChange={(event) => onChange(event.target.value)} style={{ flex: 1, accentColor: 'var(--text)' }} />
        <output htmlFor={controlId} style={{ minWidth: 50, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', color: 'var(--text-2)', fontSize: 12 }}>
          {numericValue}{field.unit ?? ''}
        </output>
      </div>
    )
  }

  if (field.type === 'select' && field.key === 'logoShape') {
    return <TileOptions controlId={controlId} value={value || 'rounded'} options={['square', 'rounded', 'circle']} onChange={onChange} render={(option) => <ShapeIcon shape={option} />} />
  }

  if (field.type === 'select') {
    return (
      <select id={controlId} value={value || field.options?.[0]?.value || ''} onChange={(event) => onChange(event.target.value)} style={selectStyle(32, true)}>
        {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    )
  }

  if (field.type === 'toggle') {
    const checked = value === 'true'
    return (
      <button type="button" id={controlId} role="switch" aria-checked={checked} aria-label={field.label} onClick={() => onChange(checked ? 'false' : 'true')} style={{
        width: 38, height: 22, justifySelf: 'start', borderRadius: 999, border: 'none',
        background: checked ? 'var(--text)' : 'var(--surface-3)', position: 'relative', cursor: 'pointer',
      }}>
        <span aria-hidden style={{ position: 'absolute', top: 3, left: checked ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left 150ms' }} />
      </button>
    )
  }

  if (field.type === 'textarea') {
    return <textarea id={controlId} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} rows={3} style={{ ...sectionInputStyle, height: 70, paddingTop: 8, resize: 'vertical', lineHeight: 1.35 }} />
  }

  return <input id={controlId} type={field.type === 'url' ? 'url' : 'text'} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} style={sectionInputStyle} />
}

function TileOptions({ controlId, value, options, onChange, render }: {
  controlId: string
  value: string
  options: string[]
  onChange: (value: string) => void
  render: (value: string) => React.ReactNode
}) {
  return (
    <div id={controlId} role="group" style={{ display: 'flex', gap: 6 }}>
      {options.map((option) => {
        const active = value === option
        return (
          <button key={option} type="button" aria-pressed={active} onClick={() => onChange(option)} style={{
            flex: 1, height: 44, border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
            borderRadius: 9, background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: active ? 'var(--accent)' : 'var(--text-3)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', transition: 'border-color 120ms, background 120ms, color 120ms',
          }}>{render(option)}</button>
        )
      })}
    </div>
  )
}

function ColumnIcon({ columns }: { columns: number }) {
  return <svg width="28" height="22" viewBox="0 0 28 22" fill="currentColor" aria-hidden>{Array.from({ length: columns }, (_, index) => <rect key={index} x={2 + index * (24 / columns)} y="3" width={(22 / columns)} height="16" rx="2" opacity=".85" />)}</svg>
}

function ShapeIcon({ shape }: { shape: string }) {
  const radius = shape === 'square' ? 2 : shape === 'circle' ? 18 : 8
  return <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" aria-hidden><rect x="4" y="4" width="20" height="20" rx={radius} opacity=".85" /></svg>
}

function selectStyle(height: number, hasValue: boolean): CSSProperties {
  return { width: '100%', height, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: hasValue ? 'var(--text)' : 'var(--text-3)', fontSize: 12.5, padding: '0 9px', cursor: 'pointer' }
}

const GALLERY_TILES: Array<{ key: string; label: string; span: 1 | 2 }> = [
  { key: 'tile1Image', label: '1', span: 2 }, { key: 'tile2Image', label: '2', span: 1 },
  { key: 'tile3Image', label: '3', span: 1 }, { key: 'tile4Image', label: '4', span: 1 },
  { key: 'tile5Image', label: '5', span: 1 }, { key: 'tile6Image', label: '6', span: 1 },
]

export function GalleryUploadPanel({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleUpload(tileKey: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setUploading(tileKey)
    const supabase = createDashboardBrowserClient()
    const extension = file.name.split('.').pop() ?? 'jpg'
    const path = `restaurants/${restaurantId}/gallery/${tileKey}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
      onChange(tileKey, data.publicUrl)
    }
    setUploading(null)
  }

  return (
    <div data-gallery-upload-panel style={{ marginBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridAutoRows: 64, gap: 6, marginBottom: 8 }}>
        {GALLERY_TILES.map((tile) => {
          const imageUrl = values[tile.key] ?? ''
          const loading = uploading === tile.key
          return (
            <div key={tile.key} style={{ gridColumn: tile.span === 2 ? 'span 2' : 'auto', borderRadius: 8, overflow: 'hidden', position: 'relative', background: imageUrl ? 'transparent' : 'var(--surface-3)', border: `1.5px dashed ${imageUrl ? 'transparent' : 'var(--border)'}` }}>
              <input ref={(element) => { fileRefs.current[tile.key] = element }} type="file" accept="image/*" style={{ display: 'none' }} onChange={(event) => handleUpload(tile.key, event)} />
              <button type="button" aria-label={`Galeri karesi ${tile.label} ${imageUrl ? 'görselini değiştir' : 'görseli yükle'}`} disabled={loading} onClick={() => fileRefs.current[tile.key]?.click()} style={{ width: '100%', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: loading ? 'wait' : 'pointer', display: 'grid', placeItems: 'center' }}>
                {imageUrl ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span style={{ fontSize: loading ? 10 : 18, color: 'var(--text-3)' }}>{loading ? '…' : '+'}</span>}
              </button>
              {imageUrl && <button type="button" aria-label={`Galeri karesi ${tile.label} görselini kaldır`} onClick={() => onChange(tile.key, '')} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 99, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 900 }}>✕</button>}
            </div>
          )
        })}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>Her kareye tıklayarak fotoğraf yükle · JPG, PNG, WEBP</p>
    </div>
  )
}
