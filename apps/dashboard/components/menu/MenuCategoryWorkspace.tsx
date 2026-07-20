'use client'

import { Suspense, lazy, useState, type ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'

import { I, S } from '../../lib/ui'
import CategoryForm from './CategoryForm'
import { MenuConfirmDialog } from './MenuConfirmDialog'
import { deriveCategoryWorkspaceView } from './menu-category-workspace-model'

const MenuCategoryDndList = lazy(() => import('./MenuCategoryDndList'))

interface Props {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  activeId: string | null
  restaurantId: string
  visibleCategoryIds?: Set<string>
  onSelect: (id: string) => void
  onCategoryAdded: (category: Tables<'menu_categories'>) => void
  onCategoryUpdated: (category: Tables<'menu_categories'>) => void
  onCategoryDeleted: (id: string) => void
  onCategoriesReordered: (categories: Tables<'menu_categories'>[]) => void
}

export function MenuCategoryWorkspace({
  categories,
  items,
  kitchenStations,
  activeId,
  restaurantId,
  visibleCategoryIds,
  onSelect,
  onCategoryAdded,
  onCategoryUpdated,
  onCategoryDeleted,
  onCategoriesReordered,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [addingSubCategoryFor, setAddingSubCategoryFor] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const view = deriveCategoryWorkspaceView({ categories, items, activeId, visibleCategoryIds })
  const categoryListProps = {
    topLevel: view.topLevel,
    categories,
    items,
    kitchenStations,
    activeId,
    activeTopId: view.activeTopId,
    restaurantId,
    addingSubCatFor: addingSubCategoryFor,
    onAddingSubCategoryChange: setAddingSubCategoryFor,
    onSelect,
    onDeleteRequest: setConfirmDeleteId,
    onCategoryAdded,
    onCategoryUpdated,
    onCategoriesReordered,
    editingCategoryId,
    onEditingCategoryChange: setEditingCategoryId,
  }
  const deleteCategory = confirmDeleteId
    ? categories.find((category) => category.id === confirmDeleteId)
    : null
  const directChildCount = confirmDeleteId
    ? categories.filter((category) => category.parent_id === confirmDeleteId).length
    : 0

  return (
    <aside style={{
      width: 'var(--nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Kategoriler</div>
          <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>{view.topLevel.length}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
          {view.totalItems} ürün · {view.availableItems} yayında
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 8px' }}>
        <Suspense fallback={<StaticCategoryList {...categoryListProps} />}>
          <MenuCategoryDndList {...categoryListProps} />
        </Suspense>

        {adding ? (
          <div style={{ marginTop: 8 }}>
            <CategoryForm
              restaurantId={restaurantId}
              kitchenStations={kitchenStations}
              onCreated={(category) => {
                onCategoryAdded(category)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            className="menu-category-add"
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
          <SummaryRow label="Toplam" value={`${view.totalItems} ürün`} />
          <SummaryRow label="Yayında" value={String(view.availableItems)} color="var(--positive)" />
          <SummaryRow label="Pasif" value={String(view.unavailableItems)} color="var(--warning)" />
        </div>
      </div>

      {confirmDeleteId && (
        <MenuConfirmDialog
          title={`"${deleteCategory?.name}" silinsin mi?`}
          message={directChildCount > 0
            ? `Bu kategori ve ${directChildCount} alt kategorisi ile tüm içerikleri kalıcı olarak silinecek.`
            : 'Bu kategorideki tüm ürünler de silinecek. Bu işlem geri alınamaz.'}
          onConfirm={() => {
            onCategoryDeleted(confirmDeleteId)
            setConfirmDeleteId(null)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </aside>
  )
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ ...S.mono, color }}>{value}</span>
    </div>
  )
}

function StaticCategoryList({
  topLevel,
  categories,
  items,
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
  editingCategoryId,
  onEditingCategoryChange,
}: {
  topLevel: Tables<'menu_categories'>[]
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  activeId: string | null
  activeTopId: string | null
  restaurantId: string
  addingSubCatFor: string | null
  onAddingSubCategoryChange: (id: string | null) => void
  onSelect: (id: string) => void
  onDeleteRequest: (id: string) => void
  onCategoryAdded: (category: Tables<'menu_categories'>) => void
  onCategoryUpdated: (category: Tables<'menu_categories'>) => void
  editingCategoryId: string | null
  onEditingCategoryChange: (id: string | null) => void
}) {
  return (
    <>
      {topLevel.map((category) => {
        const children = categories.filter((child) => child.parent_id === category.id)
        const count = [category.id, ...children.map((child) => child.id)]
          .reduce((total, categoryId) => total + items.filter((item) => item.category_id === categoryId).length, 0)
        const isTopActive = activeTopId === category.id
        return (
          <div key={category.id}>
            {editingCategoryId === category.id ? (
              <CategoryEditor
                restaurantId={restaurantId}
                kitchenStations={kitchenStations}
                category={category}
                onUpdated={onCategoryUpdated}
                onClose={() => onEditingCategoryChange(null)}
              />
            ) : (
              <CategoryRow
                name={category.name}
                count={count}
                active={activeId === category.id}
                onClick={() => onSelect(category.id)}
                onEdit={() => onEditingCategoryChange(category.id)}
                onDelete={() => onDeleteRequest(category.id)}
              />
            )}
            {isTopActive && (
              <div style={{ marginLeft: 12, borderLeft: '2px solid var(--divider)', paddingLeft: 8, marginBottom: 2 }}>
                {children.map((child) => editingCategoryId === child.id ? (
                  <CategoryEditor
                    key={child.id}
                    restaurantId={restaurantId}
                    kitchenStations={kitchenStations}
                    category={child}
                    parentId={category.id}
                    onUpdated={onCategoryUpdated}
                    onClose={() => onEditingCategoryChange(null)}
                  />
                ) : (
                  <CategoryRow
                    key={child.id}
                    name={child.name}
                    count={items.filter((item) => item.category_id === child.id).length}
                    active={activeId === child.id}
                    onClick={() => onSelect(child.id)}
                    onEdit={() => onEditingCategoryChange(child.id)}
                    onDelete={() => onDeleteRequest(child.id)}
                  />
                ))}
                {addingSubCatFor === category.id ? (
                  <div style={{ margin: '4px 0' }}>
                    <CategoryForm
                      restaurantId={restaurantId}
                      parentId={category.id}
                      kitchenStations={kitchenStations}
                      onCreated={(created) => {
                        onCategoryAdded(created)
                        onAddingSubCategoryChange(null)
                      }}
                      onCancel={() => onAddingSubCategoryChange(null)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddingSubCategoryChange(category.id)}
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
    </>
  )
}

function CategoryEditor({
  restaurantId,
  kitchenStations,
  category,
  parentId,
  onUpdated,
  onClose,
}: {
  restaurantId: string
  kitchenStations: Tables<'kitchen_stations'>[]
  category: Tables<'menu_categories'>
  parentId?: string
  onUpdated: (category: Tables<'menu_categories'>) => void
  onClose: () => void
}) {
  return (
    <div style={{ margin: '4px 0' }}>
      <CategoryForm
        restaurantId={restaurantId}
        parentId={parentId}
        kitchenStations={kitchenStations}
        existing={category}
        onUpdated={(updated) => {
          onUpdated(updated)
          onClose()
        }}
        onCancel={onClose}
      />
    </div>
  )
}

function CategoryRow({
  name,
  count,
  active,
  onClick,
  onEdit,
  onDelete,
  dragHandle,
}: {
  name: string
  count: number
  active: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  dragHandle?: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const showActions = hovered || focused
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: 8, marginBottom: 1,
        background: active ? 'var(--surface-inset)' : hovered ? 'var(--surface-3)' : 'transparent',
        borderRadius: 7,
      }}
    >
      <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: 0, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: 20, height: 20, flexShrink: 0, color: active ? 'var(--text)' : 'var(--text-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><I.cutlery size={15} /></span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </button>
      <span style={{ ...S.mono, width: 20, textAlign: 'right', fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>{count}</span>
      <span style={{ minWidth: 42, height: 24, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
        {showActions ? (
          <>
            <button type="button" aria-label="Düzenle" onClick={onEdit} style={{ color: 'var(--text-2)', display: 'inline-flex', padding: 4, border: 0, background: 'transparent', borderRadius: 4, cursor: 'pointer' }}><I.gear size={13} /></button>
            <button type="button" aria-label="Sil" onClick={onDelete} style={{ color: 'var(--critical)', display: 'inline-flex', padding: 4, border: 0, background: 'transparent', borderRadius: 4, cursor: 'pointer' }}><I.trash size={13} /></button>
          </>
        ) : dragHandle ?? null}
      </span>
    </div>
  )
}
