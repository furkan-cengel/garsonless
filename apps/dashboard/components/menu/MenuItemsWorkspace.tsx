'use client'

import { useEffect, useState } from 'react'
import type { Tables } from '@garsonless/db'
import { I, Tag, btnGhost, btnPrimary } from '../../lib/ui'
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

  const filtered = items.filter(item => {
    if (filter === 'active') return item.is_available
    if (filter === 'inactive') return !item.is_available
    return true
  })

  const activeCount = items.filter(i => i.is_available).length
  const inactiveCount = items.length - activeCount
  const hasSubCats = subCategories.length > 0

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>
              {activeCategory?.name ?? 'Tüm ürünler'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              {items.length} ürün · {activeCount} yayında
            </div>
          </div>
          <Tag tone="positive">
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)', display: 'inline-block' }} />
            Yayında
          </Tag>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 8, borderRight: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>{selectedIds.size} seçili</span>
              <button className="menu-bulk-action" type="button" onClick={() => void applyBulkAvailability(true)} style={btnGhost({ height: 28, padding: '0 8px' })}>Yayına al</button>
              <button className="menu-bulk-action" type="button" onClick={() => void applyBulkAvailability(false)} style={btnGhost({ height: 28, padding: '0 8px' })}>Pasife al</button>
              <button className="menu-bulk-action menu-bulk-clear" type="button" aria-label="Seçimi temizle" onClick={() => setSelectedIds(new Set())} style={btnGhost({ width: 28, height: 28, padding: 0, justifyContent: 'center' })}><I.close size={13} /></button>
            </div>
          )}
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'active', 'inactive'] as const).map((f) => {
              const labels = { all: `Tümü ${items.length}`, active: `Aktif ${activeCount}`, inactive: `Pasif ${inactiveCount}` }
              const isActive = filter === f
              return (
                <button type="button" className="menu-filter-button" key={f} aria-pressed={isActive} onClick={() => setFilter(f)} style={{
                  padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
                  background: isActive ? 'var(--surface-inset)' : 'transparent',
                  color: isActive ? 'var(--text)' : 'var(--text-2)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                  borderRadius: 6, cursor: 'pointer',
                }}>{labels[f]}</button>
              )
            })}
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--border)' }} />

          {/* View toggle */}
          <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 6, padding: 2 }}>
            {(['grid', 'list'] as const).map(v => (
              <button type="button" className="menu-view-button" key={v} aria-label={v === 'grid' ? 'Kart görünümü' : 'Liste görünümü'} aria-pressed={view === v} onClick={() => setView(v)} style={{
                width: 28, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer',
                background: view === v ? 'var(--surface)' : 'transparent',
                color: view === v ? 'var(--text)' : 'var(--text-3)',
                boxShadow: view === v ? 'var(--shadow-1)' : 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {v === 'grid' ? <I.grid size={13} /> : <I.section size={13} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-category tabs */}
      {hasSubCats && (
        <div style={{
          display: 'flex', gap: 4, padding: '8px 24px',
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
          overflow: 'auto', flexShrink: 0,
        }}>
          <button
            onClick={() => onSubCatChange(null)}
            style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 500, borderRadius: 999, cursor: 'pointer',
              background: activeSubCat === null ? 'var(--text)' : 'var(--surface-3)',
              color: activeSubCat === null ? 'var(--bg)' : 'var(--text-2)',
              border: 'none', whiteSpace: 'nowrap',
            }}
          >
            Tümü
          </button>
          {subCategories.map(sc => (
            <button
              key={sc.id}
              onClick={() => onSubCatChange(sc.id)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 500, borderRadius: 999, cursor: 'pointer',
                background: activeSubCat === sc.id ? 'var(--text)' : 'var(--surface-3)',
                color: activeSubCat === sc.id ? 'var(--bg)' : 'var(--text-2)',
                border: 'none', whiteSpace: 'nowrap',
              }}
            >
              {sc.name}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {filtered.length === 0 ? (
          <EmptyProducts
            filtered={items.length > 0}
            searching={Boolean(highlight)}
            onAdd={onAddItem}
            onResetFilter={() => setFilter('all')}
          />
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {filtered.map(item => (
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

function ItemCard({ item, active, onClick, onPriceUpdate, onToggleAvailable, selectedForBulk, onToggleSelected, highlight }: {
  item: Tables<'menu_items'>; active: boolean; onClick: () => void
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
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', borderRadius: 10,
        border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
        cursor: 'pointer', overflow: 'hidden', position: 'relative',
        boxShadow: active ? '0 0 0 3px rgba(17,17,19,.06)' : hov ? 'var(--shadow-2)' : 'var(--shadow-1)',
        transition: 'all 120ms', opacity: item.is_available ? 1 : 0.6,
      }}
    >
      <div style={{
        aspectRatio: '4/3', background: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', color: 'rgba(17,17,19,.34)',
      }}>
        <input
          type="checkbox"
          aria-label={`${item.name} ürününü seç`}
          checked={selectedForBulk}
          onChange={onToggleSelected}
          onClick={(event) => event.stopPropagation()}
          style={{ position: 'absolute', zIndex: 2, top: 9, left: 9, width: 18, height: 18, accentColor: 'var(--text)', cursor: 'pointer' }}
        />
        {(Array.isArray(item.images) && (item.images as string[])[0])
          ? <img src={(item.images as string[])[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          : <I.cutlery size={46} />}
        {!item.is_available && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(17,17,19,.85)', color: '#fff',
            fontSize: 9.5, fontWeight: 600, padding: '3px 7px', borderRadius: 999,
          }}>Pasif</span>
        )}
        {hov && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,.04)',
            display: 'flex', alignItems: 'flex-end', padding: 8,
          }}>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button
                onClick={e => { e.stopPropagation(); onToggleAvailable?.() }}
                title={item.is_available ? 'Pasife al' : 'Aktife al'}
                style={{
                  width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: item.is_available ? 'var(--surface)' : 'var(--warning-bg)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'var(--shadow-1)',
                  color: item.is_available ? 'var(--text-2)' : 'var(--warning)',
                }}
              ><I.eye size={13} /></button>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onClick() }}
          aria-label={`${item.name} ürününü düzenle`}
          style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}
        >
          {highlight ? highlightText(item.name, highlight) : item.name}
        </button>
        {item.description && (
          <div style={{
            fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{highlight ? highlightText(item.description, highlight) : item.description}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          {editingPrice ? (
            <input
              autoFocus
              type="number"
              value={priceVal}
              onChange={e => setPriceVal(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={e => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') setEditingPrice(false) }}
              onClick={e => e.stopPropagation()}
              style={{
                width: 72, padding: '2px 6px', fontWeight: 700, fontSize: 13,
                border: '1px solid var(--action)', borderRadius: 5, outline: 'none',
                background: 'var(--surface-2)', color: 'var(--text)',
                fontFamily: "'Geist Mono', monospace",
              }}
            />
          ) : (
            <span
              title="Düzenlemek için tıkla"
              onClick={e => { e.stopPropagation(); setEditingPrice(true); setPriceVal(String(item.price)) }}
              style={{ fontWeight: 700, fontSize: 14, cursor: 'text' }}
            >₺{item.price}</span>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {missingInfo.length > 0 && (
              <span title={`Eksik: ${missingInfo.join(', ')}`}><Tag tone="warning">{missingInfo.length} eksik</Tag></span>
            )}
            {Array.isArray(item.modifier_groups) && (item.modifier_groups as unknown[]).length > 0 && (
              <Tag tone="neutral">Varyant</Tag>
            )}
            <Tag tone={item.is_available ? 'positive' : 'neutral'}>{item.is_available ? 'Aktif' : 'Pasif'}</Tag>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="menu-add-product-card"
      onClick={onClick}
      style={{
        aspectRatio: '4/3', minHeight: 200,
        background: 'transparent', border: '1.5px dashed var(--border-strong)',
        borderRadius: 10, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text-3)',
      }}
    >
      <div className="menu-add-product-card-icon" style={{
        width: 36, height: 36, borderRadius: 999, background: 'var(--surface)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)',
      }}><I.plus size={18} /></div>
      <span style={{ fontSize: 12, fontWeight: 500 }}>Yeni ürün ekle</span>
    </button>
  )
}

function EmptyProducts({ filtered, searching, onAdd, onResetFilter }: {
  filtered: boolean
  searching: boolean
  onAdd: () => void
  onResetFilter: () => void
}) {
  const title = searching ? 'Aramayla eşleşen ürün yok' : filtered ? 'Bu filtrede ürün yok' : 'Henüz ürün eklenmemiş'
  const description = searching
    ? 'Farklı bir ürün adı veya kategori aramayı dene.'
    : filtered
      ? 'Tüm ürünleri görüntüleyebilir veya yeni ürün ekleyebilirsin.'
      : 'İlk ürününü ekleyerek menünü oluşturmaya başla.'
  return (
    <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ maxWidth: 320 }}>
        <span style={{ margin: '0 auto', width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-3)', color: 'var(--text-2)' }}><I.cutlery size={22} /></span>
        <h3 style={{ margin: '14px 0 0', fontSize: 15, color: 'var(--text)' }}>{title}</h3>
        <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)' }}>{description}</p>
        {!searching && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {filtered && <button type="button" onClick={onResetFilter} style={btnGhost()}>Tümünü göster</button>}
            <button type="button" onClick={onAdd} style={btnPrimary()}><I.plus size={13} />Yeni ürün</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ItemsList({ items, selected, selectedIds, onToggleSelected, onSelect, highlight }: {
  items: Tables<'menu_items'>[]
  selected: Tables<'menu_items'> | null
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
  onSelect: (item: Tables<'menu_items'>) => void
  highlight?: string
}) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '24px 40px 1fr 90px 70px',
        padding: '10px 14px', borderBottom: '1px solid var(--divider)',
        background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-3)',
        fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase',
      }}>
        <span />
        <span />
        <span>Ürün</span>
        <span>Fiyat</span>
        <span style={{ textAlign: 'right' }}>Durum</span>
      </div>
      {items.map(item => {
        const tint = tintFor(item.id)
        const missingInfo = getMissingProductInfo(item)
        return (
          <div
            key={item.id}
            style={{
              display: 'grid', gridTemplateColumns: '24px 1fr', alignItems: 'center',
              padding: '10px 14px', borderBottom: '1px solid var(--divider)',
              background: selected?.id === item.id ? 'var(--surface-inset)' : 'transparent',
            }}
          >
            <input type="checkbox" aria-label={`${item.name} ürününü seç`} checked={selectedIds.has(item.id)} onChange={() => onToggleSelected(item.id)} style={{ width: 16, height: 16, accentColor: 'var(--text)', cursor: 'pointer' }} />
            <button type="button" onClick={() => onSelect(item)} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 90px 70px', alignItems: 'center', width: '100%', padding: 0, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(17,17,19,.42)' }}>
              {(Array.isArray(item.images) && (item.images as string[])[0])
                ? <img src={(item.images as string[])[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                : <I.cutlery size={15} />}
              </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{highlight ? highlightText(item.name, highlight) : item.name}</span>
                {missingInfo.length > 0 && <span title={`Eksik: ${missingInfo.join(', ')}`}><Tag tone="warning">{missingInfo.length} eksik</Tag></span>}
              </div>
              {item.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{highlight ? highlightText(item.description, highlight) : item.description}</div>}
            </div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>₺{item.price}</span>
            <span style={{ textAlign: 'right' }}>
              <Tag tone={item.is_available ? 'positive' : 'neutral'}>{item.is_available ? 'Aktif' : 'Pasif'}</Tag>
            </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
