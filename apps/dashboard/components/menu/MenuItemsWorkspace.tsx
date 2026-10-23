'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Switch } from '@/components/ui/switch'
import { MenuAvailabilityDialog } from './MenuAvailabilityDialog'
import { MenuConfirmDialog } from './MenuConfirmDialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useEffect, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { Tables } from '@garsonless/db/types'
import { I } from '../../lib/ui'
import { highlightText, tintFor } from './menu-manager-utils'
import { MenuMissingInfoBadge } from './MenuMissingInfo'

const MenuProductsDnd = dynamic(() => import('./MenuProductsDnd'), { ssr: false })

/* ============================================================
   ITEMS CANVAS
   ============================================================ */
export function MenuItemsWorkspace({
  items,
  activeCategory,
  subCategories,
  activeSubCat,
  onSubCatChange,
  selectedItem,
  onSelectItem,
  onAddCategory,
  onAddItem,
  onImport,
  onAddToCategory,
  onQuickUpdate,
  pendingItemIds,
  structuralPending,
  editingItemId,
  onBulkAvailability,
  onBulkDelete,
  onBulkEdit,
  onReorderItems,
  onMoveItem,
  highlight,
  categories,
  onClearSearch,
  filter,
  onFilterChange: setFilter,
}: {
  items: Tables<'menu_items'>[]
  filter: 'all' | 'active' | 'inactive'
  onFilterChange: (filter: 'all' | 'active' | 'inactive') => void
  activeCategory: Tables<'menu_categories'> | null
  subCategories: Tables<'menu_categories'>[]
  activeSubCat: string | null
  onSubCatChange: (id: string | null) => void
  selectedItem: Tables<'menu_items'> | null
  onSelectItem: (item: Tables<'menu_items'>) => void
  onAddCategory: () => void
  onAddItem: () => void
  onImport: () => void
  onAddToCategory: (categoryId: string) => void
  pendingItemIds: ReadonlySet<string>
  structuralPending: boolean
  editingItemId?: string
  onQuickUpdate: (id: string, patch: { price?: number; is_available?: boolean }) => void
  onBulkEdit: (ids: string[]) => void
  onMoveItem: (itemId: string, categoryId: string) => void
  onReorderItems: (categoryId: string, orderedIds: string[]) => void
  onBulkAvailability: (ids: string[], isAvailable: boolean) => Promise<boolean>
  onBulkDelete: (ids: string[]) => Promise<boolean>
  highlight?: string
  categories: Tables<'menu_categories'>[]
  onClearSearch: () => void
}) {
  const canAddProduct = categories.length > 0
  const searching = Boolean(highlight)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [availabilityItem, setAvailabilityItem] = useState<Tables<'menu_items'> | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [visibleCount, setVisibleCount] = useState(60)

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))))
  }, [items])

  useEffect(() => setVisibleCount(60), [filter, highlight, items])

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function applyBulkAvailability(isAvailable: boolean) {
    const ids = [...selectedIds]
    if (structuralPending || ids.some((id) => pendingItemIds.has(id) || id === editingItemId)) return
    if (await onBulkAvailability(ids, isAvailable)) setSelectedIds(new Set())
  }

  const bulkLocked = structuralPending || [...selectedIds].some((id) => pendingItemIds.has(id) || id === editingItemId)
  const filtered = items.filter((item) => {
    if (filter === 'active') return item.is_available
    if (filter === 'inactive') return !item.is_available
    return true
  })

  const activeCount = items.filter((i) => i.is_available).length
  const inactiveCount = items.length - activeCount
  const hasSubCats = subCategories.length > 0
  const renderedItems = filtered.slice(0, visibleCount)
  const grouped = !searching && !activeSubCat && subCategories.length > 0
  const groups = grouped
    ? [activeCategory, ...subCategories].filter((category) => category !== null).map((category) => ({
      id: category.id, name: category.id === activeCategory?.id ? 'Alt kategorisiz' : category.name,
      items: renderedItems.filter((item) => item.category_id === category.id),
    })).filter((group) => group.id !== activeCategory?.id || group.items.length > 0)
    : [{ id: activeSubCat ?? activeCategory?.id ?? 'all', name: '', items: renderedItems }]
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const categoryPath = (categoryId: string) => {
    const category = categoryById.get(categoryId)
    const parent = category?.parent_id ? categoryById.get(category.parent_id) : null
    return [parent?.name, category?.name].filter(Boolean).join(' / ')
  }

  return (
    <section
      className="menu-items-workspace"
      aria-labelledby="menu-products-heading"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      {/* Toolbar: status tabs carry the only counts; the view toggle sits opposite. */}
      <div
        className="menu-items-toolbar"
        style={{
          minHeight: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <ToggleGroup
          value={[filter]}
          onValueChange={(values) => {
            const next = values[0] as typeof filter | undefined
            if (next) { setFilter(next); setSelectedIds(new Set()) }
          }}
          size="sm"
          spacing={1}
          aria-label="Ürün durumu filtresi"
        >
          {(['all', 'active', 'inactive'] as const).map((f) => {
            const labels = {
              all: `Tümü ${items.length}`,
              active: `Yayında ${activeCount}`,
              inactive: `Pasif ${inactiveCount}`,
            }
            return (
              <ToggleGroupItem className="menu-filter-button" key={f} value={f}>
                {labels[f]}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        <ToggleGroup
          value={[view]}
          onValueChange={(values) => {
            const next = values[0] as typeof view | undefined
            if (next) setView(next)
          }}
          size="sm"
          spacing={0}
          aria-label="Ürün görünümü"
        >
          {(['grid', 'list'] as const).map((v) => (
            <ToggleGroupItem className="menu-view-button" key={v} value={v} aria-label={v === 'grid' ? 'Kart görünümü' : 'Liste görünümü'}>
              {v === 'grid' ? <I.grid /> : <I.section />}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Sub-category chips: phones only; on desktop sub-categories are picked in the category rail. */}
      {hasSubCats && (
        <div className="menu-subcategory-tabs" role="group" aria-label="Alt kategoriler">
          {[{ id: null, name: 'Tümü', count: filtered.length }, ...subCategories.map((sc) => ({ id: sc.id, name: sc.name, count: filtered.filter((item) => item.category_id === sc.id).length }))].map((chip) => (
            <Button
              key={chip.id ?? 'all'}
              type="button"
              aria-pressed={activeSubCat === chip.id}
              onClick={() => onSubCatChange(chip.id)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 999,
                cursor: 'pointer',
                background: activeSubCat === chip.id ? 'var(--text)' : 'var(--surface-3)',
                color: activeSubCat === chip.id ? 'var(--bg)' : 'var(--text-2)',
                border: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {chip.name} ({chip.count})
            </Button>
          ))}
        </div>
      )}

      {/* Items */}
      <div className="menu-items-scroll" data-selecting={selectedIds.size > 0 || undefined} style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div className="menu-items-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <h2 id="menu-products-heading" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            {searching ? `Arama · "${highlight}"` : [activeCategory?.name ?? 'Tüm ürünler', subCategories.find((sc) => sc.id === activeSubCat)?.name].filter(Boolean).join(' · ')}
            <span aria-live="polite" style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {filtered.length} {searching ? 'sonuç, tüm kategorilerde' : 'ürün'}</span>
          </h2>
          {!searching && !grouped && filtered.length > 0 && (activeSubCat ?? activeCategory?.id) && (
            <Button type="button" variant="outline" size="sm" style={{ marginLeft: 'auto' }} onClick={() => onAddToCategory((activeSubCat ?? activeCategory?.id)!)}>
              <I.plus data-icon="inline-start" />Ürün ekle
            </Button>
          )}
        </div>
        {filtered.length === 0 ? (
          <EmptyProducts
            filtered={items.length > 0}
            searching={Boolean(highlight)}
            canAddProduct={canAddProduct}
            onAddCategory={onAddCategory}
            onAdd={onAddItem}
            onResetFilter={() => setFilter('all')}
            onClearSearch={onClearSearch}
            onImport={onImport}
          />
        ) : <MenuProductsDnd groups={groups} items={items} view={view} grouped={grouped}
          disabled={structuralPending || searching} disabledIds={new Set([...pendingItemIds, ...(editingItemId ? [editingItemId] : [])])}
          onAdd={onAddToCategory} onMove={onMoveItem} onReorder={onReorderItems}
          renderItem={(item, handle) => view === 'list'
            ? <ItemRow item={item} active={selectedItem?.id === item.id} onClick={() => onSelectItem(item)}
              pending={structuralPending || pendingItemIds.has(item.id) || editingItemId === item.id} onToggleAvailable={() => setAvailabilityItem(item)}
              selectedForBulk={selectedIds.has(item.id)} onToggleSelected={() => toggleSelected(item.id)} highlight={highlight}
              categoryPath={searching ? categoryPath(item.category_id) : undefined} dragHandle={handle} />
            : <ItemCard item={item} active={selectedItem?.id === item.id} onClick={() => onSelectItem(item)}
              pending={structuralPending || pendingItemIds.has(item.id) || editingItemId === item.id}
              onPriceUpdate={(price) => onQuickUpdate(item.id, { price })} onToggleAvailable={() => setAvailabilityItem(item)}
              selectedForBulk={selectedIds.has(item.id)} onToggleSelected={() => toggleSelected(item.id)} highlight={highlight}
              categoryPath={searching ? categoryPath(item.category_id) : undefined} dragHandle={handle} />}
        />}
        {visibleCount < filtered.length && (
          <div className="flex justify-center py-5">
            <Button type="button" variant="outline" onClick={() => setVisibleCount((current) => current + 60)}>
              Daha fazla ürün göster ({Math.min(visibleCount, filtered.length)}/{filtered.length})
            </Button>
          </div>
        )}
      </div>
      {/* Selection bar: quick actions here, the full bulk editor one step further. */}
      {selectedIds.size > 0 && (
        <div className="menu-bulk-bar" role="region" aria-label="Seçili ürünler" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
          <span aria-live="polite" style={{ fontSize: 12.5, fontWeight: 600, marginRight: 4 }}>{selectedIds.size} seçili</span>
          {selectedIds.size < filtered.length && (
            <Button variant="ghost" size="sm" disabled={structuralPending} onClick={() => setSelectedIds(new Set(filtered.map(item => item.id)))}>Tümünü seç ({filtered.length})</Button>
          )}
          <Button className="menu-bulk-action" variant="outline" size="sm" type="button" disabled={bulkLocked} onClick={() => void applyBulkAvailability(true)}>
            Yayına al
          </Button>
          <Button className="menu-bulk-action" variant="outline" size="sm" type="button" disabled={bulkLocked} onClick={() => void applyBulkAvailability(false)}>
            Pasife al
          </Button>
          <Button className="menu-bulk-action" variant="outline" size="sm" type="button" disabled={bulkLocked} onClick={() => setBulkDeleteOpen(true)} style={{ color: 'var(--critical)' }}>
            Sil
          </Button>
          <Button variant="outline" size="sm" disabled={structuralPending || [...selectedIds].some(id => pendingItemIds.has(id))} onClick={() => onBulkEdit([...selectedIds])}>
            Toplu düzenleyiciyi aç
            <I.chevRight data-icon="inline-end" />
          </Button>
          <Button className="menu-bulk-action menu-bulk-clear" variant="ghost" size="sm" type="button" style={{ marginLeft: 'auto' }} onClick={() => setSelectedIds(new Set())}>
            Temizle
          </Button>
        </div>
      )}
      {bulkDeleteOpen && (
        <MenuConfirmDialog
          title={`${selectedIds.size} ürün silinsin mi?`}
          message="Hiç sipariş edilmemiş ürünler kalıcı olarak silinir. Sipariş geçmişi olanlar atlanır; onları pasife alabilirsin."
          confirmLabel="Sil"
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={() => {
            const ids = [...selectedIds]
            setBulkDeleteOpen(false)
            void onBulkDelete(ids).then((done) => { if (done) setSelectedIds(new Set()) })
          }}
        />
      )}
      {availabilityItem && <MenuAvailabilityDialog item={availabilityItem} onCancel={() => setAvailabilityItem(null)} onConfirm={() => {
        const current = items.find((item) => item.id === availabilityItem.id)
        if (current && !structuralPending && !pendingItemIds.has(current.id) && current.id !== editingItemId && current.is_available === availabilityItem.is_available) {
          onQuickUpdate(current.id, { is_available: !current.is_available })
        }
        setAvailabilityItem(null)
      }} />}
    </section>
  )
}

function ItemCard({
  item,
  active,
  onClick,
  onPriceUpdate,
  pending,
  onToggleAvailable,
  selectedForBulk,
  onToggleSelected,
  highlight,
  categoryPath,
  dragHandle,
}: {
  item: Tables<'menu_items'>
  active: boolean
  onClick: () => void
  pending: boolean
  onPriceUpdate?: (price: number) => void
  onToggleAvailable?: () => void
  selectedForBulk: boolean
  onToggleSelected: () => void
  highlight?: string
  categoryPath?: string
  dragHandle: ReactNode
}) {
  const [hov, setHov] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceVal, setPriceVal] = useState(String(item.price))
  const tint = tintFor(item.id)

  function commitPrice() {
    if (pending) return
    const n = Number(priceVal)
    if (!isNaN(n) && n > 0 && n !== item.price) onPriceUpdate?.(n)
    setEditingPrice(false)
  }
  return (
    <div
      className="menu-product-card"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)',
        borderRadius: 10,
        border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: active ? '0 0 0 3px rgba(17,17,19,.06)' : hov ? 'var(--shadow-2)' : 'var(--shadow-1)',
        transition: 'all 120ms',
        opacity: item.is_available ? 1 : 0.6,
      }}
    >
      <div
        style={{
          aspectRatio: '4/3',
          background: tint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          color: 'rgba(17,17,19,.34)',
        }}
      >
        <label
          onClick={(event) => event.stopPropagation()}
          className="menu-product-select-hit-area"
          style={{
            position: 'absolute',
            zIndex: 2,
            top: 0,
            left: 0,
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span className="menu-product-select-surface grid size-7 place-items-center rounded-lg border bg-card shadow-sm">
            <Checkbox
              aria-label={`${item.name} ürününü seç`}
              checked={selectedForBulk}
              onCheckedChange={onToggleSelected}
              className="size-[18px] border-border bg-card"
            />
          </span>
        </label>
        <span className="menu-product-card-drag" style={{ position: 'absolute', zIndex: 2, top: 6, right: 6, borderRadius: 8, background: 'var(--surface)', boxShadow: 'var(--shadow-1)' }}>{dragHandle}</span>
        {Array.isArray(item.images) && (item.images as string[])[0] ? (
          <img
            src={(item.images as string[])[0]}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              inset: 0,
            }}
          />
        ) : (
          <I.menuDish size={46} />
        )}
        <Button
          type="button"
          aria-label={`${item.name} ürün görselinden düzenle`}
          onClick={onClick}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            width: '100%',
            height: '100%',
            border: 0,
            padding: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
      </div>
      <div style={{ padding: '10px 12px 12px', minWidth: 0 }}>
        {categoryPath ? (
          <div className="menu-product-breadcrumb" style={{ color: 'var(--text-2)', fontSize: 10.5, marginBottom: 4 }}>
            {categoryPath}
          </div>
        ) : null}
        <Button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
          aria-label={`${item.name} ürününü düzenle`}
          style={{
            display: 'block',
            width: '100%',
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {highlight ? highlightText(item.name, highlight) : item.name}
        </Button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
          }}
        >
          {editingPrice ? (
            <Input
              autoFocus
              disabled={pending}
              type="number"
              min={0.01}
              step={0.01}
              value={priceVal}
              onChange={(e) => setPriceVal(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPrice()
                if (e.key === 'Escape') setEditingPrice(false)
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 72,
                padding: '2px 6px',
                fontWeight: 700,
                fontSize: 13,
                border: '1px solid var(--action)',
                borderRadius: 5,
                outline: 'none',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontFamily: "'Geist Mono', monospace",
              }}
            />
          ) : (
            <Button
              type="button"
              aria-label={`${item.name} fiyatını düzenle`}
              disabled={pending}
              title="Düzenlemek için tıkla"
              onClick={(e) => {
                e.stopPropagation()
                setEditingPrice(true)
                setPriceVal(String(item.price))
              }}
              style={{
                padding: 0,
                border: 0,
                background: 'transparent',
                color: 'inherit',
                textAlign: 'left',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'text',
              }}
            >
              ₺{item.price}
            </Button>
          )}
          <AvailabilitySwitch item={item} pending={pending} onToggle={onToggleAvailable} />
        </div>
          <div className="flex flex-wrap items-center gap-1 pt-2">
            <MenuMissingInfoBadge item={item} onOpenItem={onClick} />
            {Array.isArray(item.modifier_groups) && (item.modifier_groups as unknown[]).length > 0 && <Badge variant="secondary">{(item.modifier_groups as unknown[]).length} varyant</Badge>}
          </div>
      </div>
    </div>
  )
}

/** Status switch with its state in words, so "on" never has to be read from the toggle alone. */
function AvailabilitySwitch({ item, pending, onToggle }: { item: Tables<'menu_items'>; pending: boolean; onToggle?: () => void }) {
  return (
    <label className="menu-availability-switch inline-flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      <Switch checked={item.is_available} disabled={pending} onCheckedChange={() => onToggle?.()} aria-label={`${item.name} menüde yayında`} />
      <span aria-hidden="true" style={{ fontSize: 11, color: item.is_available ? 'var(--positive)' : 'var(--text-3)' }}>{item.is_available ? 'Görünür' : 'Gizli'}</span>
    </label>
  )
}

function ItemRow({ item, active, onClick, pending, onToggleAvailable, selectedForBulk, onToggleSelected, highlight, categoryPath, dragHandle }: {
  item: Tables<'menu_items'>
  active: boolean
  onClick: () => void
  pending: boolean
  onToggleAvailable: () => void
  selectedForBulk: boolean
  onToggleSelected: () => void
  highlight?: string
  categoryPath?: string
  dragHandle: ReactNode
}) {
  const image = Array.isArray(item.images) ? (item.images as string[])[0] : undefined
  const variantCount = Array.isArray(item.modifier_groups) ? (item.modifier_groups as unknown[]).length : 0
  return (
    <div className="menu-product-row" data-active={active || undefined} onClick={onClick} style={{ opacity: item.is_available ? 1 : 0.6 }}>
      <label className="grid size-6 place-items-center" onClick={(event) => event.stopPropagation()}>
        <Checkbox aria-label={`${item.name} ürününü seç`} checked={selectedForBulk} onCheckedChange={onToggleSelected} />
      </label>
      <span className="menu-product-row-drag" onClick={(event) => event.stopPropagation()}>{dragHandle}</span>
      <span className="menu-product-row-thumb" style={{ background: tintFor(item.id) }}>
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <I.menuDish size={15} />}
      </span>
      <span className="menu-product-row-main">
        <span style={{ minWidth: 0 }}>
          {categoryPath && <span className="menu-product-breadcrumb" style={{ display: 'block', color: 'var(--text-2)', fontSize: 10.5 }}>{categoryPath}</span>}
          <span className="menu-product-row-name">{highlight ? highlightText(item.name, highlight) : item.name}</span>
          {variantCount > 0 && <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}> · {variantCount} varyant</span>}
        </span>
        <span className="menu-product-row-price">₺{item.price}</span>
      </span>
      <span className="menu-product-row-status">
        <AvailabilitySwitch item={item} pending={pending} onToggle={onToggleAvailable} />
        <MenuMissingInfoBadge item={item} onOpenItem={onClick} />
      </span>
      <span className="menu-product-row-edit">
        <Button type="button" variant="ghost" size="sm" aria-label={`${item.name} ürününü düzenle`} onClick={(event) => { event.stopPropagation(); onClick() }}>
          <span className="menu-product-row-edit-text">Düzenle</span><I.chevRight data-icon="inline-end" />
        </Button>
      </span>
    </div>
  )
}

function EmptyProducts({
  filtered,
  searching,
  canAddProduct,
  onAddCategory,
  onAdd,
  onResetFilter,
  onClearSearch,
  onImport,
}: {
  filtered: boolean
  searching: boolean
  canAddProduct: boolean
  onAddCategory: () => void
  onAdd: () => void
  onResetFilter: () => void
  onClearSearch: () => void
  onImport: () => void
}) {
  const title = searching ? 'Aramayla eşleşen ürün yok' : filtered ? 'Bu filtrede ürün yok' : canAddProduct ? 'Bu kategoride henüz ürün yok' : 'Menün boş'
  const description = searching
    ? 'Başka bir ad dene ya da aramayı temizle.'
    : filtered
      ? 'Tüm ürünleri görüntüleyebilir veya yeni ürün ekleyebilirsin.'
      : canAddProduct
        ? 'Bir ürün ekle ya da başka bir ürünün kategorisini buraya değiştir.'
        : 'Henüz kategori veya ürün yok. Bir kategori oluşturup ilk ürününü ekle ya da elindeki menüyü CSV ile içe aktar. Bir şey yayınlanana kadar misafirler menüde hiçbir şey görmez.'
  return (
    <Empty className="min-h-80">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <I.menuDish />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {searching ? (
          <Button type="button" variant="outline" onClick={onClearSearch}>
            <I.close data-icon="inline-start" />
            Aramayı temizle
          </Button>
        ) : (
          <div className="flex justify-center gap-2">
            {filtered && (
              <Button type="button" variant="outline" onClick={onResetFilter}>
                Tümünü göster
              </Button>
            )}
            <Button type="button" onClick={canAddProduct ? onAdd : onAddCategory}>
              <I.plus data-icon="inline-start" />
              {canAddProduct ? (filtered ? 'Yeni ürün' : 'İlk ürünü ekle') : 'Kategori ekle'}
            </Button>
            {/* A menu that already exists elsewhere comes in faster as a CSV. */}
            {!filtered && (
              <Button type="button" variant="outline" onClick={onImport}>
                <I.upload data-icon="inline-start" />
                CSV içe aktar
              </Button>
            )}
          </div>
        )}
      </EmptyContent>
    </Empty>
  )
}

