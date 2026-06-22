'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Tables } from '@garsonless/db'
import PageTopBar from '../layout/PageTopBar'
import CategoryForm from './CategoryForm'
import ItemForm from './ItemForm'
import { I, S, Tag, IconButton, btnPrimary, btnGhost } from '../../lib/ui'
import { useRouter } from 'next/navigation'
import { InlineSpinner, BrewBar } from '@garsonless/ui'
import { deleteItem, deleteCategory, updateItem, reorderCategories, createCategory, createItem } from '../../lib/actions/menu'
import { createDashboardBrowserClient } from '../../lib/supabase'
import Papa from 'papaparse'

/* ============================================================
   TINT PALETTE — deterministic from id
   ============================================================ */
const TINTS = ['#fce8d3', '#fde7c2', '#dcf0e1', '#fbd3c1', '#f5dcea', '#e7e3f0', '#d3eafc', '#e7f0dc']
function tintFor(id: string): string {
  return TINTS[id.charCodeAt(0) % TINTS.length] ?? TINTS[0]!
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const lowerQ = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let last = 0
  let idx = lower.indexOf(lowerQ)
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx))
    parts.push(
      <mark key={idx} style={{ background: 'var(--accent-2)', color: 'var(--ink)', borderRadius: 2, padding: 0 }}>
        {text.slice(idx, idx + query.length)}
      </mark>,
    )
    last = idx + query.length
    idx = lower.indexOf(lowerQ, last)
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

/* ============================================================
   MODIFIER TYPES
   ============================================================ */
interface ModifierOption {
  id: string
  name: string
  price_delta: number
}
interface ModifierGroup {
  id: string
  name: string
  type: 'required' | 'optional'
  options: ModifierOption[]
}

function normalizeGroups(raw: unknown): ModifierGroup[] {
  if (!Array.isArray(raw)) return []
  return (raw as Array<Record<string, unknown>>).map(g => ({
    id: typeof g['id'] === 'string' ? g['id'] : crypto.randomUUID(),
    name: typeof g['name'] === 'string' ? g['name'] : '',
    type: g['type'] === 'required' || g['type'] === 'optional'
      ? g['type']
      : (g['required'] === true ? 'required' : 'optional'),
    options: Array.isArray(g['options'])
      ? (g['options'] as Array<Record<string, unknown>>).map(o => ({
          id: typeof o['id'] === 'string' ? o['id'] : crypto.randomUUID(),
          name: typeof o['name'] === 'string' ? o['name'] : '',
          price_delta: typeof o['price_delta'] === 'number' ? o['price_delta'] : 0,
        }))
      : [],
  }))
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
    onChange([...groups, { id: crypto.randomUUID(), name: '', type: 'optional', options: [] }])
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
        ? { ...g, options: [...g.options, { id: crypto.randomUUID(), name: '', price_delta: 0 }] }
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
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 10px', borderBottom: g.options.length > 0 ? '1px solid var(--divider)' : 'none',
            background: 'var(--surface)',
          }}>
            <input
              value={g.name}
              onChange={e => updateGroup(g.id, { name: e.target.value })}
              placeholder={`Grup ${gi + 1} adı`}
              style={{ ...inputSm, flex: 1, fontWeight: 600 }}
            />
            <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 5, padding: 2, gap: 1 }}>
              {(['required', 'optional'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateGroup(g.id, { type: t })}
                  style={{
                    padding: '2px 8px', fontSize: 10.5, fontWeight: 500, borderRadius: 4,
                    border: 'none', cursor: 'pointer',
                    background: g.type === t ? 'var(--surface)' : 'transparent',
                    color: g.type === t ? 'var(--text)' : 'var(--text-3)',
                    boxShadow: g.type === t ? 'var(--shadow-1)' : 'none',
                  }}
                >
                  {t === 'required' ? 'Zorunlu' : 'Opsiyonel'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => deleteGroup(g.id)}
              style={{
                width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer',
                background: 'transparent', color: 'var(--critical)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Grubu sil"
            >
              <I.trash size={12} />
            </button>
          </div>

          {/* Options */}
          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.options.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  value={o.name}
                  onChange={e => updateOption(g.id, o.id, { name: e.target.value })}
                  placeholder="Seçenek adı"
                  style={{ ...inputSm, flex: 1 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>₺</span>
                  <input
                    type="number"
                    min={0}
                    value={o.price_delta}
                    onChange={e => updateOption(g.id, o.id, { price_delta: Math.max(0, Number(e.target.value)) })}
                    style={{ ...inputSm, width: 54, fontFamily: "'Geist Mono', monospace" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => deleteOption(g.id, o.id)}
                  style={{
                    width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-4)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  aria-label="Seçeneği sil"
                >
                  <I.close size={10} />
                </button>
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
   CONFIRM DIALOG
   ============================================================ */
function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,17,19,.42)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 18, width: 'min(390px, 100%)',
        boxShadow: 'var(--shadow-pop)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--critical-bg)', color: 'var(--critical)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <I.trash size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{message}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onCancel} disabled={loading} style={btnGhost()}>{cancelLabel}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '7px 14px', borderRadius: 7, border: 'none',
              background: 'var(--critical)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              opacity: loading ? .72 : 1,
            }}
          >
            {loading ? <InlineSpinner size={13} color="#fff" /> : <I.trash size={13} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   CSV IMPORT
   ============================================================ */
interface CsvPreviewRow {
  category: string
  name: string
  description: string
  price: number
  error?: string
}

function CsvImportModal({
  rows,
  importing,
  importProgress,
  onConfirm,
  onCancel,
  onDownloadTemplate,
}: {
  rows: CsvPreviewRow[]
  importing: boolean
  importProgress: { done: number; total: number } | null
  onConfirm: () => void
  onCancel: () => void
  onDownloadTemplate: () => void
}) {
  const valid = rows.filter(r => !r.error).length
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,17,19,.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24,
        width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-pop)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>CSV içe aktarma önizlemesi</div>
          <button type="button" onClick={onDownloadTemplate} style={btnGhost()}>
            Şablon indir
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 80px 90px',
            padding: '8px 12px', background: 'var(--surface-2)',
            borderRadius: '8px 8px 0 0', border: '1px solid var(--border)',
            borderBottom: 'none',
            fontSize: 10.5, fontWeight: 500, letterSpacing: '.05em',
            textTransform: 'uppercase', color: 'var(--text-3)',
          }}>
            <span>Kategori</span><span>Ad</span><span>Fiyat</span><span>Durum</span>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            {rows.map((row, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 80px 90px',
                padding: '8px 12px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--divider)' : 'none',
                background: row.error ? 'rgba(255,80,65,.04)' : 'transparent',
                fontSize: 12.5,
              }}>
                <span style={{ color: 'var(--text-2)' }}>{row.category || '—'}</span>
                <span style={{ fontWeight: 500 }}>{row.name || '—'}</span>
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>
                  {!isNaN(row.price) ? `₺${row.price}` : '—'}
                </span>
                <span style={{ color: row.error ? 'var(--critical)' : 'var(--positive)', fontWeight: 500 }}>
                  {row.error ? `✗ ${row.error}` : '✓ Geçerli'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
          <strong style={{ color: 'var(--text)' }}>{valid}/{rows.length}</strong> satır geçerli
        </div>

        {importing && importProgress && (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <BrewBar progress={Math.round((importProgress.done / importProgress.total) * 100)} />
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {importProgress.done}/{importProgress.total} içe aktarıldı…
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={importing} style={btnGhost()}>
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={importing || valid === 0}
            style={{ ...btnPrimary(), opacity: importing || valid === 0 ? 0.55 : 1 }}
          >
            {importing
              ? <><InlineSpinner size={13} color="var(--on-action)" />İçe aktarılıyor…</>
              : `${valid} ürünü içe aktar`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   CATEGORY NAV
   ============================================================ */
function CategoryNav({
  categories,
  items,
  activeId,
  restaurantId,
  visibleCategoryIds,
  onSelect,
  onCategoryAdded,
  onCategoryDeleted,
  onCategoriesReordered,
}: {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  activeId: string | null
  restaurantId: string
  visibleCategoryIds?: Set<string>
  onSelect: (id: string) => void
  onCategoryAdded: (cat: Tables<'menu_categories'>) => void
  onCategoryDeleted: (id: string) => void
  onCategoriesReordered: (reordered: Tables<'menu_categories'>[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [addingSubCatFor, setAddingSubCatFor] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)

  const allTopLevel = categories.filter(c => !c.parent_id)
  const topLevel = visibleCategoryIds
    ? allTopLevel.filter(c =>
        visibleCategoryIds.has(c.id) ||
        categories.some(sc => sc.parent_id === c.id && visibleCategoryIds.has(sc.id)),
      )
    : allTopLevel

  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = topLevel.findIndex(c => c.id === active.id)
    const newIndex = topLevel.findIndex(c => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reorderedTop = arrayMove(topLevel, oldIndex, newIndex)
    const subCats = categories.filter(c => c.parent_id)
    onCategoriesReordered([...reorderedTop, ...subCats])
  }

  const dragActiveCat = dragActiveId ? topLevel.find(c => c.id === dragActiveId) : null

  // Determine the active top-level cat id (for showing sub-cats)
  const activeCat = categories.find(c => c.id === activeId)
  const activeTopId = activeCat?.parent_id ?? activeId

  return (
    <div style={{
      width: 'var(--nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Kategoriler</div>
          <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>{topLevel.length}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
          {items.length} ürün · {items.filter(i => i.is_available).length} yayında
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px' }}>
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={topLevel.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {topLevel.map(c => {
              const directCount = items.filter(i => i.category_id === c.id).length
              const subCats = categories.filter(sc => sc.parent_id === c.id)
              const isTopActive = activeTopId === c.id

              return (
                <div key={c.id}>
                  <SortableCategoryRow
                    id={c.id}
                    name={c.name}
                    count={directCount + subCats.reduce((acc, sc) => acc + items.filter(i => i.category_id === sc.id).length, 0)}
                    active={activeId === c.id}
                    onClick={() => onSelect(c.id)}
                    onDelete={() => setConfirmDeleteId(c.id)}
                  />

                  {/* Sub-categories (visible when this top-level cat is active) */}
                  {isTopActive && (
                    <div style={{ marginLeft: 12, borderLeft: '2px solid var(--divider)', paddingLeft: 8, marginBottom: 2 }}>
                      {subCats.map(sc => (
                        <CategoryRow
                          key={sc.id}
                          id={sc.id}
                          name={sc.name}
                          count={items.filter(i => i.category_id === sc.id).length}
                          active={activeId === sc.id}
                          onClick={() => onSelect(sc.id)}
                          onDelete={() => setConfirmDeleteId(sc.id)}
                        />
                      ))}

                      {addingSubCatFor === c.id ? (
                        <div style={{ marginTop: 4, marginBottom: 4 }}>
                          <CategoryForm
                            restaurantId={restaurantId}
                            parentId={c.id}
                            onCreated={(cat) => {
                              onCategoryAdded(cat)
                              setAddingSubCatFor(null)
                            }}
                            onCancel={() => setAddingSubCatFor(null)}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingSubCatFor(c.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            width: '100%', padding: '5px 8px', marginTop: 2,
                            border: '1px dashed var(--border)', background: 'transparent',
                            color: 'var(--text-3)', borderRadius: 6, cursor: 'pointer',
                            fontSize: 11.5, fontWeight: 500,
                          }}
                        >
                          <I.plus size={11} />Alt kategori ekle
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </SortableContext>
          <DragOverlay>
            {dragActiveCat ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '8px 8px', opacity: 0.9,
                boxShadow: 'var(--shadow-pop)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ width: 20, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <I.cutlery size={15} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{dragActiveCat.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {adding ? (
          <div style={{ marginTop: 8 }}>
            <CategoryForm
              restaurantId={restaurantId}
              onCreated={(cat) => {
                onCategoryAdded(cat)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 10px', marginTop: 8,
              border: '1px dashed var(--border-strong)', background: 'transparent',
              color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 500,
            }}
          >
            <I.plus size={13} />Kategori ekle
          </button>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-3)' }}>Toplam</span>
            <span style={S.mono}>{items.length} ürün</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-3)' }}>Yayında</span>
            <span style={{ ...S.mono, color: 'var(--positive)' }}>{items.filter(i => i.is_available).length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-3)' }}>Pasif</span>
            <span style={{ ...S.mono, color: 'var(--warning)' }}>{items.filter(i => !i.is_available).length}</span>
          </div>
        </div>
      </div>

      {confirmDeleteId && (() => {
        const cat = categories.find(c => c.id === confirmDeleteId)
        const subCount = categories.filter(c => c.parent_id === confirmDeleteId).length
        return (
          <ConfirmDialog
            title={`"${cat?.name}" silinsin mi?`}
            message={
              subCount > 0
                ? `Bu kategori ve ${subCount} alt kategorisi ile tüm içerikleri kalıcı olarak silinecek.`
                : 'Bu kategorideki tüm ürünler de silinecek. Bu işlem geri alınamaz.'
            }
            onConfirm={() => {
              onCategoryDeleted(confirmDeleteId)
              setConfirmDeleteId(null)
            }}
            onCancel={() => setConfirmDeleteId(null)}
          />
        )
      })()}
    </div>
  )
}

function CategoryRow({ id: _id, name, count, active, onClick, onDelete, dragHandle }: {
  id: string; name: string; count: number; active: boolean
  onClick: () => void; onDelete: () => void
  dragHandle?: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 8px', marginBottom: 1,
        background: active ? 'var(--surface-inset)' : (hov ? 'var(--surface-3)' : 'transparent'),
        border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{
        width: 20, height: 20, flexShrink: 0,
        color: active ? 'var(--text)' : 'var(--text-3)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <I.cutlery size={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ ...S.mono, width: 20, textAlign: 'right', fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>{count}</span>
      <span style={{ width: 18, height: 18, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {hov ? (
        <span
          role="button"
          aria-label="Sil"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{ color: 'var(--critical)', display: 'inline-flex', padding: 2, borderRadius: 4 }}
        >
          <I.trash size={13} />
        </span>
        ) : dragHandle ?? null}
      </span>
    </button>
  )
}

function SortableCategoryRow(props: {
  id: string; name: string; count: number; active: boolean
  onClick: () => void; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        position: 'relative',
      }}
    >
      <CategoryRow
        {...props}
        dragHandle={
          <span
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              color: 'var(--text-4)',
              display: 'inline-flex',
              padding: 2,
              touchAction: 'none',
            }}
            aria-label="Sırala"
          >
            <I.drag size={13} />
          </span>
        }
      />
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
  highlight?: string
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = items.filter(item => {
    if (filter === 'active') return item.is_available
    if (filter === 'inactive') return !item.is_available
    return true
  })

  const activeCount = items.filter(i => i.is_available).length
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
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'active', 'inactive'] as const).map((f) => {
              const labels = { all: 'Tümü', active: 'Aktif', inactive: 'Pasif' }
              const isActive = filter === f
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
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
              <button key={v} onClick={() => setView(v)} style={{
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
        {view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {filtered.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                active={selectedItem?.id === item.id}
                onClick={() => onSelectItem(item)}
                onPriceUpdate={(p) => onQuickUpdate(item.id, { price: p })}
                onToggleAvailable={() => onQuickUpdate(item.id, { is_available: !item.is_available })}
                highlight={highlight}
              />
            ))}
            <AddCard onClick={onAddItem} />
          </div>
        ) : (
          <ItemsList items={filtered} selected={selectedItem} onSelect={onSelectItem} highlight={highlight} />
        )}
      </div>
    </div>
  )
}

function ItemCard({ item, active, onClick, onPriceUpdate, onToggleAvailable, highlight }: {
  item: Tables<'menu_items'>; active: boolean; onClick: () => void
  onPriceUpdate?: (price: number) => void
  onToggleAvailable?: () => void
  highlight?: string
}) {
  const [hov, setHov] = useState(false)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceVal, setPriceVal] = useState(String(item.price))
  const tint = tintFor(item.id)

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
              <span style={{
                width: 26, height: 26, borderRadius: 6, background: 'var(--surface)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-1)', color: 'var(--text-2)',
              }}><I.drag size={14} /></span>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>
          {highlight ? highlightText(item.name, highlight) : item.name}
        </div>
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
      onClick={onClick}
      style={{
        aspectRatio: '4/3', minHeight: 200,
        background: 'transparent', border: '1.5px dashed var(--border-strong)',
        borderRadius: 10, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text-3)',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 999, background: 'var(--surface)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)',
      }}><I.plus size={18} /></div>
      <span style={{ fontSize: 12, fontWeight: 500 }}>Yeni ürün ekle</span>
    </button>
  )
}

function ItemsList({ items, selected, onSelect, highlight }: {
  items: Tables<'menu_items'>[]
  selected: Tables<'menu_items'> | null
  onSelect: (item: Tables<'menu_items'>) => void
  highlight?: string
}) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 1fr 90px 70px',
        padding: '10px 14px', borderBottom: '1px solid var(--divider)',
        background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-3)',
        fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase',
      }}>
        <span />
        <span>Ürün</span>
        <span>Fiyat</span>
        <span style={{ textAlign: 'right' }}>Durum</span>
      </div>
      {items.map(item => {
        const tint = tintFor(item.id)
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 90px 70px', alignItems: 'center',
              padding: '10px 14px', borderBottom: '1px solid var(--divider)',
              cursor: 'pointer',
              background: selected?.id === item.id ? 'var(--surface-inset)' : 'transparent',
            }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 6, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(17,17,19,.42)' }}>
              {(Array.isArray(item.images) && (item.images as string[])[0])
                ? <img src={(item.images as string[])[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                : <I.cutlery size={15} />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{highlight ? highlightText(item.name, highlight) : item.name}</div>
              {item.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{highlight ? highlightText(item.description, highlight) : item.description}</div>}
            </div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>₺{item.price}</span>
            <span style={{ textAlign: 'right' }}>
              <Tag tone={item.is_available ? 'positive' : 'neutral'}>{item.is_available ? 'Aktif' : 'Pasif'}</Tag>
            </span>
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
  restaurantId,
  onClose,
  onSaved,
  onDeleted,
  onError,
}: {
  item: Tables<'menu_items'>
  categoryName: string
  restaurantId: string
  onClose: () => void
  onSaved: (updated: Tables<'menu_items'>) => void
  onDeleted: (id: string) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [isAvailable, setIsAvailable] = useState(item.is_available)
  const [earnsStamp, setEarnsStamp] = useState<boolean>(item.earns_stamp ?? false)
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
      onSaved({ ...item, images: newImages as unknown as import('@garsonless/db').Json })
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
      fd.append('is_available', String(isAvailable))
      fd.append('earns_stamp', String(earnsStamp))
      fd.append('images', JSON.stringify(images))
      fd.append('modifier_groups', JSON.stringify(modifiers))
      const result = await updateItem(fd)
      if ('error' in result) { onError(result.error); return }
      onSaved({
        ...item,
        name,
        description: description || null,
        price: Number(price),
        is_available: isAvailable,
        earns_stamp: earnsStamp,
        images: images as unknown as import('@garsonless/db').Json,
        modifier_groups: modifiers as unknown as import('@garsonless/db').Json,
      })
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
    <div style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
          <I.cutlery size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.2 }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>#{item.id.slice(0, 8)}</div>
        </div>
        <IconButton icon={<I.close size={15} />} ariaLabel="Kapat" onClick={onClose} />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
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
                    else onSaved({ ...item, images: [] as unknown as import('@garsonless/db').Json })
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
        </PanelSection>

        {/* Fiyatlandırma */}
        <PanelSection title="Fiyatlandırma">
          <FieldInline label="Satış fiyatı">
            <input
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}
            />
          </FieldInline>
        </PanelSection>

        {/* Varyantlar */}
        <PanelSection title="Varyantlar">
          <ModifierGroupEditor groups={modifiers} onChange={setModifiers} />
        </PanelSection>

        {/* Görünürlük */}
        <PanelSection title="Görünürlük">
          <FieldRow label="Yayında">
            <button
              type="button"
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
      </div>

      <div style={{
        borderTop: '1px solid var(--divider)', padding: '12px 16px',
        display: 'flex', gap: 6, background: 'var(--surface-2)',
      }}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || isPending}
          style={{ ...btnGhost({ color: 'var(--critical)', borderColor: 'var(--critical-bg)' }), flex: 1, justifyContent: 'center' }}
        >
          <I.trash size={13} />Sil
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || uploading}
          style={{ ...btnPrimary(), flex: 2, justifyContent: 'center' }}
        >
          {isPending ? <><InlineSpinner size={13} color="var(--on-action)" />Kaydediliyor…</> : 'Değişiklikleri kaydet'}
        </button>
      </div>

      {deleteConfirmOpen && (
        <ConfirmDialog
          title="Ürün silinsin mi?"
          message={`"${item.name}" ürünü menüden kaldırılacak. Bu işlem geri alınamaz.`}
          confirmLabel="Ürünü sil"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => {
            if (!deleting) setDeleteConfirmOpen(false)
          }}
        />
      )}
    </div>
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
}

function SkeletonGrid() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-3) 0%, var(--surface-inset) 50%, var(--surface-3) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer-bg 1.4s ease-in-out infinite',
  }
  const skel = (style: React.CSSProperties) => <div style={{ borderRadius: 7, ...shimmer, ...style }} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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

export default function MenuManager({ restaurantId, restaurantName, restaurantSlug, initialCategories, initialItems }: Props) {
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
  const [showAddItem, setShowAddItem] = useState(false)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [, startTransition] = useTransition()
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error')
  const [csvPreview, setCsvPreview] = useState<{
    rows: CsvPreviewRow[]
    importing: boolean
    importProgress: { done: number; total: number } | null
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const csvFileRef = useRef<HTMLInputElement>(null)
  const showError = useCallback((msg: string) => { setToastMsg(msg); setToastTone('error') }, [])

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

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = (result.data as Record<string, string>[]).map(row => {
          const price = Number(row['Fiyat'])
          const name = (row['Ad'] ?? '').trim()
          const category = (row['Kategori'] ?? '').trim()
          let error: string | undefined
          if (!name) error = 'Ad boş'
          else if (!category) error = 'Kategori boş'
          else if (isNaN(price) || price < 0) error = 'Geçersiz fiyat'
          return { category, name, description: (row['Açıklama'] ?? '').trim(), price, error }
        })
        setCsvPreview({ rows, importing: false, importProgress: null })
      },
    })
  }

  async function handleCsvImport() {
    if (!csvPreview) return
    const validRows = csvPreview.rows.filter(r => !r.error)
    if (validRows.length === 0) return

    setCsvPreview(prev => prev ? { ...prev, importing: true, importProgress: { done: 0, total: validRows.length } } : null)

    const grouped = new Map<string, CsvPreviewRow[]>()
    for (const row of validRows) {
      grouped.set(row.category, [...(grouped.get(row.category) ?? []), row])
    }

    let done = 0
    const createdCats: Tables<'menu_categories'>[] = []

    for (const [catName, rows] of grouped) {
      let catId = [...categories, ...createdCats]
        .find(c => c.name.toLowerCase() === catName.toLowerCase() && !c.parent_id)?.id
      if (!catId) {
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('name', catName)
        const result = await createCategory(null, fd)
        if ('error' in result) { showError(result.error); return }
        catId = result.id
        const newCat: Tables<'menu_categories'> = {
          id: catId,
          restaurant_id: restaurantId,
          name: catName,
          description: null,
          position: 0,
          is_visible: true,
          parent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        }
        createdCats.push(newCat)
      }
      for (const row of rows) {
        const fd = new FormData()
        fd.append('categoryId', catId)
        fd.append('restaurantId', restaurantId)
        fd.append('name', row.name)
        fd.append('description', row.description)
        fd.append('price', String(row.price))
        fd.append('is_available', 'true')
        const result = await createItem(null, fd)
        if ('error' in result) { showError(result.error); return }
        done++
        const currentDone = done
        setCsvPreview(prev => prev ? { ...prev, importProgress: { done: currentDone, total: validRows.length } } : null)
      }
    }

    if (createdCats.length > 0) setCategories(prev => [...prev, ...createdCats])
    setCsvPreview(null)
    setToastMsg(`${done} ürün başarıyla içe aktarıldı`)
    setToastTone('success')
    router.refresh()
  }

  function downloadCsvTemplate() {
    const csv = 'Kategori,Ad,Açıklama,Fiyat\nAna Yemekler,Izgara Tavuk,Özel baharatlı,120\nTatlılar,Sütlaç,Fırın sütlaç,45'
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'menu_sablonu.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleSelectCategory(id: string) {
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
  }

  function handleDeleteCategory(id: string) {
    const catSnap = [...categories]
    const itemsSnap = [...items]
    const prevActive = activeCategory

    const cat = categories.find(c => c.id === id)
    const subCatIds = categories.filter(c => c.parent_id === id).map(c => c.id)
    const allDeletedIds = [id, ...subCatIds]

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
      }
    })
  }

  if (!mounted) return <SkeletonGrid />

  const activeCat = categories.find(c => c.id === activeCategory) ?? null
  const subCatsOfActive = activeCategory ? categories.filter(c => c.parent_id === activeCategory) : []

  // When no sub-cat tab is selected, show items from the top-level cat AND all its sub-cats
  const activeCategoryIds = activeSubCat
    ? [activeSubCat]
    : activeCategory
      ? [activeCategory, ...subCatsOfActive.map(c => c.id)]
      : null

  const searchQ = search.toLowerCase()
  const visibleItems = items.filter(i => {
    if (search) {
      return i.name.toLowerCase().includes(searchQ) || (i.description ?? '').toLowerCase().includes(searchQ)
    }
    return !activeCategoryIds || activeCategoryIds.includes(i.category_id)
  })

  const searchMatchedCategoryIds = search
    ? new Set(visibleItems.map(i => i.category_id))
    : undefined

  // Category name for the edit panel
  const activeCatForPanel = selectedItem
    ? (categories.find(c => c.id === selectedItem.category_id) ?? activeCat)
    : activeCat

  // Determine which category ID maps to what the user has "selected" in the nav for highlighting
  const navActiveId = activeSubCat ?? activeCategory

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
            <input ref={csvFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvFile} />
            <button style={btnGhost({ whiteSpace: 'nowrap' })} onClick={() => csvFileRef.current?.click()}>
              <I.upload size={13} />İçe aktar
            </button>
            <button
              style={btnGhost({ whiteSpace: 'nowrap' })}
              onClick={() => window.open(`${process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'}/${restaurantSlug}`, '_blank')}
            >
              <I.eye size={13} />Önizle
            </button>
            <button style={btnPrimary({ whiteSpace: 'nowrap' })} onClick={() => setShowAddItem(true)}><I.plus size={13} />Yeni ürün</button>
          </>
        }
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <CategoryNav
          categories={categories}
          items={items}
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
          onCategoryDeleted={handleDeleteCategory}
          onCategoriesReordered={handleCategoriesReordered}
        />

        <ItemsCanvas
          items={visibleItems}
          activeCategory={activeCat}
          subCategories={subCatsOfActive}
          activeSubCat={activeSubCat}
          onSubCatChange={(id) => { setActiveSubCat(id); setSelectedItem(null) }}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          onAddItem={() => setShowAddItem(true)}
          onQuickUpdate={handleQuickUpdate}
          highlight={search || undefined}
        />

        {selectedItem ? (
          <ItemEditPanel
            key={selectedItem.id}
            item={selectedItem}
            categoryName={activeCatForPanel?.name ?? ''}
            restaurantId={restaurantId}
            onClose={() => setSelectedItem(null)}
            onSaved={(updated) => {
              setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
              setSelectedItem(updated)
            }}
            onDeleted={(id) => {
              setItems(prev => prev.filter(i => i.id !== id))
              setSelectedItem(null)
            }}
            onError={showError}
          />
        ) : (
          <EmptyPanel />
        )}
      </div>

      {toastMsg && <Toast message={toastMsg} tone={toastTone} onDone={() => setToastMsg(null)} />}

      {csvPreview && (
        <CsvImportModal
          rows={csvPreview.rows}
          importing={csvPreview.importing}
          importProgress={csvPreview.importProgress}
          onConfirm={handleCsvImport}
          onCancel={() => setCsvPreview(null)}
          onDownloadTemplate={downloadCsvTemplate}
        />
      )}

      {showAddItem && (activeSubCat ?? activeCategory) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(17,17,19,.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: 480, boxShadow: 'var(--shadow-pop)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Yeni ürün ekle</div>
            <ItemForm
              restaurantId={restaurantId}
              categoryId={(activeSubCat ?? activeCategory)!}
              onCreated={(item) => {
                setItems(prev => [...prev, item])
                setShowAddItem(false)
                setSelectedItem(item)
              }}
              onCancel={() => setShowAddItem(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
