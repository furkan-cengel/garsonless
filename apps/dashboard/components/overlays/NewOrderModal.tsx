'use client'

import { useState, useEffect } from 'react'
import { I, S, btnPrimary, btnGhost, IconButton } from '../../lib/ui'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { createOrderFromDashboard } from '../../lib/actions/orders'
import type { TableStatusData } from '../../lib/queries'
import {
  normalizeIngredients,
  normalizeModifierGroups,
  type MenuIngredient,
  type MenuModifierGroup,
  type SelectedMenuModifier,
} from '@garsonless/db/order-client'

interface Props {
  restaurantId: string
  tableStatuses: TableStatusData[]
  initialTableId?: string | null
  onClose: () => void
  onCreated?: () => void
}

interface CartItem {
  cartId: string
  itemId: string
  name: string
  price: number
  qty: number
  modifiersPriceDelta: number
  selectedModifiers: SelectedMenuModifier[]
  modifierNames: string[]
  removedIngredientIds: string[]
  removedIngredientNames: string[]
}

interface RealMenuItem {
  id: string
  name: string
  price: number
  category_id: string
  categoryName: string
  ingredients: MenuIngredient[]
  modifier_groups: MenuModifierGroup[]
}

const mono = S.mono

export default function NewOrderModal({ restaurantId, tableStatuses, initialTableId = null, onClose, onCreated }: Props) {
  const [step, setStep] = useState(initialTableId ? 2 : 1)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(initialTableId)
  const [items, setItems] = useState<CartItem[]>([])
  const [menuItems, setMenuItems] = useState<RealMenuItem[]>([])
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((s, i) => s + (i.price + i.modifiersPriceDelta) * i.qty, 0)
  const selectedTable = tableStatuses.find(t => t.id === selectedTableId)

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    const load = async () => {
      const catRes = await supabase
        .from('menu_categories')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('position')

      const categoryNames: Record<string, string> = {}
      for (const c of (catRes.data ?? []) as { id: string; name: string }[]) {
        categoryNames[c.id] = c.name
      }

      const catIds = Object.keys(categoryNames)
      if (catIds.length === 0) { setLoadingMenu(false); return }

      const itemRes = await supabase
        .from('menu_items')
        .select('id, name, price, category_id, ingredients, modifier_groups')
        .in('category_id', catIds)
        .is('deleted_at', null)
        .order('position')

      const mapped: RealMenuItem[] = ((itemRes.data ?? []) as { id: string; name: string; price: number; category_id: string; ingredients: unknown; modifier_groups: unknown }[])
        .map(it => ({
          ...it,
          categoryName: categoryNames[it.category_id] ?? '',
          ingredients: normalizeIngredients(it.ingredients),
          modifier_groups: normalizeModifierGroups(it.modifier_groups),
        }))

      setMenuItems(mapped)
      setLoadingMenu(false)
    }
    void load()
  }, [restaurantId])

  async function handleSubmit() {
    if (items.length === 0) return
    setSubmitting(true)
    setError(null)

    const result = await createOrderFromDashboard({
      restaurantId,
      tableId: selectedTableId,
      items: items.map(i => ({
        itemId: i.itemId,
        quantity: i.qty,
        selectedModifiers: i.selectedModifiers,
        removedIngredientIds: i.removedIngredientIds,
      })),
    })

    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      onCreated?.()
      onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(17,17,19,.4)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1080, height: '85vh', maxHeight: 720,
          background: 'var(--surface)', borderRadius: 14,
          boxShadow: '0 30px 80px -10px rgba(0,0,0,.4)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px 12px', borderBottom: '1px solid var(--divider)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)' }}>
              Yeni sipariş oluştur
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
              {selectedTable ? `${selectedTable.label} için sipariş hazırlanıyor` : 'Bir masa seç'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {[{ n: 1, l: 'Masa' }, { n: 2, l: 'Ürünler' }, { n: 3, l: 'Onay' }].map((s, i, arr) => (
              <span key={s.n} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 9px', borderRadius: 999,
                  background: step >= s.n ? 'var(--text)' : 'var(--surface-3)',
                  color: step >= s.n ? '#fff' : 'var(--text-3)',
                  fontSize: 11, fontWeight: 600,
                }}>
                  <span style={mono}>{s.n}</span>{s.l}
                </span>
                {i < arr.length - 1 && <span style={{ color: 'var(--text-4)', fontSize: 12 }}>·</span>}
              </span>
            ))}
          </div>
          <IconButton icon={<I.close size={16} />} ariaLabel="Kapat" onClick={onClose} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.4fr 1fr', minHeight: 0 }}>
          <div style={{ overflow: 'auto', padding: 20, borderRight: '1px solid var(--divider)' }}>
            {step === 1 && (
              <PickTablePanel
                tables={tableStatuses}
                selected={selectedTableId}
                setSelected={setSelectedTableId}
              />
            )}
            {step === 2 && (
              <PickItemsPanel
                items={items}
                setItems={setItems}
                menuItems={menuItems}
                loading={loadingMenu}
              />
            )}
            {step === 3 && <ConfirmPanel />}
          </div>
          {/* Right: live summary */}
          <div style={{ background: 'var(--surface-2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: 'var(--text)', color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, ...mono,
                }}>
                  {selectedTable ? selectedTable.label.slice(0, 3) : '—'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {selectedTable?.label ?? 'Masa seçilmedi'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                    {items.length} kalem · {items.reduce((s, i) => s + i.qty, 0)} adet
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
              {items.map((it) => (
                <div key={it.cartId} style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{it.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>₺{it.price + it.modifiersPriceDelta} × {it.qty}</div>
                    {it.modifierNames.length > 0 && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{it.modifierNames.join(', ')}</div>}
                    {it.removedIngredientNames.length > 0 && <div style={{ fontSize: 10, color: 'var(--critical)', fontWeight: 700, marginTop: 2 }}>ÇIKAR: {it.removedIngredientNames.join(', ')}</div>}
                  </div>
                  <span style={{ ...mono, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                    ₺{(it.price + it.modifiersPriceDelta) * it.qty}
                  </span>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ padding: '24px 18px', fontSize: 12, color: 'var(--text-4)', textAlign: 'center' }}>
                  Henüz ürün eklenmedi
                </div>
              )}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--divider)', background: 'var(--surface)' }}>
              <SummaryRow label="Ara toplam" value={`₺${total}`} />
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--divider)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Toplam</span>
                <span style={{ ...mono, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                  ₺{total}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--divider)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onClose} style={btnGhost()}>İptal</button>
            {error && <span style={{ fontSize: 12, color: 'var(--critical)' }}>{error}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} style={btnGhost()}>Geri</button>
            )}
            <button
              onClick={() => {
                if (step < 3) {
                  setStep(step + 1)
                } else {
                  void handleSubmit()
                }
              }}
              disabled={(step === 1 && !selectedTableId) || (step === 3 && items.length === 0) || submitting}
              style={{
                ...btnPrimary(),
                opacity: ((step === 1 && !selectedTableId) || (step === 3 && items.length === 0) || submitting) ? 0.4 : 1,
                cursor: ((step === 1 && !selectedTableId) || submitting) ? 'not-allowed' : 'pointer',
              }}
            >
              {step === 3 ? (submitting ? 'Gönderiliyor…' : 'Siparişi başlat') : 'Devam'}
              {step < 3 && <I.chevRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span style={{ ...S.mono, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

const TABLE_COLORS = {
  empty:  { bg: 'var(--surface)',   fg: 'var(--text)',   border: 'var(--border)' },
  active: { bg: 'var(--info-bg)',   fg: 'var(--info)',   border: 'var(--info-bg)' },
  new:    { bg: 'var(--warning-bg)', fg: 'var(--warning)', border: 'var(--warning-bg)' },
  late:   { bg: 'var(--critical-bg)', fg: 'var(--critical)', border: 'var(--critical-bg)' },
  paid:   { bg: 'var(--positive-bg)', fg: 'var(--positive)', border: 'var(--positive-bg)' },
}

function PickTablePanel({ tables, selected, setSelected }: {
  tables: TableStatusData[]
  selected: string | null
  setSelected: (id: string) => void
}) {
  if (tables.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
        <I.chair size={32} />
        <div style={{ marginTop: 10, fontSize: 13 }}>Henüz masa eklenmedi</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          Hangi masaya sipariş alıyorsun?
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          Boş masa yeni adisyon açar; aktif masa mevcut adisyona ekler.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {tables.map((t) => {
          const c = TABLE_COLORS[t.status] ?? TABLE_COLORS.empty
          const isSel = selected === t.id
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              style={{
                padding: '14px 8px', borderRadius: 10, background: c.bg,
                border: '1.5px solid ' + (isSel ? 'var(--text)' : c.border),
                cursor: 'pointer',
                boxShadow: isSel ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
                position: 'relative', textAlign: 'left',
              }}
            >
              {isSel && (
                <span style={{ position: 'absolute', top: 6, right: 6, color: 'var(--text)', display: 'flex' }}>
                  <I.check size={14} />
                </span>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: c.fg }}>{t.label}</div>
              <div style={{ fontSize: 10, color: c.fg, opacity: 0.8, marginTop: 2 }}>
                {t.status === 'empty' ? 'Boş' : t.status === 'paid' ? 'Ödendi' : t.status === 'late' ? 'Gecikmeli' : t.status === 'new' ? 'Yeni sipariş' : 'Açık adisyon'}
              </div>
              {t.total > 0 && (
                <div style={{ ...S.mono, fontSize: 10, color: c.fg, opacity: 0.9, marginTop: 2 }}>
                  ₺{(t.unpaidTotal > 0 ? t.unpaidTotal : t.total).toLocaleString('tr-TR')}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PickItemsPanel({ items, setItems, menuItems, loading }: {
  items: CartItem[]
  setItems: (v: CartItem[]) => void
  menuItems: RealMenuItem[]
  loading: boolean
}) {
  const [activeCat, setActiveCat] = useState('Tümü')
  const [search, setSearch] = useState('')
  const [customizing, setCustomizing] = useState<RealMenuItem | null>(null)

  const categories = ['Tümü', ...Array.from(new Set(menuItems.map(m => m.categoryName)))]

  const filtered = menuItems.filter((it) => {
    const matchesCat = activeCat === 'Tümü' || it.categoryName === activeCat
    const matchesSearch = it.name.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  function addItem(it: RealMenuItem) {
    if (it.modifier_groups.length > 0 || it.ingredients.some((ingredient) => ingredient.removable)) {
      setCustomizing(it)
      return
    }
    addConfiguredItem(it, [], [])
  }

  function addConfiguredItem(
    it: RealMenuItem,
    selectedModifiers: SelectedMenuModifier[],
    removedIngredientIds: string[],
  ) {
    const signature = JSON.stringify({ selectedModifiers, removedIngredientIds: [...removedIngredientIds].sort() })
    const existing = items.find((item) =>
      item.itemId === it.id &&
      JSON.stringify({ selectedModifiers: item.selectedModifiers, removedIngredientIds: [...item.removedIngredientIds].sort() }) === signature,
    )
    if (existing) {
      setItems(items.map((item) => item.cartId === existing.cartId ? { ...item, qty: item.qty + 1 } : item))
    } else {
      const modifierNames = selectedModifiers.flatMap((selection) =>
        it.modifier_groups.flatMap((group) => group.options.filter((option) => option.id === selection.option_id).map((option) => option.name)),
      )
      const modifiersPriceDelta = selectedModifiers.reduce((sum, selection) => {
        for (const group of it.modifier_groups) {
          const option = group.options.find((candidate) => candidate.id === selection.option_id)
          if (option) return sum + option.price_delta * (selection.quantity ?? 1)
        }
        return sum
      }, 0)
      setItems([...items, {
        cartId: crypto.randomUUID(),
        itemId: it.id,
        name: it.name,
        price: it.price,
        qty: 1,
        modifiersPriceDelta,
        selectedModifiers,
        modifierNames,
        removedIngredientIds,
        removedIngredientNames: removedIngredientIds.flatMap((id) => {
          const ingredient = it.ingredients.find((candidate) => candidate.id === id)
          return ingredient ? [ingredient.name] : []
        }),
      }])
    }
    setCustomizing(null)
  }

  function changeQty(cartId: string, delta: number) {
    setItems(
      items
        .map((x) => x.cartId === cartId ? { ...x, qty: Math.max(0, x.qty + delta) } : x)
        .filter((x) => x.qty > 0),
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
        <div style={{ fontSize: 13 }}>Menü yükleniyor…</div>
      </div>
    )
  }

  if (menuItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
        <div style={{ fontSize: 13 }}>Menüde ürün yok</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 6, height: 32,
          padding: '0 10px', background: 'var(--surface-3)', borderRadius: 7, color: 'var(--text-3)',
        }}>
          <I.search size={14} />
          <input
            placeholder="Ürün ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {categories.slice(0, 5).map((cat) => (
            <button key={cat} onClick={() => setActiveCat(cat)} style={{
              height: 32, padding: '0 10px', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500,
              background: activeCat === cat ? 'var(--text)' : 'var(--surface-3)',
              color: activeCat === cat ? '#fff' : 'var(--text-2)',
              cursor: 'pointer',
            }}>{cat}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {filtered.map((it) => {
          const inCart = items.find((x) => x.itemId === it.id)
          return (
            <div
              key={it.id}
              onClick={() => addItem(it)}
              style={{
                padding: 12, borderRadius: 10,
                background: inCart ? 'var(--surface-inset)' : 'var(--surface)',
                border: '1.5px solid ' + (inCart ? 'var(--text)' : 'var(--border)'),
                cursor: 'pointer', transition: 'all 100ms',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, color: 'var(--text)' }}>{it.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{it.categoryName}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ ...S.mono, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>₺{it.price}</span>
                {inCart ? (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button onClick={() => changeQty(inCart.cartId, -1)} style={qtyBtnStyle()}>−</button>
                    <span style={{ ...S.mono, fontSize: 12, fontWeight: 700, minWidth: 18, textAlign: 'center', color: 'var(--text)' }}>
                      {inCart.qty}
                    </span>
                    <button onClick={() => changeQty(inCart.cartId, 1)} style={qtyBtnStyle()}>+</button>
                  </div>
                ) : (
                  <div style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: 'var(--text)', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <I.plus size={12} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {customizing && (
        <DashboardItemCustomizer
          item={customizing}
          onCancel={() => setCustomizing(null)}
          onAdd={(modifiers, removals) => addConfiguredItem(customizing, modifiers, removals)}
        />
      )}
    </div>
  )
}

function DashboardItemCustomizer({
  item,
  onCancel,
  onAdd,
}: {
  item: RealMenuItem
  onCancel: () => void
  onAdd: (modifiers: SelectedMenuModifier[], removedIngredientIds: string[]) => void
}) {
  const initialSelections = item.modifier_groups.flatMap((group) =>
    group.options.filter((option) => option.is_default).map((option) => ({
      group_id: group.id,
      option_id: option.id,
      ...(group.selection_mode === 'quantity' ? { quantity: 1 } : {}),
    })),
  )
  const [selections, setSelections] = useState<SelectedMenuModifier[]>(initialSelections)
  const [removals, setRemovals] = useState<string[]>([])
  const valid = item.modifier_groups.every((group) => {
    const count = selections.filter((selection) => selection.group_id === group.id).reduce(
      (sum, selection) => sum + (group.selection_mode === 'quantity' ? (selection.quantity ?? 1) : 1),
      0,
    )
    return count >= group.min && count <= group.max
  })

  function toggle(group: MenuModifierGroup, optionId: string, checked: boolean) {
    setSelections((current) => {
      const otherGroups = current.filter((selection) => selection.group_id !== group.id)
      const groupSelections = current.filter((selection) => selection.group_id === group.id)
      if (group.selection_mode === 'single') {
        return checked ? [...otherGroups, { group_id: group.id, option_id: optionId }] : otherGroups
      }
      if (!checked) return current.filter((selection) => !(selection.group_id === group.id && selection.option_id === optionId))
      if (groupSelections.length >= group.max) return current
      return [...current, { group_id: group.id, option_id: optionId }]
    })
  }

  function quantity(group: MenuModifierGroup, optionId: string, delta: number) {
    setSelections((current) => {
      const currentGroup = current.filter((selection) => selection.group_id === group.id)
      const total = currentGroup.reduce((sum, selection) => sum + (selection.quantity ?? 1), 0)
      const existing = currentGroup.find((selection) => selection.option_id === optionId)
      if (delta > 0 && total >= group.max) return current
      const next = Math.max(0, (existing?.quantity ?? 0) + delta)
      const without = current.filter((selection) => !(selection.group_id === group.id && selection.option_id === optionId))
      return next > 0 ? [...without, { group_id: group.id, option_id: optionId, quantity: next }] : without
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(17,17,19,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(520px,100%)', maxHeight: '80vh', overflow: 'auto', background: 'var(--surface)', borderRadius: 12, boxShadow: 'var(--shadow-pop)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)', fontSize: 15, fontWeight: 700 }}>{item.name}</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {item.modifier_groups.map((group) => (
            <div key={group.id}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{group.name}{group.required ? ' · Zorunlu' : ''}</div>
              {group.options.map((option) => {
                const selected = selections.find((selection) => selection.group_id === group.id && selection.option_id === option.id)
                return (
                  <div key={option.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 34, borderBottom: '1px solid var(--divider)' }}>
                    <span style={{ fontSize: 12.5 }}>{option.name}{option.price_delta ? ` · +₺${option.price_delta}` : ''}</span>
                    {group.selection_mode === 'quantity' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <button type="button" onClick={() => quantity(group, option.id, -1)} style={qtyBtnStyle()}>−</button>
                        <span style={{ width: 18, textAlign: 'center', fontSize: 12 }}>{selected?.quantity ?? 0}</span>
                        <button type="button" onClick={() => quantity(group, option.id, 1)} style={qtyBtnStyle()}>+</button>
                      </div>
                    ) : (
                      <input
                        type={group.selection_mode === 'single' ? 'radio' : 'checkbox'}
                        name={group.id}
                        checked={Boolean(selected)}
                        onChange={(event) => toggle(group, option.id, event.target.checked)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {item.ingredients.some((ingredient) => ingredient.removable) && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Çıkarma tercihleri</div>
              {item.ingredients.filter((ingredient) => ingredient.removable).map((ingredient) => (
                <label key={ingredient.id} style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 32, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    checked={removals.includes(ingredient.id)}
                    onChange={(event) => setRemovals((current) => event.target.checked ? [...current, ingredient.id] : current.filter((id) => id !== ingredient.id))}
                  />
                  {ingredient.name} çıkarılsın
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} style={btnGhost()}>Vazgeç</button>
          <button type="button" disabled={!valid} onClick={() => onAdd(selections, removals)} style={{ ...btnPrimary(), opacity: valid ? 1 : .5 }}>Siparişe ekle</button>
        </div>
      </div>
    </div>
  )
}

function qtyBtnStyle(): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 5,
    background: 'var(--surface-3)', color: 'var(--text)',
    border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 700, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }
}

function ConfirmPanel() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Son kontrol</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 16 }}>
        Sipariş mutfak ve bara gönderilecek
      </div>

      <div style={{
        padding: 14, background: 'var(--positive-bg)',
        borderRadius: 10, border: '1px solid var(--positive)',
        borderLeft: '3px solid var(--positive)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ color: 'var(--positive)', display: 'flex' }}>
          <I.check size={16} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--positive)' }}>Mutfak hazır</div>
          <div style={{ fontSize: 11, color: 'var(--positive)', opacity: 0.8, marginTop: 1 }}>
            Sipariş "Hazırlanıyor" olarak eklenir
          </div>
        </div>
      </div>
    </div>
  )
}
