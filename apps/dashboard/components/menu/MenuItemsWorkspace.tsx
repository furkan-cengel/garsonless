'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useEffect, useState } from 'react'
import type { Tables } from '@garsonless/db/types'
import { I } from '../../lib/ui'
import { highlightText, tintFor } from './menu-manager-utils'
import { MenuMissingInfoBadge } from './MenuMissingInfo'

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
  onQuickUpdate,
  pendingItemIds,
  structuralPending,
  editingItemId,
  onBulkAvailability,
  onBulkEdit,
  onBulkHistory,
  highlight,
  categories,
  onClearSearch,
}: {
  items: Tables<'menu_items'>[]
  activeCategory: Tables<'menu_categories'> | null
  subCategories: Tables<'menu_categories'>[]
  activeSubCat: string | null
  onSubCatChange: (id: string | null) => void
  selectedItem: Tables<'menu_items'> | null
  onSelectItem: (item: Tables<'menu_items'>) => void
  onAddCategory: () => void
  onAddItem: () => void
  pendingItemIds: ReadonlySet<string>
  structuralPending: boolean
  editingItemId?: string
  onQuickUpdate: (id: string, patch: { price?: number; is_available?: boolean }) => void
  onBulkEdit: (ids: string[]) => void
  onBulkHistory: () => void
  onBulkAvailability: (ids: string[], isAvailable: boolean) => Promise<boolean>
  highlight?: string
  categories: Tables<'menu_categories'>[]
  onClearSearch: () => void
}) {
  const canAddProduct = categories.length > 0
  const searching = Boolean(highlight)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [visibleCount, setVisibleCount] = useState(60)

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))))
  }, [items])

  useEffect(() => setVisibleCount(60), [filter, highlight, items])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const keepMobileGrid = () => {
      if (media.matches) setView('grid')
    }
    keepMobileGrid()
    media.addEventListener('change', keepMobileGrid)
    return () => media.removeEventListener('change', keepMobileGrid)
  }, [])

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

  const filtered = items.filter((item) => {
    if (filter === 'active') return item.is_available
    if (filter === 'inactive') return !item.is_available
    return true
  })

  const activeCount = items.filter((i) => i.is_available).length
  const inactiveCount = items.length - activeCount
  const hasSubCats = subCategories.length > 0
  const renderedItems = filtered.slice(0, visibleCount)
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
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <Button variant="outline" size="sm" disabled={structuralPending || !filtered.length} onClick={() => setSelectedIds(new Set(filtered.map(item => item.id)))}>Filtreye uyan tüm ürünleri seç ({filtered.length})</Button>
        <Button variant="ghost" size="sm" disabled={structuralPending} onClick={onBulkHistory}>İşlem geçmişi</Button>
      </div>
          {selectedIds.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexWrap: 'wrap',
                padding: 8,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                {selectedIds.size} seçili
              </span>
              <Button variant="default" size="sm" disabled={structuralPending || [...selectedIds].some(id => pendingItemIds.has(id))} onClick={() => onBulkEdit([...selectedIds])}>Toplu düzenle</Button>
              <Button className="menu-bulk-action" variant="outline" size="sm" type="button" disabled={structuralPending || [...selectedIds].some((id) => pendingItemIds.has(id) || id === editingItemId)} onClick={() => void applyBulkAvailability(true)}>
                Yayına al
              </Button>
              <Button className="menu-bulk-action" variant="outline" size="sm" type="button" disabled={structuralPending || [...selectedIds].some((id) => pendingItemIds.has(id) || id === editingItemId)} onClick={() => void applyBulkAvailability(false)}>
                Pasife al
              </Button>
              <Button
                className="menu-bulk-action menu-bulk-clear"
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="Seçimi temizle"
                onClick={() => setSelectedIds(new Set())}
              >
                <I.close />
              </Button>
            </div>
          )}
      {/* Toolbar */}
      <div
        className="menu-items-toolbar"
        style={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div className="menu-items-toolbar-heading" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div id="menu-products-heading" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>
              {searching ? 'Arama sonuçları' : activeCategory?.name ?? 'Tüm ürünler'}
            </div>
            <div className="menu-secondary-text" aria-live="polite" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
              {items.length} ürün · {activeCount} yayında
            </div>
          </div>
          <Badge variant="positive">
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: 'var(--positive)',
                display: 'inline-block',
              }}
            />
            Yayında
          </Badge>
        </div>

        <div className="menu-items-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Filter chips */}
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
                active: `Aktif ${activeCount}`,
                inactive: `Pasif ${inactiveCount}`,
              }
              return (
                <ToggleGroupItem className="menu-filter-button" key={f} value={f}>
                  {labels[f]}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>

          <div style={{ width: 1, height: 22, background: 'var(--border)' }} />

          {/* View toggle */}
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
      </div>

      <div className="menu-mobile-primary-row">
        <Button type="button" size="sm" onClick={searching ? onClearSearch : canAddProduct ? onAddItem : onAddCategory}>
          {searching ? <I.close data-icon="inline-start" /> : <I.plus data-icon="inline-start" />}
          {searching ? 'Aramayı temizle' : canAddProduct ? 'Yeni ürün' : 'Kategori ekle'}
        </Button>
      </div>

      {/* Sub-category tabs */}
      {hasSubCats && (
        <div
          className="menu-subcategory-tabs"
          style={{
            display: 'flex',
            gap: 4,
            padding: '8px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            overflow: 'auto',
            flexShrink: 0,
          }}
        >
          <Button
            onClick={() => onSubCatChange(null)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 999,
              cursor: 'pointer',
              background: activeSubCat === null ? 'var(--text)' : 'var(--surface-3)',
              color: activeSubCat === null ? 'var(--bg)' : 'var(--text-2)',
              border: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Tümü
          </Button>
          {subCategories.map((sc) => (
            <Button
              key={sc.id}
              onClick={() => onSubCatChange(sc.id)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 999,
                cursor: 'pointer',
                background: activeSubCat === sc.id ? 'var(--text)' : 'var(--surface-3)',
                color: activeSubCat === sc.id ? 'var(--bg)' : 'var(--text-2)',
                border: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {sc.name}
            </Button>
          ))}
        </div>
      )}

      {/* Items */}
      <div className="menu-items-scroll" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {filtered.length === 0 ? (
          <EmptyProducts
            filtered={items.length > 0}
            searching={Boolean(highlight)}
            canAddProduct={canAddProduct}
            onAddCategory={onAddCategory}
            onAdd={onAddItem}
            onResetFilter={() => setFilter('all')}
          />
        ) : view === 'grid' ? (
          <div
            role="list"
            aria-label={searching ? 'Arama sonuçları' : 'Ürünler'}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {renderedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                active={selectedItem?.id === item.id}
                onClick={() => onSelectItem(item)}
                pending={structuralPending || pendingItemIds.has(item.id) || editingItemId === item.id}
                onPriceUpdate={(p) => onQuickUpdate(item.id, { price: p })}
                onToggleAvailable={() => onQuickUpdate(item.id, { is_available: !item.is_available })}
                selectedForBulk={selectedIds.has(item.id)}
                onToggleSelected={() => toggleSelected(item.id)}
                highlight={highlight}
                categoryPath={searching ? categoryPath(item.category_id) : undefined}
              />
            ))}
            {!searching && <AddCard onClick={onAddItem} />}
          </div>
        ) : (
          <ItemsList items={renderedItems} selected={selectedItem} selectedIds={selectedIds} onToggleSelected={toggleSelected} onSelect={onSelectItem} highlight={highlight} categoryPath={searching ? categoryPath : undefined} />
        )}
        {visibleCount < filtered.length && (
          <div className="flex justify-center py-5">
            <Button type="button" variant="outline" onClick={() => setVisibleCount((current) => current + 60)}>
              Daha fazla ürün göster ({Math.min(visibleCount, filtered.length)}/{filtered.length})
            </Button>
          </div>
        )}
      </div>
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
      role="listitem"
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
        {!item.is_available && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(17,17,19,.85)',
              color: '#fff',
              fontSize: 9.5,
              fontWeight: 600,
              padding: '3px 7px',
              borderRadius: 999,
            }}
          >
            Pasif
          </span>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            background: hov ? 'rgba(0,0,0,.04)' : 'transparent',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 8,
            pointerEvents: 'none',
          }}
        >
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <Button
              type="button"
              aria-label={`${item.name} ürününü ${item.is_available ? 'pasife al' : 'aktife al'}`}
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation()
                onToggleAvailable?.()
              }}
              title={item.is_available ? 'Pasife al' : 'Aktife al'}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                pointerEvents: 'auto',
                background: item.is_available ? 'var(--surface)' : 'var(--warning-bg)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-1)',
                color: item.is_available ? 'var(--text-2)' : 'var(--warning)',
              }}
            >
              <I.eye size={13} />
            </Button>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
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
        {item.description && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-3)',
              marginTop: 3,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {highlight ? highlightText(item.description, highlight) : item.description}
          </div>
        )}
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
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <MenuMissingInfoBadge item={item} onOpenItem={onClick} />
            {Array.isArray(item.modifier_groups) && (item.modifier_groups as unknown[]).length > 0 && <Badge variant="secondary">Varyant</Badge>}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="menu-add-product-card"
      onClick={onClick}
      style={{
        aspectRatio: '4/3',
        minHeight: 200,
        background: 'transparent',
        border: '1.5px dashed var(--border-strong)',
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--text-3)',
      }}
    >
      <div
        className="menu-add-product-card-icon"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'var(--surface)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-2)',
        }}
      >
        <I.plus size={18} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500 }}>Yeni ürün ekle</span>
    </Button>
  )
}

function EmptyProducts({
  filtered,
  searching,
  canAddProduct,
  onAddCategory,
  onAdd,
  onResetFilter,
}: {
  filtered: boolean
  searching: boolean
  canAddProduct: boolean
  onAddCategory: () => void
  onAdd: () => void
  onResetFilter: () => void
}) {
  const title = searching ? 'Aramayla eşleşen ürün yok' : filtered ? 'Bu filtrede ürün yok' : canAddProduct ? 'Henüz ürün eklenmemiş' : 'Menünü oluşturmaya başla'
  const description = searching
    ? 'Farklı bir ürün adı veya kategori aramayı dene.'
    : filtered
      ? 'Tüm ürünleri görüntüleyebilir veya yeni ürün ekleyebilirsin.'
      : canAddProduct
        ? 'İlk ürününü ekleyerek menünü oluşturmaya başla.'
        : 'Ürün eklemeden önce ürünlerini gruplayacağın bir kategori oluştur.'
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
        {!searching && (
          <div className="flex justify-center gap-2">
            {filtered && (
              <Button type="button" variant="outline" onClick={onResetFilter}>
                Tümünü göster
              </Button>
            )}
            <Button type="button" onClick={canAddProduct ? onAdd : onAddCategory}>
              <I.plus data-icon="inline-start" />
              {canAddProduct ? 'Yeni ürün' : 'Kategori ekle'}
            </Button>
          </div>
        )}
      </EmptyContent>
    </Empty>
  )
}

function ItemsList({
  items,
  selected,
  selectedIds,
  onToggleSelected,
  onSelect,
  highlight,
  categoryPath,
}: {
  items: Tables<'menu_items'>[]
  selected: Tables<'menu_items'> | null
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
  onSelect: (item: Tables<'menu_items'>) => void
  highlight?: string
  categoryPath?: (categoryId: string) => string
}) {
  return (
    <div
      role="list"
      aria-label="Ürünler"
      style={{
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 40px 1fr 90px 70px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--divider)',
          background: 'var(--surface-2)',
          fontSize: 11,
          color: 'var(--text-3)',
          fontWeight: 500,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
        }}
      >
        <span />
        <span />
        <span>Ürün</span>
        <span>Fiyat</span>
        <span style={{ textAlign: 'right' }}>Durum</span>
      </div>
      {items.map((item) => {
        const tint = tintFor(item.id)
              return (
          <div
            key={item.id}
            role="listitem"
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr',
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: '1px solid var(--divider)',
              background: selected?.id === item.id ? 'var(--surface-inset)' : 'transparent',
            }}
          >
            <label
              style={{
                width: 24,
                height: 24,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <Checkbox aria-label={`${item.name} ürününü seç`} checked={selectedIds.has(item.id)} onCheckedChange={() => onToggleSelected(item.id)} />
            </label>
            <Button
              type="button"
              onClick={() => onSelect(item)}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 90px 70px',
                alignItems: 'center',
                width: '100%',
                padding: 0,
                border: 0,
                background: 'transparent',
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: tint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(17,17,19,.42)',
                }}
              >
                {Array.isArray(item.images) && (item.images as string[])[0] ? (
                  <img
                    src={(item.images as string[])[0]}
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: 6,
                    }}
                  />
                ) : (
                  <I.menuDish size={15} />
                )}
              </div>
              <div>
                {categoryPath ? (
                  <div className="menu-product-breadcrumb" style={{ color: 'var(--text-2)', fontSize: 10.5, marginBottom: 2 }}>
                    {categoryPath(item.category_id)}
                  </div>
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{highlight ? highlightText(item.name, highlight) : item.name}</span>
                  <MenuMissingInfoBadge item={item} />
                </div>
                {item.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      marginTop: 1,
                    }}
                  >
                    {highlight ? highlightText(item.description, highlight) : item.description}
                  </div>
                )}
              </div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>₺{item.price}</span>
              <span style={{ textAlign: 'right' }}>
                {!item.is_available && <Badge variant="secondary">Pasif</Badge>}
              </span>
            </Button>
          </div>
        )
      })}
    </div>
  )
}
