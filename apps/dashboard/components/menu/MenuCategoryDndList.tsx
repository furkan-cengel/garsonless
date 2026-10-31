'use client'

import { Button } from '@/components/ui/button'

import { useState } from 'react'
import { DndContext, DragOverlay, type Announcements, type DragEndEvent, type DragStartEvent, type ScreenReaderInstructions } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Tables } from '@garsonless/db/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { I, S } from '../../lib/ui'
import CategoryForm from './CategoryForm'
import { MenuCategoryGlyph } from './MenuCategoryGlyph'
import { countCategoryTreeItems } from './menu-category-workspace-model'
import { updateCategory } from '../../lib/actions/menu'

interface Props {
  topLevel: Tables<'menu_categories'>[]
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  /** Products counted next to each row (follows the status tab). */
  countedItems: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  activeId: string | null
  activeTopId: string | null
  restaurantId: string
  addingSubCatFor: string | null
  onAddingSubCategoryChange: (id: string | null) => void
  onSelect: (id: string) => void
  onDeleteRequest: (id: string) => void
  onCategoryAdded: (cat: Tables<'menu_categories'>) => void
  onCategoryUpdated: (cat: Tables<'menu_categories'>) => void
  onCategoriesReordered: (reordered: Tables<'menu_categories'>[]) => void
  editingCategoryId: string | null
  onEditingCategoryChange: (id: string | null) => void
}

export default function MenuCategoryDndList({
  topLevel,
  categories,
  items,
  countedItems,
  kitchenStations,
  activeId,
  activeTopId,
  restaurantId,
  addingSubCatFor,
  onAddingSubCategoryChange,
  onSelect,
  onDeleteRequest,
  onCategoryAdded,
  onCategoryUpdated,
  onCategoriesReordered,
  editingCategoryId,
  onEditingCategoryChange,
}: Props) {
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [movingCategoryId, setMovingCategoryId] = useState<string | null>(null)
  const [moveParentId, setMoveParentId] = useState('')
  const [moveError, setMoveError] = useState('')
  const [movePending, setMovePending] = useState(false)
  const movingCategory = categories.find((category) => category.id === movingCategoryId) ?? null
  const movingHasChildren = movingCategory ? categories.some((category) => category.parent_id === movingCategory.id) : false

  function openMoveDialog(category: Tables<'menu_categories'>) {
    setMovingCategoryId(category.id)
    setMoveParentId(category.parent_id ?? '')
    setMoveError('')
  }

  async function saveCategoryMove() {
    if (movePending) return
    if (!movingCategory || movingCategory.parent_id === (moveParentId || null)) {
      setMovingCategoryId(null)
      return
    }
    setMovePending(true)
    const formData = new FormData()
    formData.set('id', movingCategory.id)
    formData.set('restaurantId', restaurantId)
    formData.set('parentId', moveParentId)
    try {
      const result = await updateCategory(formData)
      if ('error' in result) {
        setMoveError(result.error)
        return
      }
      const nextParentId = moveParentId || null
      const nextPosition = Math.max(-1, ...categories
        .filter((category) => category.parent_id === nextParentId && category.id !== movingCategory.id)
        .map((category) => category.position)) + 1
      onCategoryUpdated({ ...movingCategory, parent_id: nextParentId, position: nextPosition })
      setMovingCategoryId(null)
    } catch {
      setMoveError('Kategori taşınamadı. Menüyü yenileyip tekrar deneyin.')
    } finally {
      setMovePending(false)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragActiveId(null)
    if (!over || active.id === over.id) return
    const activeCategory = categories.find((category) => category.id === active.id)
    const overCategory = categories.find((category) => category.id === over.id)
    if (!activeCategory || !overCategory || activeCategory.parent_id !== overCategory.parent_id) return
    const siblings = categories.filter((category) => category.parent_id === activeCategory.parent_id)
    const oldIndex = siblings.findIndex((category) => category.id === active.id)
    const newIndex = siblings.findIndex((category) => category.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex)
    const reordered = [...categories]
    const siblingIds = new Set(siblings.map((category) => category.id))
    let siblingIndex = 0
    for (let index = 0; index < reordered.length; index += 1) {
      const current = reordered[index]
      if (current && siblingIds.has(current.id)) {
        const replacement = reorderedSiblings[siblingIndex++]
        if (replacement) reordered[index] = replacement
      }
    }
    onCategoriesReordered(reordered)
  }

  const dragActiveCat = dragActiveId ? categories.find((c) => c.id === dragActiveId) : null
  const categoryName = (id: string | number) => categories.find((category) => category.id === String(id))?.name ?? 'Kategori'
  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: 'Bir kategoriyi taşımak için Boşluk tuşuna bas. Ok tuşlarıyla yeni konumu seç, bırakmak için yeniden Boşluk tuşuna, iptal etmek için Escape tuşuna bas.',
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${categoryName(active.id)} kategorisi tutuldu.`,
    onDragOver: ({ active, over }) => over
      ? `${categoryName(active.id)} kategorisi ${categoryName(over.id)} kategorisinin konumunda.`
      : `${categoryName(active.id)} kategorisi sıralama alanının dışında.`,
    onDragEnd: ({ active, over }) => over
      ? `${categoryName(active.id)} kategorisi ${categoryName(over.id)} kategorisinin konumuna taşındı.`
      : `${categoryName(active.id)} kategorisi taşınmadı.`,
    onDragCancel: ({ active }) => `${categoryName(active.id)} kategorisini taşıma iptal edildi.`,
  }

  return (
    <DndContext accessibility={{ announcements, screenReaderInstructions }} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={topLevel.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {topLevel.map((c) => {
          const directCount = countedItems.filter((i) => i.category_id === c.id).length
          const subCats = categories.filter((sc) => sc.parent_id === c.id)
          const isTopActive = activeTopId === c.id

          return (
            <div key={c.id}>
              {editingCategoryId === c.id ? (
                <div style={{ marginTop: 4, marginBottom: 4 }}>
                  <CategoryForm
                    restaurantId={restaurantId}
                    kitchenStations={kitchenStations}
                    existing={c}
                    productCount={countCategoryTreeItems(categories, items, c.id)}
                    onDeleteRequest={() => onDeleteRequest(c.id)}
                    onUpdated={(cat) => {
                      onCategoryUpdated(cat)
                      onEditingCategoryChange(null)
                    }}
                    onCancel={() => onEditingCategoryChange(null)}
                  />
                </div>
              ) : (
                <SortableCategoryRow
                  id={c.id}
                  name={c.name}
                  count={directCount + subCats.reduce((acc, sc) => acc + countedItems.filter((i) => i.category_id === sc.id).length, 0)}
                  active={activeId === c.id}
                  onClick={() => onSelect(c.id)}
                  onEdit={() => onEditingCategoryChange(c.id)}
                  onMove={() => openMoveDialog(c)}
                />
              )}

              {isTopActive && (
                <div
                  style={{
                    marginLeft: 12,
                    borderLeft: '2px solid var(--divider)',
                    paddingLeft: 8,
                    marginBottom: 2,
                  }}
                >
                <SortableContext items={subCats.map((sc) => sc.id)} strategy={verticalListSortingStrategy}>
                {subCats.map((sc) =>
                    editingCategoryId === sc.id ? (
                      <div key={sc.id} style={{ marginTop: 4, marginBottom: 4 }}>
                        <CategoryForm
                          restaurantId={restaurantId}
                          parentId={c.id}
                          kitchenStations={kitchenStations}
                          existing={sc}
                          productCount={countCategoryTreeItems(categories, items, sc.id)}
                          onDeleteRequest={() => onDeleteRequest(sc.id)}
                          onUpdated={(cat) => {
                            onCategoryUpdated(cat)
                            onEditingCategoryChange(null)
                          }}
                          onCancel={() => onEditingCategoryChange(null)}
                        />
                      </div>
                    ) : (
                      <SortableCategoryRow
                        key={sc.id}
                        id={sc.id}
                        name={sc.name}
                        count={countedItems.filter((i) => i.category_id === sc.id).length}
                        active={activeId === sc.id}
                        onClick={() => onSelect(sc.id)}
                        onEdit={() => onEditingCategoryChange(sc.id)}
                        onMove={() => openMoveDialog(sc)}
                      />
                    ),
                  )}
                </SortableContext>

                  {addingSubCatFor === c.id ? (
                    <div style={{ marginTop: 4, marginBottom: 4 }}>
                      <CategoryForm
                        restaurantId={restaurantId}
                        parentId={c.id}
                        kitchenStations={kitchenStations}
                        onCreated={(cat) => {
                          onCategoryAdded(cat)
                          onAddingSubCategoryChange(null)
                        }}
                        onCancel={() => onAddingSubCategoryChange(null)}
                      />
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => onAddingSubCategoryChange(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        padding: '5px 8px',
                        marginTop: 2,
                        border: '1px dashed var(--border)',
                        background: 'transparent',
                        color: 'var(--text-3)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 500,
                      }}
                    >
                      <I.plus size={11} />
                      Alt kategori ekle
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </SortableContext>
      <DragOverlay>
        {dragActiveCat ? (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '8px 8px',
              opacity: 0.9,
              boxShadow: 'var(--shadow-pop)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 20,
                color: 'var(--text-2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MenuCategoryGlyph name={dragActiveCat.name} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{dragActiveCat.name}</span>
          </div>
        ) : null}
      </DragOverlay>
      <Dialog open={Boolean(movingCategory)} onOpenChange={(open) => { if (!open && !movePending) setMovingCategoryId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kategoriyi taşı</DialogTitle>
            <DialogDescription>{movingCategory?.name} kategorisinin üst kategorisini seç.</DialogDescription>
          </DialogHeader>
          <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
            Üst kategori
            <select value={moveParentId} onChange={(event) => setMoveParentId(event.target.value)} style={{ minHeight: 36, border: '1px solid var(--border)', borderRadius: 7, padding: '0 10px', background: 'var(--surface)', color: 'var(--text)' }}>
              <option value="">Ana kategori</option>
              {categories.filter((category) => !category.parent_id && category.id !== movingCategoryId).map((category) => (
                <option key={category.id} value={category.id} disabled={movingHasChildren}>{category.name}</option>
              ))}
            </select>
          </label>
          {moveError ? <p role="alert" style={{ color: 'var(--critical)', fontSize: 12 }}>{moveError}</p> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button type="button" variant="outline" disabled={movePending} onClick={() => setMovingCategoryId(null)}>Vazgeç</Button>
            <Button type="button" disabled={movePending} onClick={() => void saveCategoryMove()}>{movePending ? 'Taşınıyor…' : 'Taşı'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}

function CategoryRow({
  id: _id,
  name,
  count,
  active,
  onClick,
  onEdit,
  onMove,
  dragHandle,
}: {
  id: string
  name: string
  count: number
  active: boolean
  onClick: () => void
  onEdit: () => void
  onMove: () => void
  dragHandle?: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  const [focused, setFocused] = useState(false)
  const showActions = hov || focused
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 8px',
        marginBottom: 1,
        background: active ? 'var(--surface-inset)' : hov ? 'var(--surface-3)' : 'transparent',
        borderRadius: 7,
      }}
    >
      <button
        type="button"
        className="menu-category-select"
        onClick={onClick}
        aria-current={active ? 'true' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
          padding: 0,
          border: 0,
          background: 'transparent',
          borderRadius: 0,
          boxShadow: 'none',
          filter: 'none',
          transform: 'none',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            flexShrink: 0,
            color: active ? 'var(--text)' : 'var(--text-3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MenuCategoryGlyph name={name} />
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: active ? 600 : 500,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
      </button>
      <span
        style={{
          ...S.mono,
          width: 20,
          textAlign: 'right',
          fontSize: 10.5,
          color: 'var(--text-3)',
          flexShrink: 0,
        }}
      >
        {count}
      </span>
      <span
        style={{
          minWidth: 68,
          height: 24,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 2,
        }}
      >
        {showActions ? (
          <>
            <Button type="button" aria-label={`${name} kategorisini taşı`} onClick={onMove} style={{ color: 'var(--text-2)', padding: '4px 5px', border: 0, background: 'transparent', borderRadius: 4, cursor: 'pointer', fontSize: 10.5 }}>Taşı</Button>
            <Button
              type="button"
              aria-label={`${name} kategorisini düzenle`}
              onClick={onEdit}
              style={{
                color: 'var(--text-2)',
                display: 'inline-flex',
                padding: 4,
                border: 0,
                background: 'transparent',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <I.gear size={13} />
            </Button>
          </>
        ) : (
          (dragHandle ?? null)
        )}
      </span>
    </div>
  )
}

function SortableCategoryRow(props: { id: string; name: string; count: number; active: boolean; onClick: () => void; onEdit: () => void; onMove: () => void }) {
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
            aria-label={`${props.name} kategorisini sırala`}
          >
            <I.drag size={13} />
          </span>
        }
      />
    </div>
  )
}
