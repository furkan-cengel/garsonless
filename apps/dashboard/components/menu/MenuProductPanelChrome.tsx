'use client'

import type { Ref } from 'react'
import type { Tables } from '@garsonless/db/types'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { I } from '../../lib/ui'

/* Shared chrome for the product panel, so creating and editing a product are
   the same three-tab panel: create walks the tabs in order, edit jumps freely. */

export const PRODUCT_PANEL_TABS = [
  { id: 'basics', label: 'Temel' },
  { id: 'food', label: 'Detaylar' },
  { id: 'publish', label: 'Yayın' },
] as const

export type ProductPanelTab = (typeof PRODUCT_PANEL_TABS)[number]['id']

export function MenuProductPanelHeader({ headingId, headingRef, title, subtitle, closeLabel, busy, onClose }: {
  headingId: string
  headingRef?: Ref<HTMLDivElement>
  title: string
  subtitle: string
  closeLabel: string
  busy: boolean
  onClose: () => void
}) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div ref={headingRef} tabIndex={-1} id={headingId} style={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.25, outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div className="menu-secondary-text" style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={closeLabel} disabled={busy} onClick={onClose}>
        <I.close size={15} />
      </Button>
    </div>
  )
}

/** Must render inside `<Tabs>`. Create shows step numbers; edit shows a ✓ on completed tabs. */
export function MenuProductPanelTabs({ mode, done, reachable }: {
  mode: 'create' | 'edit'
  done?: Partial<Record<ProductPanelTab, boolean>>
  reachable?: (tab: ProductPanelTab) => boolean
}) {
  return (
    <TabsList className="menu-product-panel-tabs sticky top-0 z-[3] w-full rounded-none border-b bg-[var(--surface)] px-3 py-1.5" style={{ height: 'auto' }} aria-label={mode === 'create' ? 'Yeni ürün adımları' : 'Ürün düzenleme bölümleri'}>
      {PRODUCT_PANEL_TABS.map((tab, index) => (
        <TabsTrigger key={tab.id} value={tab.id} disabled={reachable ? !reachable(tab.id) : false} className="h-8">
          {mode === 'create' ? (
            <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-muted text-[10px] font-bold">{index + 1}</span>
          ) : done?.[tab.id] ? (
            <I.check data-icon="inline-start" aria-label="tamamlandı" />
          ) : null}
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

/** Category and sub-category as two selects; the product is stored under the sub-category when one is chosen. */
export function MenuCategoryPicker({ idPrefix, categories, value, onChange, disabled }: {
  idPrefix: string
  categories: Tables<'menu_categories'>[]
  value: string
  onChange: (categoryId: string) => void
  disabled?: boolean
}) {
  const current = categories.find((category) => category.id === value)
  const topId = current?.parent_id ?? current?.id ?? ''
  const topLevel = categories.filter((category) => !category.parent_id)
  const children = categories.filter((category) => category.parent_id === topId)
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field className="min-w-0 gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-category`} className="text-xs font-medium">Kategori</FieldLabel>
        <NativeSelect id={`${idPrefix}-category`} className="w-full" value={topId} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          {topLevel.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field className="min-w-0 gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-subcategory`} className="text-xs font-medium">Alt kategori</FieldLabel>
        <NativeSelect id={`${idPrefix}-subcategory`} className="w-full" value={current?.parent_id ? current.id : ''} disabled={disabled || children.length === 0} onChange={(event) => onChange(event.target.value || topId)}>
          <NativeSelectOption value="">{children.length ? 'Yok' : 'Alt kategori yok'}</NativeSelectOption>
          {children.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
    </div>
  )
}
