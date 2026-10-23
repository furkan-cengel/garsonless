'use client'

import type { ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Tables } from '@garsonless/db/types'
import { Button } from '@/components/ui/button'
import { I } from '../../lib/ui'

type Item = Tables<'menu_items'>
type Group = { id: string; name: string; items: Item[] }

export default function MenuProductsDnd({ groups, items, view, grouped, disabled, disabledIds, onAdd, onMove, onReorder, renderItem }: {
  groups: Group[]
  items: Item[]
  view: 'grid' | 'list'
  grouped: boolean
  disabled: boolean
  disabledIds: ReadonlySet<string>
  onAdd: (categoryId: string) => void
  onMove: (itemId: string, categoryId: string) => void
  onReorder: (categoryId: string, ids: string[]) => void
  renderItem: (item: Item, handle: ReactNode) => ReactNode
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  function drop({ active, over }: DragEndEvent) {
    if (disabled || !over || active.id === over.id || disabledIds.has(String(active.id))) return
    const source = items.find((item) => item.id === active.id)
    const target = items.find((item) => item.id === over.id)
    const categoryId = target?.category_id ?? groups.find((group) => `category/${group.id}` === over.id)?.id
    if (!source || !categoryId || categoryId === 'all') return
    if (source.category_id !== categoryId) { onMove(source.id, categoryId); return }
    if (!target || disabledIds.has(target.id)) return
    // The RPC requires the complete category order, including filtered-out passive items.
    const order = items.filter((item) => item.category_id === categoryId).map((item) => item.id)
    if (order.some((id) => disabledIds.has(id))) return
    onReorder(categoryId, arrayMove(order, order.indexOf(source.id), order.indexOf(target.id)))
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}
    accessibility={{ screenReaderInstructions: { draggable: 'Taşımak için Boşluk, konum seçmek için ok tuşları, bırakmak için Boşluk, vazgeçmek için Escape tuşuna basın.' } }}>
    {view === 'list' ? (
      // One table: a single header row, sub-category groups as divider rows.
      <div className="menu-product-table" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        <div className="menu-product-row menu-product-row-head" aria-hidden="true">
          <span /><span className="menu-product-row-drag" /><span className="menu-product-row-thumb" />
          <span className="menu-product-row-main">Ürün<span>Fiyat</span></span>
          <span className="menu-product-row-status">Durum · Tamamlanma</span><span className="menu-product-row-edit" />
        </div>
        {groups.map((group) => <ProductGroup key={group.id} group={group} view={view} grouped={grouped} disabled={disabled} onAdd={() => onAdd(group.id)}>
          <SortableContext items={group.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {group.items.map((item) => <SortableProduct key={item.id} item={item} disabled={disabled || disabledIds.has(item.id)} renderItem={renderItem} />)}
          </SortableContext>
        </ProductGroup>)}
      </div>
    ) : groups.map((group) => <ProductGroup key={group.id} group={group} view={view} grouped={grouped} disabled={disabled} onAdd={() => onAdd(group.id)}>
      <SortableContext items={group.items.map((item) => item.id)} strategy={rectSortingStrategy}>
        {group.items.map((item) => <SortableProduct key={item.id} item={item} disabled={disabled || disabledIds.has(item.id)} renderItem={renderItem} />)}
      </SortableContext>
    </ProductGroup>)}
  </DndContext>
}

function ProductGroup({ group, view, grouped, disabled, onAdd, children }: { group: Group; view: 'grid' | 'list'; grouped: boolean; disabled: boolean; onAdd: () => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `category/${group.id}`, disabled })
  const addButton = <Button type="button" variant="outline" size="sm" onClick={onAdd} aria-label={`${group.name} grubuna ürün ekle`}><I.plus data-icon="inline-start" />Ürün ekle</Button>
  if (view === 'list') {
    return <section ref={setNodeRef} style={{ outline: isOver ? '2px solid var(--border-strong)' : undefined, outlineOffset: -2 }}>
      {grouped && <div className="menu-product-divider"><span>{group.name} · {group.items.length}</span>{addButton}</div>}
      <div role="list" aria-label={group.name || 'Ürünler'} style={{ minHeight: grouped ? 8 : undefined }}>{children}</div>
    </section>
  }
  return <section ref={setNodeRef} className="mb-6 flex flex-col gap-3" style={{ outline: isOver ? '2px solid var(--border-strong)' : undefined, outlineOffset: 4 }}>
    {grouped && <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{group.name} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{group.items.length}</span></h3>{addButton}</div>}
    <div role="list" aria-label={group.name || 'Ürünler'} className="menu-product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, minHeight: 64 }}>
      {children}
    </div>
  </section>
}

function SortableProduct({ item, disabled, renderItem }: { item: Item; disabled: boolean; renderItem: (item: Item, handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled })
  const handle = <Button type="button" variant="ghost" size="icon-sm" {...attributes} {...listeners} disabled={disabled} aria-label={`${item.name} ürününü sürükle`} style={{ touchAction: 'none', cursor: disabled ? undefined : 'grab' }}><I.drag /></Button>
  return <div ref={setNodeRef} role="listitem" style={{ minWidth: 0, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .5 : 1 }}>{renderItem(item, handle)}</div>
}
