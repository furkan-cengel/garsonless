'use client'

import { useEffect, useState } from 'react'
import { Armchair, Check, ChevronLeft, ChevronRight, CircleAlert, Minus, Plus, Search, X } from 'lucide-react'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { createOrderFromDashboard } from '../../lib/actions/orders'
import type { TableStatusData } from '../../lib/queries/pano'
import {
  normalizeIngredients,
  normalizeModifierGroups,
  type MenuIngredient,
  type MenuModifierGroup,
  type SelectedMenuModifier,
} from '@garsonless/db/browser'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

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

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export default function NewOrderModal({ restaurantId, tableStatuses, initialTableId = null, onClose, onCreated }: Props) {
  const [step, setStep] = useState(initialTableId ? 2 : 1)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(initialTableId)
  const [items, setItems] = useState<CartItem[]>([])
  const [menuItems, setMenuItems] = useState<RealMenuItem[]>([])
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((s, i) => s + (i.price + i.modifiersPriceDelta) * i.qty, 0)
  const selectedTable = tableStatuses.find(t => t.id === selectedTableId)
  const nextDisabled = (step === 1 && !selectedTableId) || (step === 2 && items.length === 0) || (step === 3 && items.length === 0) || submitting

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    const load = async () => {
      const catRes = await supabase
        .from('menu_categories')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('position')

      if (catRes.error) {
        setMenuError('Menü kategorileri yüklenemedi.')
        setLoadingMenu(false)
        return
      }

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

      if (itemRes.error) {
        setMenuError('Menü ürünleri yüklenemedi.')
        setLoadingMenu(false)
        return
      }

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(85dvh,720px)] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
      >
        <DialogHeader className="shrink-0 flex-row items-center gap-4 border-b px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg">Yeni sipariş oluştur</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              {selectedTable ? `${selectedTable.label} için sipariş hazırlanıyor` : 'Bir masa seç'}
            </DialogDescription>
          </div>
          <OrderSteps step={step} />
          <DialogClose render={<Button variant="ghost" size="icon" aria-label="Kapat" />}>
            <X />
          </DialogClose>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1.4fr_1fr]">
          <ScrollArea className="min-h-0 border-r max-lg:border-r-0">
            <div className="p-4 sm:p-6">
              {step === 1 && <PickTablePanel tables={tableStatuses} selected={selectedTableId} setSelected={setSelectedTableId} />}
              {step === 2 && (
                <PickItemsPanel items={items} setItems={setItems} menuItems={menuItems} loading={loadingMenu} error={menuError} />
              )}
              {step === 3 && <ConfirmPanel />}
            </div>
          </ScrollArea>
          <OrderSummary selectedTable={selectedTable} items={items} total={total} />
        </div>

        <DialogFooter className="m-0 shrink-0 flex-row flex-wrap items-center justify-between gap-2 rounded-none border-t bg-muted/30 px-5 py-3 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
            {error && <p role="alert" className="truncate text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                <ChevronLeft data-icon="inline-start" />Geri
              </Button>
            )}
            <Button
              type="button"
              disabled={nextDisabled}
              onClick={() => { if (step < 3) setStep(step + 1); else void handleSubmit() }}
            >
              {submitting && <Spinner data-icon="inline-start" />}
              {step === 3 ? (submitting ? 'Gönderiliyor…' : 'Siparişi başlat') : 'Devam'}
              {step < 3 && <ChevronRight data-icon="inline-end" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OrderSteps({ step }: { step: number }) {
  return (
    <div className="hidden items-center gap-1.5 sm:flex" aria-label={`Sipariş adımı ${step}/3`}>
      {[{ n: 1, label: 'Masa' }, { n: 2, label: 'Ürünler' }, { n: 3, label: 'Onay' }].map((item) => (
        <Badge key={item.n} variant={step === item.n ? 'default' : step > item.n ? 'positive' : 'secondary'}>
          {step > item.n ? <Check data-icon="inline-start" /> : item.n} {item.label}
        </Badge>
      ))}
    </div>
  )
}

function OrderSummary({ selectedTable, items, total }: { selectedTable?: TableStatusData; items: CartItem[]; total: number }) {
  return (
    <aside className="hidden min-h-0 flex-col bg-muted/20 lg:flex" aria-label="Sipariş özeti">
      <div className="flex items-center gap-3 border-b p-4">
        <Badge className="size-9 rounded-lg px-0 font-mono">{selectedTable ? selectedTable.label.slice(0, 3) : '-'}</Badge>
        <div className="min-w-0">
          <p className="truncate font-medium">{selectedTable?.label ?? 'Masa seçilmedi'}</p>
          <p className="text-xs text-muted-foreground">{items.length} kalem · {items.reduce((sum, item) => sum + item.qty, 0)} adet</p>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-3">
          {items.map((item) => (
            <Card key={item.cartId} size="sm" className="gap-2 py-3 shadow-none">
              <CardHeader>
                <CardTitle>{item.name}</CardTitle>
                <CardDescription>{formatCurrency(item.price + item.modifiersPriceDelta)} × {item.qty}</CardDescription>
                <CardAction className="font-mono font-semibold tabular-nums">
                  {formatCurrency((item.price + item.modifiersPriceDelta) * item.qty)}
                </CardAction>
              </CardHeader>
              {(item.modifierNames.length > 0 || item.removedIngredientNames.length > 0) && (
                <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {item.modifierNames.length > 0 && <p>{item.modifierNames.join(', ')}</p>}
                  {item.removedIngredientNames.length > 0 && <p className="font-medium text-destructive">Çıkar: {item.removedIngredientNames.join(', ')}</p>}
                </CardContent>
              )}
            </Card>
          ))}
          {items.length === 0 && (
            <Empty className="border-0 py-12">
              <EmptyHeader><EmptyTitle>Henüz ürün eklenmedi</EmptyTitle><EmptyDescription>Soldaki listeden ürün ekleyebilirsin.</EmptyDescription></EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
      <div className="border-t bg-background p-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Ara toplam</span><span className="font-mono tabular-nums">{formatCurrency(total)}</span></div>
        <Separator className="my-3" />
        <div className="flex items-baseline justify-between"><span className="font-medium">Toplam</span><span className="font-mono text-xl font-semibold tabular-nums">{formatCurrency(total)}</span></div>
      </div>
    </aside>
  )
}

const TABLE_STATUS = {
  empty: { label: 'Boş', variant: 'secondary' },
  active: { label: 'Açık adisyon', variant: 'info' },
  new: { label: 'Yeni sipariş', variant: 'warning' },
  late: { label: 'Gecikmeli', variant: 'destructive' },
  stale: { label: 'Eski oturum', variant: 'warning' },
  paid: { label: 'Ödendi', variant: 'positive' },
} as const

function PickTablePanel({ tables, selected, setSelected }: {
  tables: TableStatusData[]
  selected: string | null
  setSelected: (id: string) => void
}) {
  if (tables.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Armchair /></EmptyMedia>
          <EmptyTitle>Henüz masa eklenmedi</EmptyTitle>
          <EmptyDescription>Sipariş oluşturmak için önce bir masa eklemelisin.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <FieldSet>
      <FieldLegend>Hangi masaya sipariş alıyorsun?</FieldLegend>
      <FieldDescription>Boş masa yeni adisyon açar; aktif masa mevcut adisyona ekler.</FieldDescription>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(138px,1fr))] gap-2.5">
        {tables.map((t) => {
          const status = TABLE_STATUS[t.status] ?? TABLE_STATUS.empty
          const isSel = selected === t.id
          return (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-auto min-h-24 items-start justify-start p-3 text-left",
                isSel && "border-primary bg-muted ring-2 ring-primary/15",
              )}
              data-selected={isSel}
              aria-pressed={isSel}
              key={t.id}
              onClick={() => setSelected(t.id)}
            >
              <div className="flex w-full flex-col gap-2">
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="truncate font-semibold">{t.label}</span>
                  {isSel && <Check aria-hidden="true" />}
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
                {t.total > 0 && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(t.unpaidTotal > 0 ? t.unpaidTotal : t.total)}
                  </span>
                )}
              </div>
            </Button>
          )
        })}
      </div>
    </FieldSet>
  )
}

function PickItemsPanel({ items, setItems, menuItems, loading, error }: {
  items: CartItem[]
  setItems: (v: CartItem[]) => void
  menuItems: RealMenuItem[]
  loading: boolean
  error: string | null
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
      <Empty role="status" aria-live="polite" aria-busy="true">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Spinner /></EmptyMedia>
          <EmptyTitle>Menü yükleniyor…</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>{error}</AlertTitle>
        <AlertDescription>Modalı kapatıp yeniden deneyebilirsin.</AlertDescription>
      </Alert>
    )
  }

  if (menuItems.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Menüde ürün yok</EmptyTitle>
          <EmptyDescription>Siparişe eklenebilecek yayınlanmış ürün bulunamadı.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <InputGroup className="sm:flex-1">
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput placeholder="Ürün ara" value={search} onChange={(event) => setSearch(event.target.value)} />
        </InputGroup>
        <ToggleGroup
          value={[activeCat]}
          onValueChange={(values) => { const category = values[0]; if (category) setActiveCat(category) }}
          size="sm"
          spacing={1}
          className="max-w-full overflow-x-auto"
          aria-label="Ürün kategorisi"
        >
          {categories.slice(0, 5).map((category) => (
            <ToggleGroupItem key={category} value={category}>{category}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
        {filtered.map((it) => {
          const inCart = items.find((x) => x.itemId === it.id)
          return (
            <Card key={it.id} size="sm" className={cn("min-h-28 gap-3", inCart && "ring-2 ring-primary")}>
              <CardHeader>
                <CardTitle>{it.name}</CardTitle>
                <CardDescription>{it.categoryName}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto justify-between bg-muted/30">
                <span className="font-mono font-semibold tabular-nums">{formatCurrency(it.price)}</span>
                {inCart ? (
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon-sm" aria-label={`${it.name} miktarını azalt`} onClick={() => changeQty(inCart.cartId, -1)}><Minus /></Button>
                    <span className="min-w-6 text-center font-mono font-semibold tabular-nums">{inCart.qty}</span>
                    <Button type="button" variant="outline" size="icon-sm" aria-label={`${it.name} miktarını artır`} onClick={() => changeQty(inCart.cartId, 1)}><Plus /></Button>
                  </div>
                ) : (
                  <Button type="button" size="icon-sm" aria-label={`${it.name}, ${formatCurrency(it.price)}, siparişe ekle`} onClick={() => addItem(it)}><Plus /></Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <Empty>
          <EmptyHeader><EmptyTitle>Ürün bulunamadı</EmptyTitle><EmptyDescription>Arama veya kategori filtresini değiştirmeyi dene.</EmptyDescription></EmptyHeader>
        </Empty>
      )}
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

  function setChoiceGroup(group: MenuModifierGroup, optionIds: string[]) {
    if (optionIds.length > group.max) return
    setSelections((current) => {
      const otherGroups = current.filter((selection) => selection.group_id !== group.id)
      return [...otherGroups, ...optionIds.map((optionId) => ({ group_id: group.id, option_id: optionId }))]
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
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent showCloseButton={false} className="flex max-h-[80dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-start border-b px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle>{item.name}</DialogTitle>
            <DialogDescription>Ürün seçeneklerini ve çıkarılacak malzemeleri belirle.</DialogDescription>
          </div>
          <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="Kapat" />}><X /></DialogClose>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <FieldGroup className="p-5">
            {item.modifier_groups.map((group) => {
              const groupSelections = selections.filter((selection) => selection.group_id === group.id)
              return (
                <FieldSet key={group.id}>
                  <FieldLegend variant="label">{group.name}{group.required ? ' · Zorunlu' : ''}</FieldLegend>
                  <FieldDescription>En az {group.min}, en fazla {group.max} seçim.</FieldDescription>
                  {group.selection_mode === 'quantity' ? (
                    <div className="flex flex-col gap-2">
                      {group.options.map((option) => {
                        const selected = groupSelections.find((selection) => selection.option_id === option.id)
                        return (
                          <Card key={option.id} size="sm" className="py-3">
                            <CardHeader>
                              <CardTitle>{option.name}</CardTitle>
                              {option.price_delta > 0 && <CardDescription>+{formatCurrency(option.price_delta)}</CardDescription>}
                              <CardAction className="flex items-center gap-1">
                                <Button type="button" variant="outline" size="icon-sm" aria-label={`${option.name} miktarını azalt`} onClick={() => quantity(group, option.id, -1)}><Minus /></Button>
                                <span className="min-w-6 text-center font-mono font-semibold tabular-nums">{selected?.quantity ?? 0}</span>
                                <Button type="button" variant="outline" size="icon-sm" aria-label={`${option.name} miktarını artır`} onClick={() => quantity(group, option.id, 1)}><Plus /></Button>
                              </CardAction>
                            </CardHeader>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <ToggleGroup
                      value={groupSelections.map((selection) => selection.option_id)}
                      onValueChange={(values) => setChoiceGroup(group, values)}
                      multiple={group.selection_mode !== 'single'}
                      orientation="vertical"
                      variant="outline"
                      className="w-full"
                      aria-label={group.name}
                    >
                      {group.options.map((option) => (
                        <ToggleGroupItem key={option.id} value={option.id} className="h-auto w-full justify-between py-2.5">
                          <span>{option.name}</span>
                          {option.price_delta > 0 && <span className="text-muted-foreground">+{formatCurrency(option.price_delta)}</span>}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                </FieldSet>
              )
            })}
            {item.ingredients.some((ingredient) => ingredient.removable) && (
              <FieldSet>
                <FieldLegend variant="label">Çıkarma tercihleri</FieldLegend>
                <FieldDescription>Üründe olmasını istemediğin malzemeleri işaretle.</FieldDescription>
                <FieldGroup data-slot="checkbox-group">
                  {item.ingredients.filter((ingredient) => ingredient.removable).map((ingredient) => {
                    const checked = removals.includes(ingredient.id)
                    return (
                      <Field key={ingredient.id} orientation="horizontal">
                        <Checkbox
                          id={`remove-${ingredient.id}`}
                          checked={checked}
                          onCheckedChange={(nextChecked) => setRemovals((current) => nextChecked ? [...current, ingredient.id] : current.filter((id) => id !== ingredient.id))}
                        />
                        <FieldContent><FieldLabel htmlFor={`remove-${ingredient.id}`}>{ingredient.name} çıkarılsın</FieldLabel></FieldContent>
                      </Field>
                    )
                  })}
                </FieldGroup>
              </FieldSet>
            )}
          </FieldGroup>
        </ScrollArea>
        <DialogFooter className="m-0 flex-row rounded-none px-5 py-3">
          <Button type="button" variant="outline" onClick={onCancel}>Vazgeç</Button>
          <Button type="button" disabled={!valid} onClick={() => onAdd(selections, removals)}>Siparişe ekle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmPanel() {
  return (
    <FieldSet>
      <FieldLegend>Son kontrol</FieldLegend>
      <FieldDescription>Sipariş mutfak ve bara gönderilecek.</FieldDescription>
      <Alert>
        <Check />
        <AlertTitle>Mutfak hazır</AlertTitle>
        <AlertDescription>Sipariş “Hazırlanıyor” olarak eklenir.</AlertDescription>
      </Alert>
    </FieldSet>
  )
}
