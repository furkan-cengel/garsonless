'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import type { Tables } from '@garsonless/db'
import PageTopBar from '../layout/PageTopBar'
import NewProductDrawer from './NewProductDrawer'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import NutritionFields, { nutritionFromItem, appendNutritionToFormData, applyNutritionPatch, NutritionStatusPill } from './NutritionFields'
import type { NutritionState } from './NutritionFields'
import { I, S, Tag, btnPrimary, btnGhost } from '../../lib/ui'
import { useRouter } from 'next/navigation'
import { InlineSpinner } from '@garsonless/ui'
import { deleteItem, deleteCategory, updateItem, reorderCategories, setMenuItemsAvailability } from '../../lib/actions/menu'
import { createDashboardBrowserClient } from '../../lib/supabase'
import {
  ALLERGEN_CODES,
  ALLERGEN_LABELS,
  calculateMarginPercent,
  type AllergenCode,
  type MenuModifierGroup as ModifierGroup,
  type MenuModifierOption as ModifierOption,
} from '@garsonless/db/browser'
import { getMissingProductInfo, highlightText, normalizeGroups, tintFor } from './menu-manager-utils'
import { CsvImportModal, CsvImportStartModal } from './MenuCsvImportOverlays'
import { useMenuCsvImport } from './use-menu-csv-import'
import { deriveMenuManagerView } from './menu-manager-view-model'
import { MenuCategoryWorkspace } from './MenuCategoryWorkspace'
import { MenuConfirmDialog } from './MenuConfirmDialog'
import { collectCategoryTreeIds } from './menu-category-workspace-model'
import { isMenuItemEditorDirty, type MenuItemEditorSnapshot } from './menu-item-editor-model'
import { MenuItemEditorFrame } from './MenuItemEditorFrame'

const VAT_RATE_PRESETS = [1, 10, 20]

function AllergenPicker({
  value,
  onChange,
  label = 'Alerjen ekle',
}: {
  value: AllergenCode[]
  onChange: (value: AllergenCode[]) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function toggle(code: AllergenCode) {
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code])
  }

  function toggleOpen() {
    if (!open) {
      const rect = rootRef.current?.getBoundingClientRect()
      setDropUp(Boolean(rect && rect.bottom + 245 > window.innerHeight - 12))
    }
    setOpen((current) => !current)
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        style={{
          width: '100%', minHeight: 34, padding: value.length > 0 ? '5px 8px' : '0 10px',
          border: `1px solid ${open ? 'var(--text)' : 'var(--divider)'}`,
          borderRadius: 7, background: 'var(--surface)', color: 'var(--text)',
          display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
          cursor: 'pointer', boxShadow: open ? '0 0 0 2px rgba(17,17,19,.06)' : 'none',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {value.length === 0 ? (
            <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{label}</span>
          ) : value.map((code) => (
            <span key={code} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              maxWidth: '100%', padding: '2px 6px', borderRadius: 5,
              background: 'var(--warning-bg)', color: 'var(--warning)',
              fontSize: 10.5, fontWeight: 600,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ALLERGEN_LABELS[code]}</span>
              <span
                role="button"
                aria-label={`${ALLERGEN_LABELS[code]} seçimini kaldır`}
                onClick={(event) => { event.stopPropagation(); toggle(code) }}
                style={{ display: 'inline-flex', cursor: 'pointer', flexShrink: 0 }}
              >
                <I.close size={10} />
              </span>
            </span>
          ))}
        </span>
        <I.chevDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'absolute', zIndex: 50, left: 0, right: 0,
            ...(dropUp ? { bottom: 'calc(100% + 5px)' } : { top: 'calc(100% + 5px)' }),
            maxHeight: 238, overflowY: 'auto', padding: 5,
            border: '1px solid var(--border-strong)', borderRadius: 8,
            background: 'var(--surface)', boxShadow: 'var(--shadow-pop)',
          }}
        >
          {ALLERGEN_CODES.map((code) => {
            const selected = value.includes(code)
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(code)}
                style={{
                  width: '100%', minHeight: 32, padding: '6px 8px',
                  border: 'none', borderRadius: 5, background: selected ? 'var(--surface-inset)' : 'transparent',
                  color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8,
                  textAlign: 'left', cursor: 'pointer', fontSize: 11.5,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${selected ? 'var(--text)' : 'var(--border-strong)'}`,
                  background: selected ? 'var(--text)' : 'var(--surface)',
                  color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <I.check size={10} strokeWidth={3} />}
                </span>
                <span>{ALLERGEN_LABELS[code]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   MODIFIER GROUP EDITOR
   ============================================================ */
function ModifierGroupEditor({
  groups,
  onChange,
}: {
  groups: ModifierGroup[]
  onChange: (groups: ModifierGroup[]) => void
}) {
  const inputSm: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 5, border: '1px solid var(--divider)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: 12, outline: 'none',
  }

  function addGroup() {
    onChange([...groups, {
      id: crypto.randomUUID(),
      name: '',
      selection_mode: 'multiple',
      required: false,
      min: 0,
      max: 1,
      options: [],
    }])
  }

  function deleteGroup(gid: string) {
    onChange(groups.filter(g => g.id !== gid))
  }

  function updateGroup(gid: string, patch: Partial<Omit<ModifierGroup, 'id' | 'options'>>) {
    onChange(groups.map(g => g.id === gid ? { ...g, ...patch } : g))
  }

  function addOption(gid: string) {
    onChange(groups.map(g =>
      g.id === gid
        ? {
            ...g,
            max: Math.max(g.max, g.options.length + 1),
            options: [...g.options, {
              id: crypto.randomUUID(),
              name: '',
              price_delta: 0,
              calorie_delta: 0,
              is_default: false,
              allergen_codes: [],
            }],
          }
        : g,
    ))
  }

  function deleteOption(gid: string, oid: string) {
    onChange(groups.map(g =>
      g.id === gid ? { ...g, options: g.options.filter(o => o.id !== oid) } : g,
    ))
  }

  function updateOption(gid: string, oid: string, patch: Partial<Omit<ModifierOption, 'id'>>) {
    onChange(groups.map(g =>
      g.id === gid
        ? { ...g, options: g.options.map(o => o.id === oid ? { ...o, ...patch } : o) }
        : g,
    ))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', paddingBottom: 4 }}>Henüz varyant grubu yok</div>
      )}

      {groups.map((g, gi) => (
        <div key={g.id} style={{
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--surface-2)', overflow: 'hidden',
        }}>
          {/* Group header */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 7,
            padding: '8px 10px', borderBottom: g.options.length > 0 ? '1px solid var(--divider)' : 'none',
            background: 'var(--surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <input
                value={g.name}
                onChange={e => updateGroup(g.id, { name: e.target.value })}
                placeholder={`Grup ${gi + 1} adı`}
                style={{ ...inputSm, flex: 1, minWidth: 0, height: 32, fontWeight: 600 }}
              />
              <button
                type="button"
                onClick={() => deleteGroup(g.id)}
                style={{
                  width: 30, height: 30, border: '1px solid var(--critical-bg)', borderRadius: 6, cursor: 'pointer',
                  background: 'var(--surface)', color: 'var(--critical)', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Grubu sil"
              >
                <I.trash size={13} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 6, alignItems: 'center' }}>
              <select
                value={g.selection_mode}
                onChange={(event) => updateGroup(g.id, {
                  selection_mode: event.target.value as ModifierGroup['selection_mode'],
                  max: event.target.value === 'single' ? 1 : Math.max(g.max, 1),
                })}
                style={{ ...inputSm, width: '100%', height: 30 }}
              >
                <option value="single">Tek seçim</option>
                <option value="multiple">Çoklu seçim</option>
                <option value="quantity">Adetli seçim</option>
              </select>
              <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 6, padding: 2, gap: 1 }}>
                {([true, false] as const).map(required => (
                  <button
                    key={String(required)}
                    type="button"
                    onClick={() => updateGroup(g.id, {
                      required,
                      min: required ? Math.max(1, g.min) : 0,
                    })}
                    style={{
                      height: 24, padding: '0 7px', fontSize: 10, fontWeight: 600, borderRadius: 4,
                      border: 'none', cursor: 'pointer',
                      background: g.required === required ? 'var(--surface)' : 'transparent',
                      color: g.required === required ? 'var(--text)' : 'var(--text-3)',
                      boxShadow: g.required === required ? 'var(--shadow-1)' : 'none',
                    }}
                  >
                    {required ? 'Zorunlu' : 'Opsiyonel'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Options */}
          <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                En az
                <input type="number" min={0} value={g.min} onChange={(event) => updateGroup(g.id, { min: Math.max(0, Number(event.target.value)) })} style={{ ...inputSm, width: '100%', height: 30, marginTop: 3 }} />
              </label>
              <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                En fazla
                <input type="number" min={1} value={g.max} onChange={(event) => updateGroup(g.id, { max: Math.max(1, Number(event.target.value)) })} style={{ ...inputSm, width: '100%', height: 30, marginTop: 3 }} />
              </label>
            </div>
            {g.options.map(o => (
              <div key={o.id} style={{
                padding: 8, border: '1px solid var(--divider)', borderRadius: 7,
                background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 7,
                minWidth: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <input
                    value={o.name}
                    onChange={e => updateOption(g.id, o.id, { name: e.target.value })}
                    placeholder="İşletmenin ekleyeceği seçenek"
                    style={{ ...inputSm, flex: 1, minWidth: 0, height: 31 }}
                  />
                  <button
                    type="button"
                    onClick={() => deleteOption(g.id, o.id)}
                    style={{
                      width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer',
                      background: 'var(--critical-bg)', color: 'var(--critical)', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Seçeneği sil"
                  >
                    <I.trash size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    Fiyat farkı
                    <input
                      aria-label="Fiyat farkı"
                      type="number" min={0} value={o.price_delta}
                      onChange={e => updateOption(g.id, o.id, { price_delta: Math.max(0, Number(e.target.value)) })}
                      style={{ ...inputSm, width: '100%', height: 30, marginTop: 3, fontFamily: "'Geist Mono', monospace" }}
                    />
                  </label>
                  <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    Kalori farkı
                    <input
                      aria-label="Kalori farkı"
                      type="number" value={o.calorie_delta}
                      onChange={e => updateOption(g.id, o.id, { calorie_delta: Math.round(Number(e.target.value)) })}
                      style={{ ...inputSm, width: '100%', height: 30, marginTop: 3, fontFamily: "'Geist Mono', monospace" }}
                    />
                  </label>
                </div>
                <AllergenPicker
                  value={o.allergen_codes}
                  onChange={(codes) => updateOption(g.id, o.id, { allergen_codes: codes })}
                  label="Bu seçeneğe alerjen ekle"
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={o.is_default}
                    onChange={(event) => updateOption(g.id, o.id, { is_default: event.target.checked })}
                  />
                  Varsayılan seçenek
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px',
                border: '1px dashed var(--border)', background: 'transparent',
                color: 'var(--text-3)', borderRadius: 5, cursor: 'pointer',
                fontSize: 11.5, fontWeight: 500, marginTop: 2,
              }}
            >
              <I.plus size={10} />Seçenek ekle
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
          border: '1px dashed var(--border-strong)', background: 'transparent',
          color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 500,
        }}
      >
        <I.plus size={13} />Yeni grup ekle
      </button>
    </div>
  )
}
/* ============================================================
   ITEMS CANVAS
   ============================================================ */
function ItemsCanvas({
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

/* ============================================================
   ITEM EDIT PANEL
   ============================================================ */
function ItemEditPanel({
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

  const inputStyle: React.CSSProperties = {
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
          <ModifierGroupEditor groups={modifiers} onChange={(next) => { setModifiers(next); setN({ reviewed: false }) }} />
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

function EmptyPanel() {
  return (
    <div style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center', color: 'var(--text-3)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, background: 'var(--surface-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-2)', marginBottom: 14,
      }}><I.cutlery size={24} /></div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Bir ürün seç</div>
      <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 220 }}>
        Düzenlemek istediğin ürünü tıkla.
      </div>
    </div>
  )
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ ...S.label, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', width: 80, flexShrink: 0, paddingTop: 6 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function FieldInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

/* ============================================================
   TOAST
   ============================================================ */
function Toast({ message, tone = 'error', onDone }: { message: string; tone?: 'error' | 'success'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: tone === 'success' ? 'var(--positive)' : 'var(--critical)', color: '#fff',
      padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: 'var(--shadow-pop)', zIndex: 200, pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  )
}

/* ============================================================
   MAIN
   ============================================================ */
interface Props {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  initialCategories: Tables<'menu_categories'>[]
  initialItems: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
}

function SkeletonGrid() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-3) 0%, var(--surface-inset) 50%, var(--surface-3) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer-bg 1.4s ease-in-out infinite',
  }
  const skel = (style: React.CSSProperties) => <div style={{ borderRadius: 7, ...shimmer, ...style }} />
  return (
    <div className="menu-manager" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        height: 52,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {skel({ width: 26, height: 26 })}
          {skel({ width: 86, height: 13 })}
          {skel({ width: 1, height: 28, borderRadius: 0 })}
          {skel({ width: 120, height: 24 })}
          {skel({ width: 44, height: 12 })}
        </div>
        {skel({ width: 420, maxWidth: '34vw', minWidth: 300, height: 32 })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {skel({ width: 84, height: 30 })}
          {skel({ width: 78, height: 30 })}
          {skel({ width: 92, height: 30 })}
          {skel({ width: 30, height: 30 })}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 'var(--nav)', flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
            {skel({ width: 118, height: 16 })}
            {skel({ width: 148, height: 11, marginTop: 10 })}
          </div>
          <div style={{ flex: 1, padding: '18px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 39, width: '100%', borderRadius: 7, ...shimmer }} />
            ))}
            {skel({ height: 35, width: '100%', marginTop: 10, background: 'transparent', border: '1px dashed var(--border-strong)' })}
          </div>
          <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {skel({ width: '100%', height: 10 })}
            {skel({ width: '92%', height: 10 })}
            {skel({ width: '78%', height: 10 })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          <div style={{ height: 56, flexShrink: 0, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div>
              {skel({ width: 106, height: 18 })}
              {skel({ width: 132, height: 11, marginTop: 8 })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {skel({ width: 72, height: 30 })}
              {skel({ width: 72, height: 30 })}
              {skel({ width: 58, height: 30 })}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, overflow: 'hidden' }}>
                  {skel({ width: '100%', height: 'auto', aspectRatio: '4 / 3', borderRadius: 0 })}
                  <div style={{ padding: '10px 12px 12px' }}>
                    {skel({ width: '64%', height: 14 })}
                    {skel({ width: '38%', height: 14, marginTop: 16 })}
                  </div>
                </div>
              ))}
              <div style={{ aspectRatio: '4 / 3', minHeight: 200, border: '1.5px dashed var(--border-strong)', borderRadius: 10 }} />
            </div>
          </div>
        </div>
        <div style={{ width: 'var(--props)', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
          {skel({ width: 56, height: 56, borderRadius: 14 })}
          {skel({ width: 116, height: 14 })}
          {skel({ width: 194, height: 12 })}
        </div>
      </div>
    </div>
  )
}

export default function MenuManager({ restaurantId, restaurantName, restaurantSlug, initialCategories, initialItems, kitchenStations }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [categories, setCategories] = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialCategories.find(c => !c.parent_id)?.id ?? null,
  )
  const [activeSubCat, setActiveSubCat] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<Tables<'menu_items'> | null>(null)
  const [itemEditDirty, setItemEditDirty] = useState(false)
  const [pendingEditorExit, setPendingEditorExit] = useState<(() => void) | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [, startTransition] = useTransition()
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const showError = useCallback((msg: string) => { setToastMsg(msg); setToastTone('error') }, [])
  const showSuccess = useCallback((msg: string) => { setToastMsg(msg); setToastTone('success') }, [])
  const csvImport = useMenuCsvImport({
    restaurantId,
    categories,
    items,
    onCategoriesCreated: (createdCategories) => {
      setCategories((current) => [...current, ...createdCategories])
    },
    onComplete: (message, tone) => {
      setToastMsg(message)
      setToastTone(tone)
    },
    onRefresh: () => router.refresh(),
  })

  function requestEditorExit(action: () => void) {
    if (!itemEditDirty) action()
    else setPendingEditorExit(() => action)
  }

  function selectItem(item: Tables<'menu_items'>) {
    if (selectedItem?.id === item.id) return
    requestEditorExit(() => setSelectedItem(item))
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleSelectCategory(id: string) {
    requestEditorExit(() => {
      const cat = categories.find(c => c.id === id)
      if (cat?.parent_id) {
        // sub-cat selected from nav: keep the top-level cat as active, set sub-cat tab
        setActiveCategory(cat.parent_id)
        setActiveSubCat(id)
      } else {
        setActiveCategory(id)
        setActiveSubCat(null)
      }
      setSelectedItem(null)
    })
  }

  function handleDeleteCategory(id: string) {
    const catSnap = [...categories]
    const itemsSnap = [...items]
    const prevActive = activeCategory

    const cat = categories.find(c => c.id === id)
    const allDeletedIds = collectCategoryTreeIds(categories, id)

    setCategories(prev => prev.filter(c => !allDeletedIds.includes(c.id)))
    setItems(prev => prev.filter(i => !allDeletedIds.includes(i.category_id)))
    if (prevActive && allDeletedIds.includes(prevActive)) {
      const remaining = catSnap.filter(c => !allDeletedIds.includes(c.id) && !c.parent_id)
      setActiveCategory(remaining.find(c => c.id !== (cat?.parent_id ?? id))?.id ?? remaining[0]?.id ?? null)
    }
    setActiveSubCat(null)

    startTransition(async () => {
      const result = await deleteCategory(id, restaurantId)
      if ('error' in result) {
        setCategories(catSnap)
        setItems(itemsSnap)
        setActiveCategory(prevActive)
        showError(result.error)
      } else {
        showSuccess('Kategori silindi')
      }
    })
  }

  function handleCategoriesReordered(reordered: Tables<'menu_categories'>[]) {
    const snapshot = [...categories]
    setCategories(reordered)
    startTransition(async () => {
      const topLevelIds = reordered.filter(c => !c.parent_id).map(c => c.id)
      const result = await reorderCategories(restaurantId, topLevelIds)
      if ('error' in result) {
        setCategories(snapshot)
        showError(result.error)
      } else {
        showSuccess('Kategori sırası kaydedildi')
      }
    })
  }

  function handleQuickUpdate(id: string, patch: { price?: number; is_available?: boolean }) {
    const original = items.find(i => i.id === id)
    if (!original) return
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    setSelectedItem(prev => prev?.id === id ? { ...prev, ...patch } : prev)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('id', id)
      fd.append('restaurantId', restaurantId)
      if (patch.price !== undefined) fd.append('price', String(patch.price))
      if (patch.is_available !== undefined) fd.append('is_available', String(patch.is_available))
      const result = await updateItem(fd)
      if ('error' in result) {
        setItems(prev => prev.map(i => i.id === id ? original : i))
        setSelectedItem(prev => prev?.id === id ? original : prev)
        showError(result.error)
      } else {
        setItems(prev => prev.map(i => i.id === id ? result.item : i))
        setSelectedItem(prev => prev?.id === id ? result.item : prev)
        showSuccess(patch.is_available === undefined ? 'Fiyat güncellendi' : patch.is_available ? 'Ürün yayına alındı' : 'Ürün pasife alındı')
      }
    })
  }

  async function handleBulkAvailability(ids: string[], isAvailable: boolean) {
    const snapshot = [...items]
    setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, is_available: isAvailable } : item))
    const result = await setMenuItemsAvailability(restaurantId, ids, isAvailable)
    if ('error' in result) {
      setItems(snapshot)
      showError(result.error)
      return false
    }
    setSelectedItem((current) => current && ids.includes(current.id) ? { ...current, is_available: isAvailable } : current)
    showSuccess(`${ids.length} ürün ${isAvailable ? 'yayına alındı' : 'pasife alındı'}`)
    return true
  }

  if (!mounted) return <SkeletonGrid />

  const {
    activeCategory: activeCat,
    subCategories: subCatsOfActive,
    visibleItems,
    searchMatchedCategoryIds,
    activeCategoryForPanel: activeCatForPanel,
    navigationActiveId: navActiveId,
  } = deriveMenuManagerView({
    categories,
    items,
    activeCategoryId: activeCategory,
    activeSubCategoryId: activeSubCat,
    selectedItem,
    search,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageTopBar
        restaurantName={restaurantName}
        title="Menü"
        center={
          <div style={{
            width: 'min(420px, 34vw)', minWidth: 300, display: 'flex', alignItems: 'center', gap: 8,
            height: 32, padding: '0 12px',
            background: 'var(--surface-3)', borderRadius: 8, color: 'var(--text-3)',
          }}>
            <I.search size={14} />
            <input
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Ürün veya kategori ara"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }}
            />
            {!search && !searchFocused && (
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
                {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}
              </span>
            )}
          </div>
        }
        right={
          <>
            <input
              ref={csvImport.fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={csvImport.handleFileChange}
            />
            <button
              className="menu-top-action menu-top-action-secondary"
              style={btnGhost({ whiteSpace: 'nowrap' })}
              onClick={csvImport.openStart}
            >
              <I.upload size={13} />İçe aktar
            </button>
            <button
              className="menu-top-action menu-top-action-secondary"
              style={btnGhost({ whiteSpace: 'nowrap' })}
              onClick={() => window.open(`${process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'}/${restaurantSlug}`, '_blank')}
            >
              <I.eye size={13} />Önizle
            </button>
            <button className="menu-top-action menu-top-action-primary" style={btnPrimary({ whiteSpace: 'nowrap' })} onClick={() => setShowAddItem(true)}><I.plus size={13} />Yeni ürün</button>
          </>
        }
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <MenuCategoryWorkspace
          categories={categories}
          items={items}
          kitchenStations={kitchenStations}
          activeId={navActiveId}
          restaurantId={restaurantId}
          visibleCategoryIds={searchMatchedCategoryIds}
          onSelect={handleSelectCategory}
          onCategoryAdded={(cat) => {
            setCategories(prev => [...prev, cat])
            if (!cat.parent_id) {
              setActiveCategory(cat.id)
              setActiveSubCat(null)
            } else {
              setActiveCategory(cat.parent_id)
              setActiveSubCat(cat.id)
            }
          }}
          onCategoryUpdated={(cat) => {
            setCategories(prev => prev.map(current => current.id === cat.id ? cat : current))
          }}
          onCategoryDeleted={handleDeleteCategory}
          onCategoriesReordered={handleCategoriesReordered}
        />

        <ItemsCanvas
          items={visibleItems}
          activeCategory={activeCat}
          subCategories={subCatsOfActive}
          activeSubCat={activeSubCat}
          onSubCatChange={(id) => {
            requestEditorExit(() => {
              setActiveSubCat(id)
              setSelectedItem(null)
            })
          }}
          selectedItem={selectedItem}
          onSelectItem={selectItem}
          onAddItem={() => setShowAddItem(true)}
          onQuickUpdate={handleQuickUpdate}
          onBulkAvailability={handleBulkAvailability}
          highlight={search || undefined}
        />

        {selectedItem ? (
          <ItemEditPanel
            key={selectedItem.id}
            item={selectedItem}
            categoryName={activeCatForPanel?.name ?? ''}
            categoryVatRate={Number(activeCatForPanel?.vat_rate ?? 10)}
            categoryStationId={activeCatForPanel?.kitchen_station_id ?? null}
            kitchenStations={kitchenStations}
            restaurantId={restaurantId}
            onClose={() => {
              requestEditorExit(() => setSelectedItem(null))
            }}
            onSaved={(updated) => {
              setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
              setSelectedItem(updated)
            }}
            onDeleted={(id) => {
              setItems(prev => prev.filter(i => i.id !== id))
              setSelectedItem(null)
            }}
            onError={showError}
            onDirtyChange={setItemEditDirty}
          />
        ) : (
          <EmptyPanel />
        )}
      </div>

      {toastMsg && <Toast message={toastMsg} tone={toastTone} onDone={() => setToastMsg(null)} />}

      {pendingEditorExit && (
        <UnsavedChangesDialog
          description="Bu üründe yaptığın değişiklikler henüz kaydedilmedi. Çıkarsan değişiklikler kalıcı olarak silinecek."
          onKeepEditing={() => setPendingEditorExit(null)}
          onDiscard={() => {
            const action = pendingEditorExit
            setPendingEditorExit(null)
            setItemEditDirty(false)
            action()
          }}
        />
      )}

      {csvImport.showStart && (
        <CsvImportStartModal
          error={csvImport.setupError}
          onChoose={csvImport.chooseFile}
          onFile={csvImport.parseFile}
          onCancel={csvImport.closeStart}
          onDownloadTemplate={csvImport.downloadTemplate}
        />
      )}

      {csvImport.preview && (
        <CsvImportModal
          preview={csvImport.preview}
          onConfirm={csvImport.importPreview}
          onCancel={csvImport.cancelPreview}
          onDownloadTemplate={csvImport.downloadTemplate}
        />
      )}

      {showAddItem && (activeSubCat ?? activeCategory) && (
        <NewProductDrawer
          restaurantId={restaurantId}
          categoryId={(activeSubCat ?? activeCategory)!}
          categoryName={categories.find((c) => c.id === (activeSubCat ?? activeCategory))?.name ?? 'Kategori'}
          categoryStationId={categories.find((c) => c.id === (activeSubCat ?? activeCategory))?.kitchen_station_id ?? null}
          kitchenStations={kitchenStations}
          onCreated={(item) => {
            setItems(prev => [...prev, item])
            setShowAddItem(false)
            setSelectedItem(item)
          }}
          onClose={() => setShowAddItem(false)}
        />
      )}
    </div>
  )
}
