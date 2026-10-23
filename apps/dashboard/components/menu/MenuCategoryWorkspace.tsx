'use client'

import { useMenuDrafts } from './MenuDraftProvider'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'

import { I, S } from '../../lib/ui'
import CategoryForm from './CategoryForm'
import { MenuCategoryGlyph } from './MenuCategoryGlyph'
import { MenuConfirmDialog } from './MenuConfirmDialog'
import { countCategoryTreeItems, deriveCategoryWorkspaceView } from './menu-category-workspace-model'

const MenuCategoryDndList = lazy(() => import('./MenuCategoryDndList'))

interface Props {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  activeId: string | null
  restaurantId: string
  visibleCategoryIds?: Set<string>
  /** Row counts follow the product status tab (Tümü / Yayında / Pasif). */
  countStatus?: 'all' | 'active' | 'inactive'
  onSelect: (id: string) => void
  onCategoryAdded: (category: Tables<'menu_categories'>) => void
  onCategoryUpdated: (category: Tables<'menu_categories'>) => void
  onCategoryDeleted: (id: string) => void
  onCategoriesReordered: (categories: Tables<'menu_categories'>[]) => void
  addRequest: number
}

export function MenuCategoryWorkspace({
  categories,
  items,
  kitchenStations,
  activeId,
  restaurantId,
  visibleCategoryIds,
  countStatus = 'all',
  onSelect,
  onCategoryAdded,
  onCategoryUpdated,
  onCategoryDeleted,
  onCategoriesReordered,
  addRequest,
}: Props) {
  const { requestExit } = useMenuDrafts()
  const [adding, setAdding] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => setMobile(media.matches)
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const [addingSubCategoryFor, setAddingSubCategoryFor] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (addRequest > 0) { setAdding(true); setNavigationOpen(true) }
  }, [addRequest])
  const view = deriveCategoryWorkspaceView({
    categories,
    items,
    activeId,
    visibleCategoryIds,
  })
  const countedItems = countStatus === 'all' ? items : items.filter((item) => item.is_available === (countStatus === 'active'))
  const categoryListProps = {
    topLevel: view.topLevel,
    categories,
    items,
    countedItems,
    kitchenStations,
    activeId,
    activeTopId: view.activeTopId,
    restaurantId,
    addingSubCatFor: addingSubCategoryFor,
    onAddingSubCategoryChange: (id: string | null) => requestExit(() => setAddingSubCategoryFor(id)),
    onSelect: (id: string) => { onSelect(id); setNavigationOpen(false) },
    onDeleteRequest: (id: string) => { setEditingCategoryId(null); setConfirmDeleteId(id) },
    onCategoryAdded,
    onCategoryUpdated,
    onCategoriesReordered: (next: Tables<'menu_categories'>[]) => requestExit(() => onCategoriesReordered(next)),
    editingCategoryId,
    onEditingCategoryChange: (id: string | null) => requestExit(() => setEditingCategoryId(id)),
  }
  const deleteCategory = confirmDeleteId ? categories.find((category) => category.id === confirmDeleteId) : null

  const content = (
    <aside
      className="menu-category-workspace"
      aria-labelledby="menu-categories-heading"
      style={{
        width: 'var(--nav)',
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--divider)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div id="menu-categories-heading" style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Kategoriler</div>
          <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>{view.topLevel.length}</span>
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
          <Button
            type="button"
            className="menu-category-add"
            onClick={() => requestExit(() => setAdding(true))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              marginTop: 8,
              border: '1px dashed var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-2)',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            <I.plus size={13} />
            Kategori ekle
          </Button>
        )}
      </div>


      {confirmDeleteId && (
        <MenuConfirmDialog
          title={`"${deleteCategory?.name}" silinsin mi?`}
          message={`${deleteCategory?.parent_id ? 'Alt kategori' : 'Kategori'} kalıcı olarak silinecek. İçinde ürün olmadığı için başka hiçbir şey etkilenmez.`}
          onConfirm={() => {
            onCategoryDeleted(confirmDeleteId)
            setConfirmDeleteId(null)
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </aside>
  )
  if (!mobile) return content
  return <div className="menu-mobile-categories">
    <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setNavigationOpen(true)} aria-label="Menü kategorilerini aç">
      {categories.find((category) => category.id === activeId)?.name ?? 'Kategori seç'}<I.chevDown data-icon="inline-end" />
    </Button>
    <Sheet open={navigationOpen} onOpenChange={(open) => requestExit(() => setNavigationOpen(open))}>
      <SheetContent side="bottom" className="menu-mobile-category-sheet max-h-[85dvh] gap-0 rounded-t-xl">
        <SheetHeader><SheetTitle>Menü kategorileri</SheetTitle><SheetDescription>Kategori seçin veya kategorilerinizi düzenleyin.</SheetDescription></SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  </div>
}


function StaticCategoryList({
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
  editingCategoryId,
  onEditingCategoryChange,
}: {
  topLevel: Tables<'menu_categories'>[]
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  countedItems: Tables<'menu_items'>[]
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
        const count = countCategoryTreeItems(categories, countedItems, category.id)
        const isTopActive = activeTopId === category.id
        return (
          <div key={category.id}>
            {editingCategoryId === category.id ? (
              <CategoryEditor
                restaurantId={restaurantId}
                kitchenStations={kitchenStations}
                category={category}
                productCount={countCategoryTreeItems(categories, items, category.id)}
                onDeleteRequest={() => onDeleteRequest(category.id)}
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
                {children.map((child) =>
                  editingCategoryId === child.id ? (
                    <CategoryEditor
                      key={child.id}
                      restaurantId={restaurantId}
                      kitchenStations={kitchenStations}
                      category={child}
                      parentId={category.id}
                      productCount={countCategoryTreeItems(categories, items, child.id)}
                      onDeleteRequest={() => onDeleteRequest(child.id)}
                      onUpdated={onCategoryUpdated}
                      onClose={() => onEditingCategoryChange(null)}
                    />
                  ) : (
                    <CategoryRow
                      key={child.id}
                      name={child.name}
                      count={countedItems.filter((item) => item.category_id === child.id).length}
                      active={activeId === child.id}
                      onClick={() => onSelect(child.id)}
                      onEdit={() => onEditingCategoryChange(child.id)}
                    />
                  ),
                )}
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
                  <Button
                    type="button"
                    onClick={() => onAddingSubCategoryChange(category.id)}
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
    </>
  )
}

function CategoryEditor({
  restaurantId,
  kitchenStations,
  category,
  parentId,
  productCount,
  onDeleteRequest,
  onUpdated,
  onClose,
}: {
  restaurantId: string
  kitchenStations: Tables<'kitchen_stations'>[]
  category: Tables<'menu_categories'>
  parentId?: string
  productCount: number
  onDeleteRequest: () => void
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
        productCount={productCount}
        onDeleteRequest={onDeleteRequest}
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
  dragHandle,
}: {
  name: string
  count: number
  active: boolean
  onClick: () => void
  onEdit: () => void
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
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: 8,
        marginBottom: 1,
        background: active ? 'var(--surface-inset)' : hovered ? 'var(--surface-3)' : 'transparent',
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
          minWidth: 42,
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
