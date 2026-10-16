'use client'

import { useState } from 'react'
import { DndContext, type Announcements, type DragEndEvent, type ScreenReaderInstructions } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Tables } from '@garsonless/db/types'
import { Button } from '@/components/ui/button'
import { I } from '../../lib/ui'

type MenuItem = Tables<'menu_items'>

/**
 * Manual product order for one category. Drag a row by its handle (pointer or
 * Space + arrow keys) or use the up/down buttons; nothing is saved until "Sırayı kaydet".
 */
export default function MenuItemSortList({ items, pending, onSave, onCancel }: {
  items: MenuItem[]
  pending: boolean
  onSave: (orderedIds: string[]) => void
  onCancel: () => void
}) {
  const [order, setOrder] = useState(() => items.map((item) => item.id))
  const byId = new Map(items.map((item) => [item.id, item]))
  const name = (id: string | number) => byId.get(String(id))?.name ?? 'Ürün'
  const changed = order.some((id, index) => id !== items[index]?.id)
  const move = (from: number, to: number) => { if (to >= 0 && to < order.length) setOrder((current) => arrayMove(current, from, to)) }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(order.indexOf(String(active.id)), order.indexOf(String(over.id)))
  }

  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: 'Bir ürünü taşımak için Boşluk tuşuna bas. Ok tuşlarıyla yeni konumu seç, bırakmak için yeniden Boşluk tuşuna, iptal etmek için Escape tuşuna bas.',
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${name(active.id)} tutuldu.`,
    onDragOver: ({ active, over }) => over ? `${name(active.id)}, ${name(over.id)} ürününün konumunda.` : `${name(active.id)} listenin dışında.`,
    onDragEnd: ({ active, over }) => over ? `${name(active.id)}, ${name(over.id)} ürününün konumuna taşındı.` : `${name(active.id)} taşınmadı.`,
    onDragCancel: ({ active }) => `${name(active.id)} taşıma iptal edildi.`,
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 flex-1 text-sm text-muted-foreground">Ürünleri sürükle ya da oklarla taşı. Misafir menüde bu sırayı görür.</p>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>Vazgeç</Button>
        <Button type="button" size="sm" disabled={pending || !changed} onClick={() => onSave(order)}>Sırayı kaydet</Button>
      </div>
      <DndContext accessibility={{ announcements, screenReaderInstructions }} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Ürün sırası">
            {order.map((id, index) => {
              const item = byId.get(id)
              return item ? (
                <SortableItemRow key={id} item={item} index={index} last={index === order.length - 1} disabled={pending} onMove={(delta) => move(index, index + delta)} />
              ) : null
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableItemRow({ item, index, last, disabled, onMove }: { item: MenuItem; index: number; last: boolean; disabled: boolean; onMove: (delta: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled })
  const image = Array.isArray(item.images) && typeof item.images[0] === 'string' ? item.images[0] : null
  return (
    <li
      ref={setNodeRef}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative', zIndex: isDragging ? 2 : undefined }}
    >
      <span {...attributes} {...listeners} aria-label={`${item.name} ürününü sürükle`} className="inline-flex cursor-grab rounded p-1 text-muted-foreground" style={{ touchAction: 'none' }}>
        <I.drag size={15} />
      </span>
      <span className="w-6 text-right font-mono text-xs text-muted-foreground">{index + 1}</span>
      <span className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
        {image && <img src={image} alt="" className="size-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}{!item.is_available && <span className="ml-2 text-xs font-normal text-muted-foreground">Pasif</span>}</span>
      <span className="font-mono text-sm">₺{item.price}</span>
      <Button type="button" size="icon-sm" variant="ghost" disabled={disabled || index === 0} aria-label={`${item.name} ürününü yukarı taşı`} onClick={() => onMove(-1)}>
        <I.chevDown size={14} style={{ transform: 'rotate(180deg)' }} />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" disabled={disabled || last} aria-label={`${item.name} ürününü aşağı taşı`} onClick={() => onMove(1)}>
        <I.chevDown size={14} />
      </Button>
    </li>
  )
}
