'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingField } from '@garsonless/ui'

import { I } from '../../lib/ui'
import {
  contrastRatio,
  deriveSoftColor,
  resolveCartTriggerPatch,
  sanitizePropertyControlId,
} from './theme-property-renderer-model'

const HEADER_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: 'Görünüm', ids: ['headerLogoStyle', 'headerNameSize', 'headerLogoSize', 'logoShape', 'logoBg', 'logoShadow', 'logoBorder', 'headerStyle'] },
  { title: 'Yerleşim', ids: ['headerLayout', 'headerAlign', 'stickyHeader', 'headerHeight'] },
  { title: 'Boşluk ve çizgi', ids: ['headerPadY', 'headerBottomGap', 'headerBorder'] },
  { title: 'Görünür öğeler', ids: ['headerShowMenu', 'headerTableBadge', 'headerShowBill'] },
  { title: 'İçerik', ids: ['headerTagline'] },
]

const HEADER_CONTROL_CSS = `
  [data-modern-property-panel] .header-modern-range {
    width: 100%; height: 20px; margin: 0; appearance: none; -webkit-appearance: none;
    background: transparent; cursor: pointer;
  }
  [data-modern-property-panel] .header-modern-range::-webkit-slider-runnable-track {
    height: 4px; border-radius: 999px; background: #dedfe2;
  }
  [data-modern-property-panel] .header-modern-range::-webkit-slider-thumb {
    appearance: none; -webkit-appearance: none; width: 16px; height: 16px;
    margin-top: -6px; border: 3px solid #fff; border-radius: 50%;
    background: #111318; box-shadow: 0 1px 4px rgba(17,19,24,.28);
  }
  [data-modern-property-panel] .header-modern-range::-moz-range-track {
    height: 4px; border-radius: 999px; background: #dedfe2;
  }
  [data-modern-property-panel] .header-modern-range::-moz-range-thumb {
    width: 12px; height: 12px; border: 3px solid #fff; border-radius: 50%;
    background: #111318; box-shadow: 0 1px 4px rgba(17,19,24,.28);
  }
  [data-modern-property-panel] .header-modern-range:focus-visible {
    outline: 2px solid #111318; outline-offset: 3px; border-radius: 999px;
  }
`

function HeaderPropertyPanel({ fields, getValue, onChange }: {
  fields: SettingField[]
  getValue: (field: SettingField) => unknown
  onChange: (field: SettingField, value: unknown) => void
}) {
  return (
    <div data-header-property-panel data-modern-property-panel style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{HEADER_CONTROL_CSS}</style>
      {HEADER_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids
          .map((id) => fields.find((field) => field.id === id))
          .filter((field): field is SettingField => Boolean(field))
        if (sectionFields.length === 0) return null
        return (
          <div key={section.title} style={{
            padding: 14,
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--surface)',
            boxShadow: '0 1px 2px rgba(20,25,31,.03)',
          }}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>
              {section.title}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {sectionFields.map((field) => (
                <HeaderPropertyField
                  key={field.id}
                  field={field}
                  value={getValue(field)}
                  onChange={(value) => onChange(field, value)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const CARD_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: 'Kart yüzeyi', ids: ['radius', 'shadow', 'border', 'cardHover', 'cardPlaceholderStyle'] },
  { title: 'Aksiyon', ids: ['cardCtaStyle', 'cardCtaIcon'] },
  { title: 'Kart düzeni', ids: ['cardLayout', 'cardColumns', 'cardDensity', 'cardPriceAlign'] },
  { title: 'Görsel', ids: ['cardImageAspect', 'cardImageFit', 'cardImagePosition', 'cardHorizontalImageWidth'] },
  { title: 'İçerik', ids: ['cardShowImage', 'cardShowDesc', 'cardShowTag', 'cardTitleLines', 'cardDescriptionLines'] },
]

function CardPropertyPanel({ fields, layout, getValue, onChange }: {
  fields: SettingField[]
  layout: GarsonlessTheme['cardLayout']
  getValue: (field: SettingField) => unknown
  onChange: (field: SettingField, value: unknown) => void
}) {
  return (
    <div data-card-property-panel data-modern-property-panel style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{HEADER_CONTROL_CSS}</style>
      {layout === 'minimal' && (
        <div role="note" style={{ padding: '10px 12px', borderRadius: 10, background: '#f3f4f6', color: '#4b4f58', fontSize: 11.5, lineHeight: 1.45 }}>
          Minimal düzende ürün görseli ve hızlı ekleme aksiyonu kullanılmaz.
        </div>
      )}
      {CARD_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids.map((id) => fields.find((field) => field.id === id)).filter((field): field is SettingField => Boolean(field))
        if (sectionFields.length === 0) return null
        return (
          <div key={section.title} style={{ padding: 14, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,25,31,.03)' }}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{section.title}</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {sectionFields.map((field) => (
                <div key={field.id}>
                  <HeaderPropertyField field={field} value={getValue(field)} onChange={(value) => onChange(field, value)} />
                  {field.id === 'cardShowDesc' && <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-3)' }}>Yalnız açıklaması olan ürünlerde görünür.</div>}
                  {field.id === 'cardShowTag' && <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--text-3)' }}>Yalnız seçenek grubu olan ürünlerde görünür.</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const NAV_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: 'Görünüm', ids: ['catnavStyle', 'catnavActiveStyle', 'catnavFontSize'] },
  { title: 'Yerleşim', ids: ['catnavAlign', 'catnavDensity', 'catnavItemGap', 'navTopGap', 'navBottomGap', 'stickyNav'] },
  { title: 'Davranış ve içerik', ids: ['catnavShowCount', 'catnavAutoCenter', 'catnavEdgeFade'] },
  { title: 'Görsel kartlar', ids: ['catnavVisualStyle', 'catnavVisualCardWidth', 'catnavVisualCardHeight', 'catnavVisualRadius'] },
  { title: 'Fotoğraf overlay', ids: ['catnavOverlayTextPosition', 'catnavOverlayTextAlign', 'catnavOverlayTextColor', 'catnavOverlayColor', 'catnavOverlayOpacity', 'catnavOverlayBlur'] },
]

function NavPropertyPanel({ fields, visual, getValue, onChange }: {
  fields: SettingField[]
  visual: boolean
  getValue: (field: SettingField) => unknown
  onChange: (field: SettingField, value: unknown) => void
}) {
  return (
    <div data-nav-property-panel data-modern-property-panel style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{HEADER_CONTROL_CSS}</style>
      {visual && <div role="note" style={{ padding: '10px 12px', borderRadius: 10, background: '#f3f4f6', color: '#4b4f58', fontSize: 11.5, lineHeight: 1.45 }}>Görselli navigasyon kategori kartlarıyla çalışır; sticky ve aktif öğeyi ortalama ayarları yalnız yatay metin navigasyonunda kullanılır.</div>}
      {NAV_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids.map((id) => fields.find((field) => field.id === id)).filter((field): field is SettingField => Boolean(field))
        if (sectionFields.length === 0) return null
        return (
          <div key={section.title} style={{ padding: 14, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,25,31,.03)' }}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{section.title}</div>
            <div style={{ display: 'grid', gap: 12 }}>{sectionFields.map((field) => <HeaderPropertyField key={field.id} field={field} value={getValue(field)} onChange={(value) => onChange(field, value)} />)}</div>
          </div>
        )
      })}
    </div>
  )
}

const LAYOUT_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: 'Sayfa görünümü', ids: ['texture', 'textureStrength', 'sectionHeading', 'pageMaxWidth'] },
  { title: 'Sayfa boşlukları', ids: ['pad', 'sectionGap', 'sectionHeadingTopGap', 'sectionHeadingBottomGap'] },
  { title: 'Ürün grid’i', ids: ['gap'] },
]

function LayoutPropertyPanel({ fields, texture, getValue, onChange }: {
  fields: SettingField[]
  texture: GarsonlessTheme['texture']
  getValue: (field: SettingField) => unknown
  onChange: (field: SettingField, value: unknown) => void
}) {
  return (
    <div data-layout-property-panel data-modern-property-panel style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{HEADER_CONTROL_CSS}</style>
      {LAYOUT_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids
          .map((id) => fields.find((field) => field.id === id))
          .filter((field): field is SettingField => Boolean(field))
          .filter((field) => field.id !== 'textureStrength' || texture !== 'solid')
        if (sectionFields.length === 0) return null
        return (
          <div key={section.title} style={{ padding: 14, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,25,31,.03)' }}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{section.title}</div>
            <div style={{ display: 'grid', gap: 12 }}>{sectionFields.map((field) => <HeaderPropertyField key={field.id} field={field} value={getValue(field)} onChange={(value) => onChange(field, value)} />)}</div>
            {section.title === 'Ürün grid’i' && <div role="note" style={{ marginTop: 10, fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-3)' }}>Sütun sayısı ve kart yapısı Kartlar → Düzen bölümünden yönetilir. Mobilde en fazla iki sütun gösterilir.</div>}
          </div>
        )
      })}
    </div>
  )
}

const THEME_COLOR_IDS = ['bg', 'cardColor', 'textColor', 'mutedTextColor', 'accent', 'accentSoft', 'cta', 'ctaTextColor', 'borderColor', 'headerBg']

function ThemePropertyPanel({ fields, getValue, onChange }: {
  fields: SettingField[]
  getValue: (field: SettingField) => unknown
  onChange: (field: SettingField, value: unknown) => void
}) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]))
  const valueFor = (id: string, fallback: string) => String(fieldMap.get(id) ? getValue(fieldMap.get(id)!) : fallback)
  const contrastPairs = [
    ['Ana metin / Sayfa', valueFor('textColor', '#1c1d20'), valueFor('bg', '#ffffff')],
    ['Ana metin / Kart', valueFor('textColor', '#1c1d20'), valueFor('cardColor', '#ffffff')],
    ['Buton metni / Buton', valueFor('ctaTextColor', '#ffffff'), valueFor('cta', '#111111')],
    ['Vurgu / Sayfa', valueFor('accent', '#111111'), valueFor('bg', '#ffffff')],
  ] as const
  const sections = [
    { title: 'Renk sistemi', ids: THEME_COLOR_IDS },
    { title: 'Tipografi', ids: ['displayFont', 'bodyFont', 'fs', 'lh'] },
  ]
  return (
    <div data-theme-property-panel data-modern-property-panel style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{HEADER_CONTROL_CSS}</style>
      {sections.map((section) => {
        const sectionFields = section.ids.map((id) => fieldMap.get(id)).filter((field): field is SettingField => Boolean(field))
        if (sectionFields.length === 0) return null
        return (
          <div key={section.title} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,25,31,.03)' }}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750 }}>{section.title}</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {sectionFields.map((field) => field.type === 'color'
                ? <ThemeColorField key={field.id} field={field} value={String(getValue(field) ?? field.default ?? '')} onChange={(value) => onChange(field, value)} />
                : <HeaderPropertyField key={field.id} field={field} value={getValue(field)} onChange={(value) => onChange(field, value)} />)}
            </div>
            {section.title === 'Renk sistemi' && fieldMap.get('accentSoft') && (
              <button type="button" onClick={() => onChange(fieldMap.get('accentSoft')!, deriveSoftColor(valueFor('accent', '#2e7d52')))} style={{ marginTop: 12, width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 8, background: '#fff', color: '#111318', cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>Vurgu Soft’u otomatik üret</button>
            )}
          </div>
        )
      })}
      <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 750 }}>Erişilebilirlik</div>
        <div style={{ display: 'grid', gap: 7 }}>{contrastPairs.map(([label, fg, bg]) => {
          const ratio = contrastRatio(fg, bg)
          const pass = ratio >= 4.5
          return <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'var(--text-2)' }}><span>{label}</span><strong style={{ color: pass ? '#18794e' : '#b42318' }}>{ratio.toFixed(2)}:1 · {pass ? 'Geçer' : 'Zayıf'}</strong></div>
        })}</div>
      </div>
    </div>
  )
}

const CART_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: 'Sepete erişim', ids: ['cartHeaderTriggerStyle', 'cartFooterTriggerStyle', 'cartIcon', 'cartShowBadge'] },
  { title: 'Alt tetikleyici', ids: ['cartPillTone', 'cartPillPosition', 'cartShowSubtotal', 'cartShowItemCount'] },
  { title: 'Sepet çekmecesi', ids: ['cartDrawerTone'] },
  { title: 'Metinler', ids: ['cartButtonText', 'cartEmptyText', 'cartPrimaryActionText'] },
]

function CartPropertyPanel({ fields, headerStyle, footerStyle, getValue, onChange, onPatch }: {
  fields: SettingField[]
  headerStyle: NonNullable<GarsonlessTheme['cartHeaderTriggerStyle']>
  footerStyle: NonNullable<GarsonlessTheme['cartFooterTriggerStyle']>
  getValue: (field: SettingField) => unknown
  onChange: (field: SettingField, value: unknown) => void
  onPatch: (patch: Partial<GarsonlessTheme>) => void
}) {
  const fieldById = new Map(fields.map((field) => [field.id, field]))
  const safeChange = (field: SettingField, value: unknown) => {
    const patch = resolveCartTriggerPatch({
      fieldId: field.id,
      value,
      headerStyle,
      footerStyle,
    })
    if (patch) {
      onPatch(patch)
      return
    }
    onChange(field, value)
  }
  return (
    <div data-cart-property-panel data-modern-property-panel style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{HEADER_CONTROL_CSS}</style>
      <div role="note" style={{ padding: '10px 12px', borderRadius: 10, background: '#f3f4f6', color: '#4b4f58', fontSize: 11.5, lineHeight: 1.45 }}>Sepet girişi Header veya alt alanda gösterilir. Bir konumu seçtiğinde diğeri otomatik kapanır.</div>
      {CART_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids.map((id) => fieldById.get(id)).filter((field): field is SettingField => Boolean(field))
        if (sectionFields.length === 0) return null
        return <div key={section.title} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,25,31,.03)' }}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750 }}>{section.title}</div>
          <div style={{ display: 'grid', gap: 12 }}>{sectionFields.map((field) => <HeaderPropertyField key={field.id} field={field} value={getValue(field)} onChange={(value) => safeChange(field, value)} />)}</div>
        </div>
      })}
    </div>
  )
}

const ANNOUNCEMENT_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: 'Durum ve içerik', ids: ['announcementEnabled', 'announcementText'] },
  { title: 'Görünüm ve hareket', ids: ['announcementBg', 'announcementColor', 'announcementStyle', 'announcementSpeed'] },
]

function AnnouncementPropertyPanel({ fields, getValue, onChange }: {
  fields: SettingField[]
  getValue: (field: SettingField) => unknown
  onChange: (field: SettingField, value: unknown) => void
}) {
  const fieldById = new Map(fields.map((field) => [field.id, field]))
  const background = String(fieldById.get('announcementBg') ? getValue(fieldById.get('announcementBg')!) : '#111111')
  const foreground = String(fieldById.get('announcementColor') ? getValue(fieldById.get('announcementColor')!) : '#ffffff')
  const ratio = contrastRatio(foreground, background)
  return (
    <div data-announcement-property-panel data-modern-property-panel style={{ display: 'grid', gap: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <style>{HEADER_CONTROL_CSS}</style>
      {ANNOUNCEMENT_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids.map((id) => fieldById.get(id)).filter((field): field is SettingField => Boolean(field))
        if (sectionFields.length === 0) return null
        return <div key={section.title} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', boxShadow: '0 1px 2px rgba(20,25,31,.03)' }}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 750 }}>{section.title}</div>
          <div style={{ display: 'grid', gap: 12 }}>{sectionFields.map((field) => field.type === 'color'
            ? <ThemeColorField key={field.id} field={field} value={String(getValue(field))} onChange={(value) => onChange(field, value)} />
            : <HeaderPropertyField key={field.id} field={field} value={getValue(field)} onChange={(value) => onChange(field, value)} />)}</div>
        </div>
      })}
      {fieldById.has('announcementBg') && fieldById.has('announcementColor') && (
        <div role="status" style={{ padding: '10px 12px', border: `1px solid ${ratio >= 4.5 ? '#b7dfca' : '#f0b8b8'}`, borderRadius: 10, background: ratio >= 4.5 ? '#f0faf5' : '#fff4f4', color: ratio >= 4.5 ? '#18794e' : '#b42318', fontSize: 11.5, fontWeight: 700 }}>
          Metin kontrastı {ratio.toFixed(2)}:1 · {ratio >= 4.5 ? 'Erişilebilir' : 'Kontrastı artırın'}
        </div>
      )}
    </div>
  )
}

function ThemeColorField({ field, value, onChange }: { field: SettingField; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const valid = /^#[0-9a-fA-F]{6}$/.test(draft)
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12.5, color: 'var(--text-2)' }}>{field.label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '38px minmax(0,1fr)', border: `1px solid ${valid ? 'var(--border)' : '#d92d20'}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <input aria-label={`${field.label} renk seçici`} type="color" value={valid ? draft : '#000000'} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value) }} style={{ width: 38, height: 34, padding: 2, border: 0, background: '#fff', cursor: 'pointer' }} />
        <input aria-label={`${field.label} hex değeri`} value={draft} onChange={(event) => { const next = event.target.value; setDraft(next); if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next) }} style={{ minWidth: 0, border: 0, borderLeft: '1px solid var(--border)', padding: '0 9px', fontFamily: 'monospace', fontSize: 12, outline: 0 }} />
      </div>
      {!valid && <div style={{ marginTop: 4, color: '#b42318', fontSize: 10.5 }}>Geçerli format: #RRGGBB</div>}
    </div>
  )
}

function HeaderPropertyField({ field, value, onChange }: {
  field: SettingField
  value: unknown
  onChange: (value: unknown) => void
}) {
  const controlId = `theme-field-${sanitizePropertyControlId(field.id)}`
  const tiledSelect = field.type === 'select' && [
    'headerLogoStyle', 'headerStyle', 'headerLayout', 'headerAlign',
    'cardLayout', 'cardDensity', 'cardPriceAlign', 'cardImageFit', 'cardImagePosition',
    'cardHover', 'cardPlaceholderStyle', 'cardCtaStyle', 'cardCtaIcon',
    'catnavStyle', 'catnavActiveStyle', 'catnavAlign', 'catnavDensity', 'catnavVisualStyle',
    'texture', 'sectionHeading', 'pageMaxWidth',
    'cartHeaderTriggerStyle', 'cartFooterTriggerStyle', 'cartIcon', 'cartPillTone', 'cartDrawerTone', 'cartPillPosition',
    'announcementStyle',
  ].includes(field.id)
  if (tiledSelect) {
    return (
      <div>
        <div style={{ marginBottom: 7, fontSize: 12.5, color: 'var(--text-2)' }}>{field.label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(field.options?.length ?? 1, 3)}, minmax(0, 1fr))`, gap: 7, minWidth: 0 }}>
          {field.options?.map((option) => {
            const active = value === option.value
            return (
              <button key={String(option.value)} type="button" aria-pressed={active} onClick={() => onChange(option.value)} style={{
                minHeight: 54,
                padding: '7px 5px',
                minWidth: 0,
                border: active ? '1.5px solid #111318' : '1px solid var(--border)',
                borderRadius: 9,
                background: active ? '#f1f2f3' : '#fff',
                color: active ? '#111318' : 'var(--text-2)',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: active ? 700 : 550,
              }}>
                <span aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', marginBottom: 5, lineHeight: 1 }}>
                  {headerOptionIcon(field.id, String(option.value))}
                </span>
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  if (field.id === 'headerHeight') {
    const height = Number(value ?? field.default ?? 64)
    const presets = [{ label: 'Kompakt', value: 56 }, { label: 'Normal', value: 64 }, { label: 'Geniş', value: 80 }]
    const customHeight = !presets.some((preset) => preset.value === height)
    return (
      <div>
        <div style={{ marginBottom: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: 'var(--text-2)' }}>
          <span>Header yüksekliği</span>
          {customHeight && (
            <span style={{ padding: '2px 6px', borderRadius: 999, background: '#f1f2f3', color: '#111318', fontSize: 10.5, fontWeight: 700 }}>
              Özel · {height}px
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 9 }}>
          {presets.map((preset) => {
            const active = height === preset.value
            return (
              <button key={preset.value} type="button" aria-pressed={active} onClick={() => onChange(preset.value)} style={{
                height: 48, borderRadius: 9, cursor: 'pointer',
                border: active ? '1.5px solid #111318' : '1px solid var(--border)',
                background: active ? '#f1f2f3' : '#fff',
                color: active ? '#111318' : 'var(--text-2)', fontSize: 11.5,
              }}>
                <strong style={{ display: 'block' }}>{preset.label}</strong>{preset.value}px
              </button>
            )
          })}
        </div>
        <HeaderRangeControl field={field} value={height} onChange={onChange} controlId={controlId} />
      </div>
    )
  }
  if (field.type === 'toggle') {
    return (
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <label htmlFor={controlId} style={{ minWidth: 0, fontSize: 12.5, color: 'var(--text-2)' }}>{field.label}</label>
        <HeaderToggleControl controlId={controlId} value={Boolean(value)} onChange={onChange} label={field.label} />
      </div>
    )
  }
  if (field.type === 'range') {
    return (
      <div style={{ minWidth: 0 }}>
        <label htmlFor={controlId} style={{ display: 'block', marginBottom: 7, fontSize: 12.5, color: 'var(--text-2)' }}>{field.label}</label>
        <HeaderRangeControl field={field} value={Number(value ?? field.default ?? 0)} onChange={onChange} controlId={controlId} />
      </div>
    )
  }
  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={controlId} style={{ display: 'block', marginBottom: 7, fontSize: 12.5, color: 'var(--text-2)' }}>
        {field.label}
      </label>
      <PropertyControl field={field} value={value} onChange={onChange} controlId={controlId} />
    </div>
  )
}

function HeaderRangeControl({ field, value, onChange, controlId }: {
  field: SettingField
  value: number
  onChange: (value: number) => void
  controlId: string
}) {
  const min = field.min ?? 0
  const max = field.max ?? 100
  const step = field.step ?? 1
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  return (
    <div style={{ minWidth: 0, display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 50px 28px', alignItems: 'center', gap: 6 }}>
      <button type="button" aria-label={`${field.label} azalt`} onClick={() => onChange(clamp(value - step))} disabled={value <= min} style={headerRangeStepButtonStyle}>−</button>
      <input id={controlId} className="header-modern-range" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output htmlFor={controlId} style={{ height: 30, border: '1px solid var(--border)', borderRadius: 8, background: '#fff', color: '#111318', display: 'grid', placeItems: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        {value}{field.unit ?? ''}
      </output>
      <button type="button" aria-label={`${field.label} artır`} onClick={() => onChange(clamp(value + step))} disabled={value >= max} style={headerRangeStepButtonStyle}>+</button>
    </div>
  )
}

const headerRangeStepButtonStyle: CSSProperties = {
  width: 28, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 8,
  background: '#fff', color: '#111318', cursor: 'pointer', fontSize: 16, lineHeight: 1,
}

function HeaderToggleControl({ controlId, value, onChange, label }: {
  controlId: string
  value: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button id={controlId} type="button" role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)} style={{
      width: 38, height: 22, padding: 0, border: '1px solid #d7d9dd', borderRadius: 999,
      background: value ? '#111318' : '#e7e8eb', position: 'relative', cursor: 'pointer', flexShrink: 0,
      transition: 'background 150ms, border-color 150ms',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16,
        borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(17,19,24,.22)', transition: 'left 150ms',
      }} />
    </button>
  )
}

function headerOptionIcon(fieldId: string, value: string) {
  if (fieldId === 'headerStyle') return value === 'blur' ? <I.sparkles size={17} /> : <I.color size={17} />
  if (fieldId === 'headerAlign') return value === 'center' ? <I.layout size={17} /> : <I.spacing size={17} />
  if (fieldId === 'headerLayout') {
    if (value === 'stacked') return <I.header size={17} />
    if (value === 'center') return <I.layout size={17} />
    if (value === 'compact') return <I.card size={17} />
    return <I.spacing size={17} />
  }
  if (fieldId === 'headerLogoStyle') {
    if (value === 'image') return <I.image size={17} />
    if (value === 'wordmark') return <I.type size={17} />
    return <I.header size={17} />
  }
  if (fieldId === 'cardLayout') return value === 'horizontal' ? <I.section size={17} /> : value === 'minimal' ? <I.page size={17} /> : <I.grid size={17} />
  if (fieldId === 'cardDensity') return value === 'compact' ? <I.spacing size={17} /> : value === 'comfortable' ? <I.sparkles size={17} /> : <I.card size={17} />
  if (fieldId === 'cardPriceAlign' || fieldId === 'catnavAlign') return value === 'right' ? <I.arrow size={17} /> : value === 'center' ? <I.layout size={17} /> : <I.chevLeft size={17} />
  if (fieldId === 'cardImageFit' || fieldId === 'cardImagePosition' || fieldId === 'cardPlaceholderStyle') return <I.image size={17} />
  if (fieldId === 'cardHover') return value === 'none' ? <I.close size={17} /> : value === 'lift' ? <I.arrow size={17} /> : <I.sparkles size={17} />
  if (fieldId === 'cardCtaStyle') return value === 'none' ? <I.close size={17} /> : value === 'icon' ? <I.plus size={17} /> : <I.tag size={17} />
  if (fieldId === 'cardCtaIcon') return value === 'cart' ? <I.cart size={17} /> : value === 'bag' ? <I.store size={17} /> : <I.plus size={17} />
  if (fieldId === 'catnavStyle') return value === 'visual' ? <I.image size={17} /> : <I.nav size={17} />
  if (fieldId === 'catnavActiveStyle') return value === 'underline' ? <I.spacing size={17} /> : value === 'dot' ? <I.more size={17} /> : <I.tag size={17} />
  if (fieldId === 'catnavDensity') return value === 'compact' ? <I.spacing size={17} /> : <I.nav size={17} />
  if (fieldId === 'catnavVisualStyle') return value === 'overlay' ? <I.image size={17} /> : <I.card size={17} />
  if (fieldId === 'texture') return value === 'solid' ? <I.color size={17} /> : value === 'paper' ? <I.page size={17} /> : <I.sparkles size={17} />
  if (fieldId === 'sectionHeading') return value === 'catalog' ? <I.page size={17} /> : value === 'editorial' ? <I.type size={17} /> : <I.color size={17} />
  if (fieldId === 'pageMaxWidth') return value === 'none' ? <I.frame size={17} /> : <I.layout size={17} />
  if (fieldId === 'cartHeaderTriggerStyle') return value === 'none' ? <I.close size={17} /> : value === 'icon' ? <I.cart size={17} /> : <I.receipt size={17} />
  if (fieldId === 'cartFooterTriggerStyle') {
    if (value === 'none') return <I.close size={17} />
    if (value === 'bar') return <I.section size={17} />
    if (value === 'fab') return <I.plus size={17} />
    if (value === 'thumbs') return <I.image size={17} />
    return <I.cart size={17} />
  }
  if (fieldId === 'cartIcon') return value === 'cart' ? <I.cart size={17} /> : value === 'bag' ? <I.store size={17} /> : <I.handPlatter size={17} />
  if (fieldId === 'cartPillTone' || fieldId === 'cartDrawerTone') return value === 'light' || value === 'clean' ? <I.sparkles size={17} /> : <I.color size={17} />
  if (fieldId === 'cartPillPosition') return value === 'edge' ? <I.spacing size={17} /> : <I.arrow size={17} />
  if (fieldId === 'announcementStyle') return value === 'static' ? <I.page size={17} /> : value === 'marquee' ? <I.arrow size={17} /> : value === 'fade' ? <I.sparkles size={17} /> : <I.section size={17} />
  return <I.sparkles size={17} />
}

function PropertySection({ title, children, defaultOpen = true }: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--divider)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{title}</span>
        <span style={{
          color: 'var(--text-3)',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 120ms',
        }}>
          <I.chevDown size={17} />
        </span>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function PropertyFieldEditor({ field, value, onChange }: {
  field: SettingField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const controlId = `theme-field-${sanitizePropertyControlId(field.id)}`
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '96px 1fr',
      alignItems: field.type === 'toggle' ? 'center' : 'start',
      gap: 10,
      minHeight: 32,
    }}>
      <label htmlFor={controlId} style={{ paddingTop: field.type === 'toggle' ? 0 : 6, fontSize: 12.5, color: 'var(--text-2)' }}>
        {field.label}
      </label>
      <PropertyControl field={field} value={value} onChange={onChange} controlId={controlId} />
    </div>
  )
}


function PropertyControl({ field, value, onChange, controlId }: {
  field: SettingField
  value: unknown
  onChange: (v: unknown) => void
  controlId: string
}) {
  if (field.type === 'color') {
    return (
      <div style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        border: '1px solid var(--border-strong)',
        borderRadius: 7,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}>
        <input
          id={`${controlId}-color`}
          type="color"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 34, height: 32, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
        />
        <input
          id={controlId}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            borderLeft: '1px solid var(--border-strong)',
            padding: '0 9px',
            fontSize: 12.5,
            color: 'var(--text)',
            background: 'transparent',
          }}
        />
      </div>
    )
  }
  if (field.type === 'range' && field.themeField === 'cols') {
    const numVal = Number(value || 2)
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {([1, 2, 3] as const).map((col) => {
          const active = numVal === col
          return (
            <button
              key={col}
              type="button"
              title={`${col} sütun`}
              onClick={() => onChange(col)}
              style={{
                flex: 1, height: 44,
                border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                borderRadius: 9,
                background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-color 120ms, background 120ms, color 120ms',
              }}
            >
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                {col === 1 && <rect x="3" y="3" width="22" height="16" rx="2.5" fill="currentColor" opacity="0.85" />}
                {col === 2 && <><rect x="3" y="3" width="10" height="16" rx="2.5" fill="currentColor" opacity="0.85" /><rect x="15" y="3" width="10" height="16" rx="2.5" fill="currentColor" opacity="0.85" /></>}
                {col === 3 && <><rect x="2" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" /><rect x="10.5" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" /><rect x="19" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" /></>}
              </svg>
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'range') {
    const fallback = field.default ?? field.min ?? 0
    const parsed = Number(value ?? fallback)
    const numVal = Number.isFinite(parsed) ? parsed : Number(fallback) || 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32 }}>
        <input
          id={controlId}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={numVal}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--text)' }}
        />
        <span style={{
          minWidth: 46,
          textAlign: 'right',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 6px',
          color: 'var(--text-2)',
          fontSize: 12,
        }}>
          {numVal}{field.unit ?? ''}
        </span>
      </div>
    )
  }
  if (field.type === 'toggle') {
    const boolVal = Boolean(value)
    return (
      <button
        type="button"
        id={controlId}
        role="switch"
        aria-checked={boolVal}
        onClick={() => onChange(!boolVal)}
        style={{
          width: 38,
          height: 22,
          justifySelf: 'start',
          borderRadius: 999,
          border: 'none',
          background: boolVal ? 'var(--text)' : 'var(--surface-3)',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: boolVal ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'left 150ms',
        }} />
      </button>
    )
  }
  if (field.type === 'select' || field.type === 'font') {
    return (
      <select
        id={controlId}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 32,
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 12.5,
          padding: '0 9px',
          cursor: 'pointer',
        }}
      >
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }
  if (field.type === 'text') {
    return (
      <input
        id={controlId}
        type="text"
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minWidth: 0,
          height: 32,
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 12.5,
          padding: '0 9px',
          outline: 'none',
        }}
      />
    )
  }
  return null
}


export {
  AnnouncementPropertyPanel,
  CardPropertyPanel,
  CartPropertyPanel,
  HeaderPropertyPanel,
  LayoutPropertyPanel,
  NavPropertyPanel,
  PropertyFieldEditor,
  PropertySection,
  ThemePropertyPanel,
}
