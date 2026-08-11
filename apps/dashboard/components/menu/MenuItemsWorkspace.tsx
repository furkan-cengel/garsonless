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
import { getMissingProductInfo, highlightText, tintFor } from './menu-manager-utils'

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
  canAddProduct,
  onAddCategory,
  onAddItem,
  onQuickUpdate,
  onBulkAvailability,
  highlight,
}: {
  items: Tables<'menu_items'>[]
  activeCategory: Tables<'menu_categories'> | null
  subCategories: Tables<'menu_categories'>[]
  activeSubCat: string | null
  onSubCatChange: (id: string | null) => void
  selectedItem: Tables<'menu_items'> | null
  onSelectItem: (item: Tables<'menu_items'>) => void
  canAddProduct: boolean
  onAddCategory: () => void
  onAddItem: () => void
  onQuickUpdate: (id: string, patch: { price?: number; is_available?: boolean }) => void
  onBulkAvailability: (ids: string[], isAvailable: boolean) => Promise<boolean>
  highlight?: string
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))))
  }, [items])

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

  return (
    <div
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
      {/* Toolbar */}
      <div
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>{activeCategory?.name ?? 'Tüm ürünler'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedIds.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                paddingRight: 8,
                borderRight: '1px solid var(--border)',
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
              <Button className="menu-bulk-action" variant="outline" size="sm" type="button" onClick={() => void applyBulkAvailability(true)}>
                Yayına al
              </Button>
              <Button className="menu-bulk-action" variant="outline" size="sm" type="button" onClick={() => void applyBulkAvailability(false)}>
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
          {/* Filter chips */}
          <ToggleGroup
            value={[filter]}
            onValueChange={(values) => {
              const next = values[0] as typeof filter | undefined
              if (next) setFilter(next)
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

      {/* Sub-category tabs */}
      {hasSubCats && (
        <div
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
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
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
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                active={selectedItem?.id === item.id}
                onClick={() => onSelectItem(item)}
                onPriceUpdate={(p) => onQuickUpdate(item.id, { price: p })}
                onToggleAvailable={() => onQuickUpdate(item.id, { is_available: !item.is_available })}
                selectedForBulk={selectedIds.has(item.id)}
                onToggleSelected={() => toggleSelected(item.id)}
                highlight={highlight}
              />
            ))}
            <AddCard onClick={onAddItem} />
          </div>
        ) : (
          <ItemsList items={filtered} selected={selectedItem} selectedIds={selectedIds} onToggleSelected={toggleSelected} onSelect={onSelectItem} highlight={highlight} />
        )}
      </div>
    </div>
  )
}

function ItemCard({
  item,
  active,
  onClick,
  onPriceUpdate,
  onToggleAvailable,
  selectedForBulk,
  onToggleSelected,
  highlight,
}: {
  item: Tables<'menu_items'>
  active: boolean
  onClick: () => void
  onPriceUpdate?: (price: number) => void
  onToggleAvailable?: () => void
  selectedForBulk: boolean
  onToggleSelected: () => void
  highlight?: string
}) {
  const [hov, setHov] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceVal, setPriceVal] = useState(String(item.price))
  const tint = tintFor(item.id)
  const missingInfo = getMissingProductInfo(item)

  function commitPrice() {
    const n = Number(priceVal)
    if (!isNaN(n) && n > 0 && n !== item.price) onPriceUpdate?.(n)
    setEditingPrice(false)
  }
  return (
    <div
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
          <I.cutlery size={46} />
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
            {missingInfo.length > 0 && (
              <span title={`Eksik: ${missingInfo.join(', ')}`}>
                <Badge variant="warning">{missingInfo.length} eksik</Badge>
              </span>
            )}
            {Array.isArray(item.modifier_groups) && (item.modifier_groups as unknown[]).length > 0 && <Badge variant="secondary">Varyant</Badge>}
            <Badge variant={item.is_available ? 'positive' : 'secondary'}>{item.is_available ? 'Aktif' : 'Pasif'}</Badge>
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
          <I.cutlery />
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
}: {
  items: Tables<'menu_items'>[]
  selected: Tables<'menu_items'> | null
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
  onSelect: (item: Tables<'menu_items'>) => void
  highlight?: string
}) {
  return (
    <div
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
        const missingInfo = getMissingProductInfo(item)
        return (
          <div
            key={item.id}
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
                  <I.cutlery size={15} />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{highlight ? highlightText(item.name, highlight) : item.name}</span>
                  {missingInfo.length > 0 && (
                    <span title={`Eksik: ${missingInfo.join(', ')}`}>
                      <Badge variant="warning">{missingInfo.length} eksik</Badge>
                    </span>
                  )}
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
                <Badge variant={item.is_available ? 'positive' : 'secondary'}>{item.is_available ? 'Aktif' : 'Pasif'}</Badge>
              </span>
            </Button>
          </div>
        )
      })}
    </div>
  )
}
