'use client'

import { useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'

import { I } from '../../lib/ui'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { ChefSectionIcon, isChefSectionIconName } from '@garsonless/ui'
import type { SectionSettingField } from './theme-editor-properties-model'
import {
  getSectionSettingLabel,
  getVisibleSectionSettingFields,
  groupMenuItems,
  isPromoSliderFields,
  resolvePromoSliderSourceMode,
  resolveSectionSettingValue,
  sectionSettingControlId,
  togglePromoSliderCampaignSelection,
} from './theme-section-settings-model'

type MenuCategoryRef = { id: string; name: string }
type CampaignRef = {
  id: string
  title: string
  sourceLabel: string
  badge: string
  imageUrl?: string
}
type MenuItemRef = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  price?: number
  images?: unknown
  isAvailable?: boolean
}

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

export function SectionSettingsEditor({ fields, values, menuCategories, menuItems, campaignOptions = [], menuHref, onChange }: {
  fields: SectionSettingField[]
  values: Record<string, string>
  menuCategories: MenuCategoryRef[]
  menuItems: MenuItemRef[]
  campaignOptions?: CampaignRef[]
  menuHref?: string
  onChange: (key: string, value: string) => void
}) {
  const targetType = values.targetType || 'none'
  const promoSlider = isPromoSliderFields(fields)
  const visibleFields = getVisibleSectionSettingFields(fields, values)

  return (
    <div data-section-settings-editor style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        [data-section-settings-editor] .garsonless-section-option-tile:hover {
          border-color: var(--text-3) !important;
          background: var(--surface-2) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--text) 8%, transparent);
        }
        [data-section-settings-editor] .garsonless-section-option-tile[aria-checked="true"]:hover {
          border-color: var(--text) !important;
          background: var(--surface-3) !important;
        }
        [data-section-settings-editor] .garsonless-section-option-tile:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        [data-section-settings-editor] .garsonless-section-option-tile:active {
          transform: translateY(0) scale(.985);
        }
      `}</style>
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
        const isIconGrid = field.type === 'icon-grid'
        return (
          <div key={field.key} style={{ display: 'grid', gridTemplateColumns: isIconGrid ? '1fr' : '96px 1fr', alignItems: 'start', gap: isIconGrid ? 7 : 10, minHeight: 32 }}>
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
              campaignOptions={campaignOptions}
              {...(menuHref ? { menuHref } : {})}
              onChange={(value) => onChange(field.key, value)}
            />
          </div>
        )
      })}
    </div>
  )
}

function SectionSettingControl({ field, value, controlId, targetType, menuCategories = [], menuItems = [], campaignOptions = [], menuHref, onChange }: {
  field: SectionSettingField
  value: string
  controlId: string
  targetType?: string
  menuCategories?: MenuCategoryRef[]
  menuItems?: MenuItemRef[]
  campaignOptions?: CampaignRef[]
  menuHref?: string
  onChange: (value: string) => void
}) {
  if (field.type === 'campaign-multi-select') {
    const selectedIds = new Set(value.split(',').map((id) => id.trim()).filter(Boolean))
    const allSelected = selectedIds.size === 0
    const activeIds = campaignOptions.map((campaign) => campaign.id)
    const activeIdSet = new Set(activeIds)
    const staleSelectionCount = Array.from(selectedIds).filter((id) => !activeIdSet.has(id)).length
    const sourceCounts = campaignOptions.reduce<Record<string, number>>((counts, campaign) => {
      counts[campaign.sourceLabel] = (counts[campaign.sourceLabel] ?? 0) + 1
      return counts
    }, {})
    const sourceSummary = Object.entries(sourceCounts)
      .map(([label, count]) => `${label} ${count}`)
      .join(' · ')
    return (
      <div id={controlId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {campaignOptions.length === 0 ? (
          <div role="status" style={{ padding: '9px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.4 }}>
            Sayfa akışında süresi devam eden İndirim Rozeti, Günün Özeli veya Kombo Şerit kampanyası yok.
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-pressed={allSelected}
              onClick={() => onChange('')}
              style={campaignChoiceStyle(allSelected)}
            >
              <span style={{ width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center', background: allSelected ? 'var(--text)' : 'var(--surface-3)', color: allSelected ? 'var(--surface)' : 'var(--text-2)' }}><I.sparkles size={15} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 11.5, color: 'var(--text)' }}>Tüm aktif kampanyalar ({campaignOptions.length})</strong>
                <span style={{ display: 'block', marginTop: 2, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.35 }}>{sourceSummary}</span>
              </span>
              {allSelected && <span aria-hidden="true" style={{ color: 'var(--text)' }}><I.check size={14} /></span>}
            </button>
            {campaignOptions.map((campaign) => {
              const active = allSelected || selectedIds.has(campaign.id)
              return (
                <button
                  key={campaign.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onChange(togglePromoSliderCampaignSelection(value, campaign.id, activeIds))
                  }}
                  style={campaignChoiceStyle(active)}
                >
                  <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: 10, fontWeight: 800 }}>
                    {campaign.imageUrl ? <img src={campaign.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : campaign.sourceLabel.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--text)' }}>{campaign.title}</strong>
                    <span style={{ display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5, color: 'var(--text-3)' }}>{campaign.sourceLabel} · {campaign.badge}</span>
                  </span>
                  <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 6, display: 'grid', placeItems: 'center', border: active ? '1px solid var(--text)' : '1px solid var(--border-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: 'var(--surface)' }}>{active ? <I.check size={11} /> : null}</span>
                </button>
              )
            })}
          </>
        )}
        {staleSelectionCount > 0 && (
          <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '7px 8px', borderRadius: 8, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 10.5, lineHeight: 1.35 }}>
            <I.warn size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Süresi dolmuş veya kaldırılmış {staleSelectionCount} seçim artık slaytta gösterilmiyor. Yeni bir seçim yaptığınızda liste temizlenir.
          </div>
        )}
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.35 }}>
          Yalnız ürünü seçili, süresi devam eden ve fiyat kuralı geçerli kampanyalar sayılır. Ürün, fiyat ve bitiş bilgisi kendi bölümünden yönetilir.
        </div>
      </div>
    )
  }

  if (field.type === 'product-select') {
    const groups = groupMenuItems(menuItems)
    const selectedItem = menuItems.find((item) => item.id === value)
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
              {group.items.map((item) => (
                <option key={item.id} value={item.id} disabled={item.isAvailable === false}>
                  {productOptionLabel(item)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selectedItem && (
          <div style={{
            display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr) auto', alignItems: 'center', gap: 8,
            minHeight: 46, padding: 6, border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--surface-2)',
          }}>
            <ProductThumbnail item={selectedItem} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, lineHeight: 1.25, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedItem.name}
              </div>
              <div style={{ marginTop: 2, fontSize: 10.5, lineHeight: 1.2, color: selectedItem.isAvailable === false ? 'var(--danger)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedItem.categoryName}{selectedItem.isAvailable === false ? ' · Pasif' : ''}
              </div>
            </div>
            {typeof selectedItem.price === 'number' && Number.isFinite(selectedItem.price) && (
              <strong style={{ fontSize: 11.5, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {formatProductPrice(selectedItem.price)}
              </strong>
            )}
          </div>
        )}
        {value && !selectedItem && (
          <div role="status" style={{ fontSize: 11, color: 'var(--danger)', padding: '3px 1px' }}>
            Bu ürün artık menüde bulunmuyor. Yeni bir ürün seçin.
          </div>
        )}
        {value && menuHref && (
          <button type="button" style={{ ...menuLinkStyle, alignSelf: 'flex-start' }} onClick={() => window.open(menuHref, '_blank', 'noopener')}>
            Menüde düzenle <I.arrow size={11} />
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

  if (field.type === 'icon-grid') {
    return (
      <div id={controlId} role="radiogroup" aria-label={field.label} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
        {(field.options ?? []).map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className="garsonless-section-option-tile"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              onClick={() => onChange(option.value)}
              style={{
                minWidth: 0,
                minHeight: 58,
                padding: '7px 4px 6px',
                border: active ? '2px solid var(--text)' : '1px solid var(--border)',
                borderRadius: 9,
                background: active ? 'var(--surface-3)' : 'var(--surface)',
                color: active ? 'var(--text)' : 'var(--text-3)',
                display: 'grid',
                placeItems: 'center',
                gap: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color 120ms, background 120ms, color 120ms, transform 120ms',
              }}
            >
              <SectionOptionIcon value={option.value} />
              <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9.5, lineHeight: 1.15, fontWeight: 700 }}>
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
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
    const fallback = Number(field.default ?? field.min ?? 0)
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
      <select id={controlId} value={value || String(field.default ?? field.options?.[0]?.value ?? '')} onChange={(event) => onChange(event.target.value)} style={selectStyle(32, true)}>
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

  if (field.type === 'datetime') {
    return (
      <input
        id={controlId}
        type="datetime-local"
        step={60}
        value={toLocalDateTimeValue(value)}
        onChange={(event) => {
          if (!event.target.value) {
            onChange('')
            return
          }
          const date = new Date(event.target.value)
          onChange(Number.isFinite(date.getTime()) ? date.toISOString() : '')
        }}
        style={sectionInputStyle}
      />
    )
  }

  return <input id={controlId} type={field.type === 'url' ? 'url' : 'text'} value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} style={sectionInputStyle} />
}

function campaignChoiceStyle(active: boolean): CSSProperties {
  return {
    width: '100%', minWidth: 0, minHeight: 46, padding: 6,
    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
    border: active ? '1.5px solid var(--text)' : '1px solid var(--border)',
    borderRadius: 9, background: active ? 'var(--surface-3)' : 'var(--surface)',
    cursor: 'pointer', fontFamily: 'inherit',
  }
}

function toLocalDateTimeValue(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function ProductThumbnail({ item }: { item: MenuItemRef }) {
  const imageUrl = Array.isArray(item.images)
    ? item.images.find((image): image is string => typeof image === 'string' && image.length > 0)
    : undefined

  return (
    <div aria-hidden style={{
      width: 38, height: 38, borderRadius: 7, overflow: 'hidden', display: 'grid', placeItems: 'center',
      color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)',
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <I.image size={15} />
      )}
    </div>
  )
}

function productOptionLabel(item: MenuItemRef) {
  const price = typeof item.price === 'number' && Number.isFinite(item.price)
    ? ` · ${formatProductPrice(item.price)}`
    : ''
  return `${item.name}${price}${item.isAvailable === false ? ' · Pasif' : ''}`
}

function formatProductPrice(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)
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

function SectionOptionIcon({ value }: { value: string }) {
  if (isChefSectionIconName(value)) return <ChefSectionIcon name={value} width={20} height={20} />
  if (value === 'active') return <I.clock size={20} />
  if (value === 'mixed') return <I.sparkles size={20} />
  if (value === 'manual') return <I.page size={20} />
  if (value === 'dots') return <I.more size={20} />
  if (value === 'bars') return <I.layout size={20} />
  if (value === 'cover') return <I.image size={20} />
  if (value === 'contain') return <I.layout size={20} />
  if (value === 'top') return <VerticalPositionIcon direction="up" />
  if (value === 'center') return <I.layout size={20} />
  if (value === 'bottom') return <VerticalPositionIcon direction="down" />
  if (value === 'mosaic') return <GalleryLayoutIcon mode="mosaic" />
  if (value === 'grid') return <GalleryLayoutIcon mode="grid" />
  if (value === 'strip') return <GalleryLayoutIcon mode="strip" />
  if (value === '2' || value === '3') return <ColumnIcon columns={Number(value)} />
  if (value === 'cart') return <I.cart size={20} />
  if (value === 'bag') {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  }
  if (value === 'custom') return <I.image size={20} />
  return <I.plus size={20} />
}

function GalleryLayoutIcon({ mode }: { mode: 'mosaic' | 'grid' | 'strip' }) {
  if (mode === 'strip') {
    return <svg width="22" height="20" viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><rect x="1.5" y="4" width="14" height="12" rx="2"/><path d="M18 5.5h2.5v9H18"/></svg>
  }
  if (mode === 'mosaic') {
    return <svg width="22" height="20" viewBox="0 0 22 20" fill="currentColor" aria-hidden><rect x="1" y="2" width="12" height="16" rx="2"/><rect x="15" y="2" width="6" height="7" rx="1.5"/><rect x="15" y="11" width="6" height="7" rx="1.5"/></svg>
  }
  return <svg width="22" height="20" viewBox="0 0 22 20" fill="currentColor" aria-hidden><rect x="1" y="2" width="9" height="7" rx="1.5"/><rect x="12" y="2" width="9" height="7" rx="1.5"/><rect x="1" y="11" width="9" height="7" rx="1.5"/><rect x="12" y="11" width="9" height="7" rx="1.5"/></svg>
}

function VerticalPositionIcon({ direction }: { direction: 'up' | 'down' }) {
  const up = direction === 'up'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'm7 10 5-5 5 5' : 'm7 14 5 5 5-5'} />
      <path d={up ? 'M12 5v14' : 'M12 19V5'} />
    </svg>
  )
}

function selectStyle(height: number, hasValue: boolean): CSSProperties {
  return { width: '100%', height, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: hasValue ? 'var(--text)' : 'var(--text-3)', fontSize: 12.5, padding: '0 9px', cursor: 'pointer' }
}

const GALLERY_TILES: Array<{ id: string; key: string; label: string }> = [
  { id: 'tile1', key: 'tile1Image', label: '1' },
  { id: 'tile2', key: 'tile2Image', label: '2' },
  { id: 'tile3', key: 'tile3Image', label: '3' },
  { id: 'tile4', key: 'tile4Image', label: '4' },
  { id: 'tile5', key: 'tile5Image', label: '5' },
  { id: 'tile6', key: 'tile6Image', label: '6' },
]

export function SectionImageUploadPanel({ restaurantId, sectionId, label, value, onChange, mode = 'image' }: {
  restaurantId: string
  sectionId: string
  label: string
  value: string
  onChange: (value: string) => void
  mode?: 'image' | 'icon'
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const allowedTypes = mode === 'icon'
      ? ['image/svg+xml', 'image/png', 'image/webp']
      : ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError(mode === 'icon' ? 'SVG, PNG veya WEBP formatında bir ikon seçin.' : 'JPG, PNG veya WEBP formatında bir görsel seçin.')
      return
    }
    const maximumSize = mode === 'icon' ? 2 : 8
    if (file.size > maximumSize * 1024 * 1024) {
      setError(`${mode === 'icon' ? 'İkon' : 'Görsel'} en fazla ${maximumSize} MB olabilir.`)
      return
    }

    setUploading(true)
    setError(null)
    try {
      const supabase = createDashboardBrowserClient()
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' } as const)[file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml']
      const path = `restaurants/${restaurantId}/sections/${sectionId}-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('restaurant-assets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch {
      setError(`${mode === 'icon' ? 'İkon' : 'Görsel'} yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <input ref={inputRef} type="file" accept={mode === 'icon' ? 'image/svg+xml,image/png,image/webp' : 'image/jpeg,image/png,image/webp'} hidden onChange={handleUpload} />
      <div style={{
        minHeight: 116,
        border: `1px ${value ? 'solid' : 'dashed'} var(--border-strong)`,
        borderRadius: 10,
        background: 'var(--surface-2)',
        overflow: 'hidden',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
      }}>
        {value ? (
          <img src={value} alt={`${label} önizlemesi`} style={{ width: '100%', height: 116, objectFit: mode === 'icon' ? 'contain' : 'cover', padding: mode === 'icon' ? 20 : 0, display: 'block' }} />
        ) : (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)' }}>
            <I.image size={22} aria-hidden="true" />
            <div style={{ marginTop: 5, fontSize: 11.5, lineHeight: 1.4 }}>Henüz {mode === 'icon' ? 'ikon' : 'görsel'} yüklenmedi</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          style={{ ...uploadActionStyle, flex: 1, background: 'var(--text)', color: 'var(--surface)' }}
        >
          {uploading ? 'Yükleniyor…' : value ? `${mode === 'icon' ? 'İkonu' : 'Görseli'} değiştir` : `${mode === 'icon' ? 'İkon' : 'Görsel'} yükle`}
        </button>
        {value && (
          <button type="button" disabled={uploading} onClick={() => onChange('')} style={{ ...uploadActionStyle, background: 'var(--surface)', color: 'var(--text-2)' }}>
            Kaldır
          </button>
        )}
      </div>
      <p style={{ margin: '6px 0 0', color: error ? '#b42318' : 'var(--text-3)', fontSize: 10.5, lineHeight: 1.4 }} role={error ? 'alert' : undefined}>
        {error ?? (mode === 'icon' ? 'SVG, PNG veya WEBP · en fazla 2 MB' : 'JPG, PNG veya WEBP · en fazla 8 MB')}
      </p>
    </div>
  )
}

const SERVICE_REQUEST_ICON_UPLOADS = [
  { iconKey: 'waiterIcon', valueKey: 'waiterIconUrl', label: 'Garson çağır' },
  { iconKey: 'cleanTableIcon', valueKey: 'cleanTableIconUrl', label: 'Masa temizliği' },
  { iconKey: 'ashtrayIcon', valueKey: 'ashtrayIconUrl', label: 'Küllük değişimi' },
  { iconKey: 'tableServiceIcon', valueKey: 'tableServiceIconUrl', label: 'Servis isteği' },
  { iconKey: 'waterIcon', valueKey: 'waterIconUrl', label: 'Su isteği' },
  { iconKey: 'billIcon', valueKey: 'billIconUrl', label: 'Hesap isteği' },
] as const

export function ServiceRequestIconUploadPanels({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const activeUploads = SERVICE_REQUEST_ICON_UPLOADS.filter(({ iconKey }) => values[iconKey] === 'custom')

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
      <div style={{
        padding: '10px 11px', borderRadius: 9, border: '1px solid var(--border)',
        background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.5,
      }}>
        Her isteğin ikon seçicisinden <strong style={{ color: 'var(--text)' }}>Özel ikon</strong> seçebilirsiniz.
        İlgili SVG, PNG veya WEBP yükleme alanı burada açılır. <strong style={{ color: 'var(--text)' }}>İkonsuz</strong> seçeneği ise simgeyi kaldırır; buton hizasını korur.
      </div>
      {activeUploads.map(({ valueKey, label }) => (
        <div key={valueKey}>
          <div style={{ marginBottom: 7, fontSize: 11.5, fontWeight: 750, color: 'var(--text-2)' }}>{label} özel ikonu</div>
          <SectionImageUploadPanel
            restaurantId={restaurantId}
            sectionId={`request-buttons-${valueKey}`}
            label={`${label} özel ikonu`}
            value={values[valueKey] ?? ''}
            onChange={(value) => onChange(valueKey, value)}
            mode="icon"
          />
        </div>
      ))}
    </div>
  )
}

export function ChefPickIconUploadPanels({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const customChefIcon = values.chefIcon === 'custom'
  const customButtonIcon = values.ctaMode === 'custom' && values.buttonIcon === 'custom'
  if (!customChefIcon && !customButtonIcon) return null

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
      {customChefIcon && (
        <div>
          <div style={{ marginBottom: 7, fontSize: 11.5, fontWeight: 750, color: 'var(--text-2)' }}>Özel şef rozeti</div>
          <SectionImageUploadPanel
            restaurantId={restaurantId}
            sectionId="chef-pick-badge"
            label="Özel şef rozeti"
            value={values.chefIconUrl ?? ''}
            onChange={(value) => onChange('chefIconUrl', value)}
          />
        </div>
      )}
      {customButtonIcon && (
        <div>
          <div style={{ marginBottom: 7, fontSize: 11.5, fontWeight: 750, color: 'var(--text-2)' }}>Özel sepete ekle ikonu</div>
          <SectionImageUploadPanel
            restaurantId={restaurantId}
            sectionId="chef-pick-cta"
            label="Özel sepete ekle ikonu"
            value={values.buttonIconUrl ?? ''}
            onChange={(value) => onChange('buttonIconUrl', value)}
          />
        </div>
      )}
    </div>
  )
}

export function PromoSliderImageUploadPanel({ restaurantId, sectionId, values, onChange }: {
  restaurantId: string
  sectionId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const sourceMode = resolvePromoSliderSourceMode(values)
  const comboEnabled = values.comboEnabled !== 'false'
  if (sourceMode === 'active' || !comboEnabled) return null

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 7, fontSize: 11.5, fontWeight: 750, color: 'var(--text-2)' }}>Combo kartı görseli</div>
      <SectionImageUploadPanel
        restaurantId={restaurantId}
        sectionId={`${sectionId}-combo`}
        label="Combo kartı"
        value={values.comboImageUrl ?? ''}
        onChange={(value) => onChange('comboImageUrl', value)}
      />
      <p style={{ margin: '-2px 0 0', color: 'var(--text-3)', fontSize: 10.5, lineHeight: 1.4 }}>
        Görsel eklemezsen kartta emoji kullanılır. Yerleşim ve odak ayarlarını aşağıdan değiştirebilirsin.
      </p>
    </div>
  )
}

const uploadActionStyle: CSSProperties = {
  minHeight: 34,
  padding: '0 11px',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: 11.5,
  fontWeight: 750,
  cursor: 'pointer',
}

export function GalleryUploadPanel({ restaurantId, values, onChange }: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const requestedOrder = (values.tileOrder ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  const orderedIds = Array.from(new Set([
    ...requestedOrder.filter((id) => GALLERY_TILES.some((tile) => tile.id === id)),
    ...GALLERY_TILES.map((tile) => tile.id),
  ]))
  const orderedTiles = orderedIds
    .map((id) => GALLERY_TILES.find((tile) => tile.id === id))
    .filter((tile): tile is typeof GALLERY_TILES[number] => Boolean(tile))
  const photoCount = GALLERY_TILES.filter((tile) => Boolean(values[tile.key]?.trim())).length

  async function handleUpload(tileKey: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('JPG, PNG veya WEBP formatında bir görsel seçin.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Görsel en fazla 8 MB olabilir.')
      return
    }
    setUploading(tileKey)
    setError(null)
    try {
      const supabase = createDashboardBrowserClient()
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const)[file.type as 'image/jpeg' | 'image/png' | 'image/webp']
      const path = `restaurants/${restaurantId}/gallery/${tileKey}-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, {
        upsert: true,
        contentType: file.type,
      })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
      onChange(tileKey, data.publicUrl)
    } catch (uploadError) {
      console.error('[gallery-upload]', uploadError)
      setError('Görsel yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
    } finally {
      setUploading(null)
    }
  }

  function moveTile(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= orderedTiles.length) return
    const next = orderedTiles.map((tile) => tile.id)
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange('tileOrder', next.join(','))
  }

  return (
    <div data-gallery-upload-panel style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div>
          <strong style={{ display: 'block', fontSize: 12, color: 'var(--text)' }}>Galeri fotoğrafları</strong>
          <span style={{ display: 'block', marginTop: 2, fontSize: 10.5, color: 'var(--text-3)' }}>{photoCount} / 6 fotoğraf yüklendi</span>
        </div>
        <span style={{ padding: '5px 8px', borderRadius: 999, background: photoCount > 0 ? 'var(--success-bg)' : 'var(--surface-2)', color: photoCount > 0 ? 'var(--success)' : 'var(--text-3)', fontSize: 10.5, fontWeight: 750 }}>
          {photoCount > 0 ? 'Menüde görünür' : 'Galeri boş'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        {orderedTiles.map((tile, index) => {
          const imageUrl = values[tile.key] ?? ''
          const loading = uploading === tile.key
          return (
            <div key={tile.key} style={{ minHeight: 104, borderRadius: 10, overflow: 'hidden', position: 'relative', background: imageUrl ? 'transparent' : 'var(--surface-3)', border: `1px ${imageUrl ? 'solid' : 'dashed'} ${imageUrl ? 'var(--border)' : 'var(--border-strong)'}` }}>
              <input ref={(element) => { fileRefs.current[tile.key] = element }} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(event) => handleUpload(tile.key, event)} />
              <button type="button" aria-label={`Galeri karesi ${tile.label} ${imageUrl ? 'görselini değiştir' : 'görseli yükle'}`} disabled={loading} onClick={() => fileRefs.current[tile.key]?.click()} style={{ width: '100%', height: '100%', minHeight: 104, border: 'none', padding: 0, background: 'transparent', cursor: loading ? 'wait' : 'pointer', display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}>
                {imageUrl ? (
                  <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', minHeight: 104, objectFit: values.imageFit === 'contain' ? 'contain' : 'cover', objectPosition: values.imagePosition || 'center', display: 'block', background: 'var(--surface-3)' }} />
                ) : (
                  <span style={{ display: 'grid', justifyItems: 'center', gap: 5, color: 'var(--text-3)' }}>
                    <I.image size={19} />
                    <span style={{ fontSize: 10.5, fontWeight: 700 }}>{loading ? 'Yükleniyor…' : 'Fotoğraf yükle'}</span>
                  </span>
                )}
              </button>
              <span aria-hidden style={{ position: 'absolute', top: 6, left: 6, minWidth: 23, height: 23, padding: '0 6px', borderRadius: 999, display: 'grid', placeItems: 'center', color: imageUrl ? '#fff' : 'var(--text-2)', background: imageUrl ? 'rgba(0,0,0,.58)' : 'var(--surface)', boxShadow: '0 2px 8px rgba(0,0,0,.08)', fontSize: 10, fontWeight: 850 }}>{index + 1}</span>
              <div style={{ position: 'absolute', right: 5, bottom: 5, display: 'flex', gap: 3 }}>
                <button type="button" aria-label={`Galeri karesi ${index + 1} önceye taşı`} disabled={index === 0} onClick={() => moveTile(index, -1)} style={galleryMiniActionStyle(index === 0)}>←</button>
                <button type="button" aria-label={`Galeri karesi ${index + 1} sonraya taşı`} disabled={index === orderedTiles.length - 1} onClick={() => moveTile(index, 1)} style={galleryMiniActionStyle(index === orderedTiles.length - 1)}>→</button>
                {imageUrl && <button type="button" aria-label={`Galeri karesi ${tile.label} görselini kaldır`} onClick={() => onChange(tile.key, '')} style={{ ...galleryMiniActionStyle(false), color: '#fff', background: 'rgba(166,28,28,.82)' }}>✕</button>}
              </div>
            </div>
          )
        })}
      </div>
      <div role={error ? 'alert' : undefined} style={{ display: 'grid', gap: 2, color: error ? 'var(--danger)' : 'var(--text-3)', fontSize: 10.5, lineHeight: 1.45 }}>
        {error ? (
          <span>{error}</span>
        ) : (
          <>
            <span>Önerilen: 1600 × 1200 px (4:3) · minimum 1200 × 900 px</span>
            <span>JPG, PNG veya WEBP · en fazla 8 MB · oklarla sıralayabilirsin</span>
          </>
        )}
      </div>
    </div>
  )
}

function galleryMiniActionStyle(disabled: boolean): CSSProperties {
  return {
    width: 24,
    height: 24,
    padding: 0,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(255,255,255,.22)',
    borderRadius: 7,
    background: disabled ? 'rgba(0,0,0,.24)' : 'rgba(0,0,0,.62)',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 11,
    fontWeight: 850,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
}
