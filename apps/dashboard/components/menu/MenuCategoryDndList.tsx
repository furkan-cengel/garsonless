'use client'

import { useState } from 'react'
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
import { I, S } from '../../lib/ui'
import CategoryForm from './CategoryForm'

interface Props {
  topLevel: Tables<'menu_categories'>[]
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  activeId: string | null
  activeTopId: string | null
  restaurantId: string
  addingSubCatFor: string | null
  onAddingSubCategoryChange: (id: string | null) => void
  onSelect: (id: string) => void
  onDeleteRequest: (id: string) => void
  onCategoryAdded: (cat: Tables<'menu_categories'>) => void
  onCategoriesReordered: (reordered: Tables<'menu_categories'>[]) => void
}

export default function MenuCategoryDndList({
  topLevel,
  categories,
  items,
  activeId,
  activeTopId,
  restaurantId,
  addingSubCatFor,
  onAddingSubCategoryChange,
  onSelect,
  onDeleteRequest,
  onCategoryAdded,
  onCategoriesReordered,
}: Props) {
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)

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

  return (
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
                onDelete={() => onDeleteRequest(c.id)}
              />

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
                      onDelete={() => onDeleteRequest(sc.id)}
                    />
                  ))}

                  {addingSubCatFor === c.id ? (
                    <div style={{ marginTop: 4, marginBottom: 4 }}>
                      <CategoryForm
                        restaurantId={restaurantId}
                        parentId={c.id}
                        onCreated={(cat) => {
                          onCategoryAdded(cat)
                          onAddingSubCategoryChange(null)
                        }}
                        onCancel={() => onAddingSubCategoryChange(null)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddingSubCategoryChange(c.id)}
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
