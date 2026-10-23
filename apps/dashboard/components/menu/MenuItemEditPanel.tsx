'use client'

import { useMenuDraft, useMenuDrafts } from './MenuDraftProvider'
import { useMenuImageDraft } from './use-menu-image-draft'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { LockKeyhole } from 'lucide-react'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import type { MenuModifierGroup as ModifierGroup } from '@garsonless/db/browser'
import { calculateMarginPercent, parseMenuNumericInput } from '@garsonless/domain/menu'
import { deleteItem, getItemsWithOrderHistory, updateItem } from '../../lib/actions/menu'
import { I, S } from '../../lib/ui'
import NutritionFields, { appendNutritionToFormData, applyNutritionPatch, nutritionFromItem, type NutritionState } from './NutritionFields'
import { MenuConfirmDialog } from './MenuConfirmDialog'
import { isMenuItemEditorDirty, type MenuItemEditorSnapshot } from './menu-item-editor-model'
import { MenuItemEditorFrame } from './MenuItemEditorFrame'
import { ProductDescriptionField, ProductLoyaltyField, ProductNameField, ProductPriceFields, ProductStationField, ProductStatusField } from './MenuProductFields'
import { MenuCategoryPicker, MenuProductPanelTabs, type ProductPanelTab } from './MenuProductPanelChrome'
import { MenuModifierGroupEditor } from './MenuModifierGroupEditor'
import { MenuItemRecommendationEditor } from './MenuItemRecommendationEditor'
import { MenuImageAttachment } from './MenuImageAttachment'

// Loaded on demand: most restaurants are outside the 3D/AR pilot.
const MenuItemArSection = dynamic(() => import('./MenuItemArSection').then((m) => m.MenuItemArSection), { ssr: false })
import { normalizeGroups, focusMenuField, getMissingProductFields } from './menu-manager-utils'
import Link from 'next/link'
import { useMenuSaveFeedback } from './use-menu-save-feedback'

const VAT_RATE_PRESETS = [1, 10, 20]

/* ============================================================
   ITEM EDIT PANEL
   ============================================================ */
export function MenuItemEditPanel({
  item,
  externalPending = false,
  categories,
  categoryVatRate,
  categoryStationId,
  kitchenStations,
  allItems,
  recommendationIds,
  recommendationsAvailable,
  orderingFeaturesEnabled,
  loyaltyStampEnabled,
  onRetryRecommendations,
  restaurantId,
  onClose,
  onSaved,
  onDeleted,
  onError,
  onRecommendationsSaved,
}: {
  item: Tables<'menu_items'>
  externalPending?: boolean
  categories: Tables<'menu_categories'>[]
  categoryVatRate: number
  categoryStationId: string | null
  kitchenStations: Tables<'kitchen_stations'>[]
  allItems: Tables<'menu_items'>[]
  recommendationIds: string[]
  recommendationsAvailable: boolean
  orderingFeaturesEnabled: boolean
  loyaltyStampEnabled: boolean
  onRetryRecommendations: () => void
  restaurantId: string
  onClose: () => void
  onSaved: (updated: Tables<'menu_items'>) => void
  onDeleted: (id: string) => void
  onError: (msg: string) => void
  onRecommendationsSaved: (ids: string[]) => void
}) {
  const [tab, setTab] = useState<ProductPanelTab>('basics')
  useEffect(() => {
    function focusField(event: Event) {
      const detail = (event as CustomEvent<{ itemId: string; field: string }>).detail
      if (detail.itemId === item.id) setTab(detail.field === 'image' ? 'basics' : 'food')
    }
    window.addEventListener('menu-focus-field', focusField)
    return () => window.removeEventListener('menu-focus-field', focusField)
  }, [item.id])
  const [name, setName] = useState(item.name)
  const [categoryId, setCategoryId] = useState(item.category_id)
  // Only products that were never ordered can be deleted; everything else is set passive.
  const [orderHistory, setOrderHistory] = useState<'loading' | 'ordered' | 'never' | 'unknown'>('loading')
  // Checked when Yayın opens, so browsing Temel/Detaylar never waits on it.
  const historyTabOpened = tab === 'publish'
  useEffect(() => {
    if (!historyTabOpened || orderHistory !== 'loading') return
    let cancelled = false
    getItemsWithOrderHistory(restaurantId, [item.id])
      .then((result) => { if (!cancelled) setOrderHistory('error' in result ? 'unknown' : result.itemIds.length > 0 ? 'ordered' : 'never') })
      .catch(() => { if (!cancelled) setOrderHistory('unknown') })
    return () => { cancelled = true }
  }, [historyTabOpened, item.id, orderHistory, restaurantId])
  const [description, setDescription] = useState(item.description ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [vatMode, setVatMode] = useState<'category' | 'custom'>(item.vat_rate == null ? 'category' : 'custom')
  const [vatRate, setVatRate] = useState(String(item.vat_rate ?? categoryVatRate))
  const [stationMode, setStationMode] = useState<'category' | 'custom'>(item.kitchen_station_id == null ? 'category' : 'custom')
  const [kitchenStationId, setKitchenStationId] = useState(item.kitchen_station_id ?? categoryStationId ?? '')
  const [isAvailable, setIsAvailable] = useState(item.is_available)
  const [earnsStamp, setEarnsStamp] = useState<boolean>(item.earns_stamp ?? false)
  const [initialNutrition] = useState<NutritionState>(() => nutritionFromItem(item))
  const [nutri, setNutri] = useState<NutritionState>(() => initialNutrition)
  const setN = (patch: Partial<NutritionState>) => setNutri((current) => applyNutritionPatch(current, patch))
  const [cost, setCost] = useState(item.cost == null ? '' : String(item.cost))
  const [initialImages] = useState<string[]>(() => (Array.isArray(item.images) ? (item.images as string[]) : []))
  const media = useMenuImageDraft(initialImages, restaurantId, item.id)
  const images = media.images
  const router = useRouter()
  const { requestExit } = useMenuDrafts()
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const operationLock = useRef(false)
  const [initialModifiers] = useState<ModifierGroup[]>(() => normalizeGroups(item.modifier_groups))
  const [modifiers, setModifiers] = useState<ModifierGroup[]>(() => initialModifiers)
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [recommendationsDirty, setRecommendationsDirty] = useState(false)
  const marginPercent = calculateMarginPercent(Number(price), cost.trim() === '' ? null : Number(cost))
  const parsedPrice = parseMenuNumericInput(price, { required: true, min: 0.01 })
  const parsedCost = parseMenuNumericInput(cost, { min: 0 })
  const fieldErrors = {
    name: !name.trim() || name.trim().length > 100 ? 'Ad 1-100 karakter olmalıdır.' : undefined,
    description: description.length > 500 ? 'Açıklama en fazla 500 karakter olabilir.' : undefined,
    price: !parsedPrice.ok ? parsedPrice.error : undefined,
    cost: !parsedCost.ok ? parsedCost.error : undefined,
  }
  const currentSnapshot: MenuItemEditorSnapshot = {
    name,
    categoryId,
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
  }
  const savedSnapshotRef = useRef<MenuItemEditorSnapshot & { nutrition: NutritionState; modifiers: ModifierGroup[] }>({
    name: item.name,
    categoryId: item.category_id,
    description: item.description ?? '',
    price: String(item.price),
    cost: item.cost == null ? '' : String(item.cost),
    vatMode: item.vat_rate == null ? 'category' : 'custom',
    vatRate: String(item.vat_rate ?? categoryVatRate),
    stationMode: item.kitchen_station_id == null ? 'category' : 'custom',
    kitchenStationId: item.kitchen_station_id ?? categoryStationId ?? '',
    isAvailable: item.is_available,
    earnsStamp: item.earns_stamp ?? false,
    nutrition: initialNutrition,
    images: initialImages,
    modifiers: initialModifiers,
  })
  const itemIsDirty = isMenuItemEditorDirty(currentSnapshot, savedSnapshotRef.current)
  const isDirty = itemIsDirty || recommendationsDirty
  const { state: itemSaveState, markSaved: markItemSaved } = useMenuSaveFeedback({
    dirty: itemIsDirty,
    saving: isPending,
  })

  useMenuDraft(isDirty, isPending || deleting || externalPending, () => {
    const saved = savedSnapshotRef.current
    setName(saved.name); setCategoryId(saved.categoryId); setDescription(saved.description); setPrice(saved.price); setCost(saved.cost)
    setVatMode(saved.vatMode); setVatRate(saved.vatRate); setStationMode(saved.stationMode)
    setKitchenStationId(saved.kitchenStationId); setIsAvailable(saved.isAvailable); setEarnsStamp(saved.earnsStamp)
    setNutri(saved.nutrition); setModifiers(saved.modifiers); media.discard()
    setSaveError(null); setConflict(false)
  })

  function handleUpload(file: File) {
    if (operationLock.current || externalPending) return
    try { media.select(file) } catch (error) { onError(error instanceof Error ? error.message : 'Görsel seçilemedi.') }
  }

  function handleSave() {
    if (!itemIsDirty || operationLock.current || externalPending) return
    setValidationAttempted(true)
    if (Object.values(fieldErrors).some(Boolean)) {
      document.getElementById(`${item.id}-${Object.keys(fieldErrors).find((key) => fieldErrors[key as keyof typeof fieldErrors])}`)?.focus()
      return
    }
    operationLock.current = true
    setSaveError(null)
    setConflict(false)
    startTransition(async () => {
      try {
        const resolvedImages = await media.resolve()
        const fd = new FormData()
        fd.append('id', item.id)
        fd.append('expectedUpdatedAt', item.updated_at)
        fd.append('restaurantId', restaurantId)
        fd.append('name', name)
        if (categoryId !== item.category_id) fd.append('categoryId', categoryId)
        fd.append('description', description)
        fd.append('price', price)
        fd.append('vat_rate', vatMode === 'category' ? '' : vatRate)
        fd.append('kitchen_station_id', stationMode === 'category' ? '' : kitchenStationId)
        fd.append('is_available', String(isAvailable))
        if (loyaltyStampEnabled) fd.append('earns_stamp', String(earnsStamp))
        appendNutritionToFormData(fd, nutri)
        fd.append('cost', cost)
        fd.append('images', JSON.stringify(resolvedImages))
        fd.append('modifier_groups', JSON.stringify(modifiers))
        const result = await updateItem(fd)
        if ('error' in result) {
          setSaveError(result.error)
          setConflict(result.code === 'conflict')
          onError(result.error)
          return
        }
        media.commit(resolvedImages)
        savedSnapshotRef.current = { ...currentSnapshot, nutrition: nutri, modifiers, images: resolvedImages }
        markItemSaved()
        onSaved(result.item)
      } catch {
        setSaveError('Ürün kaydedilemedi. Taslağın korundu; bağlantını kontrol edip tekrar deneyebilirsin.')
      } finally { operationLock.current = false }
    })
  }

  function handleDelete() {
    setDeleteConfirmOpen(true)
  }

  function confirmDelete() {
    if (operationLock.current || externalPending) return
    operationLock.current = true
    setDeleting(true)
    startTransition(async () => {
      try {
        const result = await deleteItem(item.id, restaurantId)
        if ('error' in result) {
          setDeleting(false)
          onError(result.error)
          return
        }
        setDeleteConfirmOpen(false)
        onDeleted(item.id)
      } catch { onError('Ürün silinemedi. Bağlantını kontrol edip tekrar deneyin.') }
      finally { setDeleting(false); operationLock.current = false }
    })
  }


  const mainImage = images[0] ?? null
  const missingFields = getMissingProductFields({ ...item, description, images, ingredients: nutri.ingredients.map((ingredient) => ({ ...ingredient })), energy_kcal: nutri.energyKcal.trim() ? Number(nutri.energyKcal) : null, food_info_reviewed_at: nutri.reviewed ? item.updated_at : null })
  const pickedCategory = categories.find((category) => category.id === categoryId)
  const parentCategory = pickedCategory?.parent_id ? categories.find((category) => category.id === pickedCategory.parent_id) : null
  const categoryPath = [parentCategory?.name, pickedCategory?.name].filter(Boolean).join(' · ')

  function handleRemoveImage() {
    if (!operationLock.current && !externalPending) media.remove()
  }

  return (
    <MenuItemEditorFrame
      busy={isPending || deleting || externalPending}
      itemId={item.id}
      title={name.trim() || item.name}
      subtitle={`${categoryPath} · ₺${parsedPrice.ok ? parsedPrice.value : item.price}`}
      position={item.position}
      createdAt={item.created_at}
      updatedAt={item.updated_at}
      onClose={onClose}
      footer={
        <>
          {(itemIsDirty || recommendationsDirty) && itemSaveState !== 'saving' && (
            <p aria-live="polite" style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--warning)' }}>
              {itemIsDirty ? 'Kaydedilmemiş değişiklikler var.' : 'Öneriler henüz kaydedilmedi.'}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              className="menu-item-footer-action menu-item-cancel-action"
              type="button"
              variant="outline"
              size="lg"
              onClick={onClose}
              disabled={externalPending || deleting || isPending}
              style={{ flex: 1 }}
            >
              İptal
            </Button>
            <Button
              className="menu-item-footer-action menu-item-save-action menu-save-action"
              type="button"
              onClick={handleSave}
              disabled={externalPending || deleting || itemSaveState !== 'dirty'}
              aria-busy={itemSaveState === 'saving'}
              data-save-state={itemSaveState}
              variant={itemSaveState === 'saved' ? 'positive' : itemSaveState === 'clean' ? 'secondary' : 'default'}
              size="lg"
              style={{ flex: 1 }}
            >
              {itemSaveState === 'saving' ? (
                <>
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                  Kaydediliyor…
                </>
              ) : itemSaveState === 'saved' ? (
                <>
                  <I.check size={13} />
                  Kaydedildi
                </>
              ) : itemSaveState === 'clean' ? (
                'Değişiklikler güncel'
              ) : (
                'Değişiklikleri kaydet'
              )}
            </Button>
          </div>
        </>
      }
      overlay={
        deleteConfirmOpen ? (
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
        ) : null
      }
    >
      {saveError && <Alert variant="destructive">
        <AlertDescription>{saveError}</AlertDescription>
        {conflict && <Button type="button" variant="outline" onClick={() => requestExit(() => router.refresh())}>Güncel ürünü yükle</Button>}
      </Alert>}
      <Tabs value={tab} onValueChange={(value) => setTab(value as ProductPanelTab)}>
      <MenuProductPanelTabs mode="edit" done={{ basics: Boolean(name.trim()) && parsedPrice.ok && images.length > 0, food: !missingFields.some((entry) => entry.field !== 'image') }} />
      <MenuCompletion itemId={item.id} missing={missingFields} />
      <PanelGroup id="basics" itemId={item.id} title="Temel bilgiler">
      <FieldGroup className="gap-4 p-5">
        <ProductNameField id={`${item.id}-name`} value={name} onChange={setName} error={validationAttempted ? fieldErrors.name : undefined} />
        <MenuCategoryPicker idPrefix={item.id} categories={categories} value={categoryId} onChange={setCategoryId} />
        <ProductPriceFields idPrefix={item.id} price={price} cost={cost} onPriceChange={setPrice} onCostChange={setCost}
          priceError={validationAttempted ? fieldErrors.price : undefined} costError={validationAttempted ? fieldErrors.cost : undefined} marginPercent={marginPercent} />
        <FieldSet className="gap-3 rounded-lg border bg-muted/20 p-3">
          <FieldLegend variant="label" className="text-xs font-semibold">KDV oranı · etkin %{vatMode === 'category' ? categoryVatRate : Number(vatRate) || 0}</FieldLegend>
          <ToggleGroup aria-label="KDV oranı kaynağı" value={[vatMode]} onValueChange={(values) => { const value = values[0]; if (value === 'category' || value === 'custom') setVatMode(value) }} variant="outline" size="sm" spacing={1} className="grid w-full grid-cols-2">
            <ToggleGroupItem value="category" className="min-w-0 px-2 text-[11px] aria-pressed:bg-primary aria-pressed:text-primary-foreground">Kategori oranı (%{categoryVatRate})</ToggleGroupItem>
            <ToggleGroupItem value="custom" className="min-w-0 px-2 text-[11px] aria-pressed:bg-primary aria-pressed:text-primary-foreground">Özel oran</ToggleGroupItem>
          </ToggleGroup>
          {vatMode === 'custom' && (
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_76px] gap-1.5">
              <ToggleGroup aria-label="Hazır KDV oranları" value={VAT_RATE_PRESETS.includes(Number(vatRate)) ? [String(Number(vatRate))] : []} onValueChange={(values) => { if (values[0]) setVatRate(values[0]) }} variant="outline" size="sm" spacing={1} className="col-span-3 grid grid-cols-3">
                {VAT_RATE_PRESETS.map((rate) => <ToggleGroupItem key={rate} value={String(rate)} className="aria-pressed:bg-primary aria-pressed:text-primary-foreground">%{rate}</ToggleGroupItem>)}
              </ToggleGroup>
              <Input aria-label="Özel ürün KDV oranı" type="number" min={0.01} max={100} step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="h-7 text-right font-mono text-xs" />
            </div>
          )}
          <FieldDescription className="text-[11px]">Fiyatlar müşteriye KDV dahil görünür.</FieldDescription>
        </FieldSet>
        <Field data-menu-field="image">
          <FieldLabel>Fotoğraf</FieldLabel>
          <MenuImageAttachment title="Ürün görseli" imageUrl={mainImage} imageAlt={item.name} uploading={isPending} onFileSelected={handleUpload} onAssetSelected={media.selectExisting} onRemove={handleRemoveImage}
            description={mainImage?.startsWith('blob:') ? 'Taslak · Kaydet ile yayımlanır' : mainImage ? 'Değişiklikler Kaydet ile yayımlanır' : 'JPG, PNG, WebP veya AVIF'} />
        </Field>
        <Field>
          <FieldLabel>Varyantlar</FieldLabel>
          <MenuModifierGroupEditor groups={modifiers} onChange={(next) => { setModifiers(next); setN({ reviewed: false }) }} />
        </Field>
      </FieldGroup>
      </PanelGroup>

      <PanelGroup id="food" itemId={item.id} title="Gıda bilgileri">
      <FieldGroup className="gap-4 px-5 pt-5">
        <ProductDescriptionField id={`${item.id}-description`} value={description} onChange={setDescription} error={validationAttempted ? fieldErrors.description : undefined} />
      </FieldGroup>
      {/* İçindekiler · Alerjenler · Özel içerik · Kontrol */}
      <NutritionFields s={nutri} set={setN} />
      {images.length > 1 && (
        <PanelSection title="Galeri">
          <div style={{ display: 'flex', gap: 6 }}>
            {images.slice(1).map((url, i) => (
              <div key={i} style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </PanelSection>
      )}
      <PanelSection title="Yanında iyi gider">
        {!orderingFeaturesEnabled ? (
          <FeatureLockNotice description="Ürün önerileri, misafirin sepete ekleme ve sipariş akışıyla birlikte Pro paketinde açılır." />
        ) : recommendationsAvailable ? (
          <MenuItemRecommendationEditor
            restaurantId={restaurantId}
            sourceItem={item}
            allItems={allItems}
            initialIds={recommendationIds}
            onSaved={onRecommendationsSaved}
            onError={onError}
            onDirtyChange={setRecommendationsDirty}
          />
        ) : (
          <div role="status" style={{ display: 'grid', gap: 8, color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.45 }}>
            <span>Ürün önerileri şu anda yüklenemiyor. Menünün diğer alanlarını düzenlemeye devam edebilirsin.</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetryRecommendations}>
              Önerileri yeniden yükle
            </Button>
          </div>
        )}
      </PanelSection>

      </PanelGroup>

      <PanelGroup id="publish" itemId={item.id} title="Yayın ayarları">

      <div className="flex flex-col gap-3 p-5">
        <ProductStatusField isAvailable={isAvailable} onChange={setIsAvailable} hint={isAvailable ? 'Misafirler bu ürünü menüde görür.' : 'Ürün misafir menüsünde gizlenir; sipariş geçmişi korunur.'} />
        <ProductLoyaltyField id={`${item.id}-earns-stamp`} enabled={loyaltyStampEnabled} checked={earnsStamp} onChange={setEarnsStamp} />
        <ProductStationField id={`${item.id}-station`} restaurantId={restaurantId} stations={kitchenStations} mode={stationMode} onModeChange={setStationMode} stationId={kitchenStationId} onStationChange={setKitchenStationId} categoryStationId={categoryStationId} />
      </div>
      <MenuItemArSection restaurantId={restaurantId} itemId={item.id} itemName={item.name} imageUrl={images[0] ?? null} />

      <div className="flex flex-col gap-3 px-5 pb-5">
        <Link className="text-sm underline" href={`/dashboard/${restaurantId}/inventory?menuItemId=${item.id}`}>Stok ve reçete</Link>
      </div>

      {/* Silme: yalnız hiç sipariş edilmemiş ürünler */}
      <div style={{ margin: '0 20px', padding: '12px 0 20px', borderTop: '1px solid var(--divider)', display: 'grid', gap: 6 }}>
        {orderHistory === 'ordered' ? (
          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
            Bu ürünün sipariş geçmişi var; silinemez. Misafirlerden gizlemek için yukarıdan <strong>Pasif</strong> seçebilirsin.
          </p>
        ) : (
          <>
            <Button className="menu-item-delete-action justify-self-start" type="button" variant="outline" onClick={handleDelete} disabled={orderHistory === 'loading' || externalPending || deleting || isPending} style={{ color: 'var(--critical)' }}>
              <I.trash data-icon="inline-start" />
              Ürünü sil
            </Button>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
              {orderHistory === 'never' ? 'Henüz hiç sipariş edilmedi; menüden tamamen kaldırılabilir.' : orderHistory === 'loading' ? 'Sipariş geçmişi kontrol ediliyor…' : 'Sipariş geçmişi olan ürünler silinemez; gerekirse pasife al.'}
            </p>
          </>
        )}
      </div>
      </PanelGroup>
      </Tabs>
    </MenuItemEditorFrame>
  )
}

function FeatureLockNotice({ description }: { description: string }) {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3 text-muted-foreground">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
      <div className="grid gap-0.5 text-[11.5px] leading-relaxed">
        <strong className="font-semibold text-foreground">Pro ile açılır</strong>
        <span>{description}</span>
      </div>
    </div>
  )
}


/** Same three groups as the new-product wizard, so editing reads like creating. */
function PanelGroup({ id, itemId, title, children }: { id: ProductPanelTab; itemId: string; title: string; children: ReactNode }) {
  return (
    <TabsContent value={id} keepMounted><section id={`menu-item-${itemId}-${id}`} data-menu-panel-group={id} aria-label={title} style={{ scrollMarginTop: 44 }}>
      {children}
    </section></TabsContent>
  )
}

/** Compact "to complete" band under the tabs: each gap, why it matters, and a Fix that jumps to the field. */
function MenuCompletion({ itemId, missing }: { itemId: string; missing: ReturnType<typeof getMissingProductFields> }) {
  if (!missing.length) return null
  return (
    <section aria-label="Tamamlanacak bilgiler" className="menu-completion-band">
      <div className="menu-completion-title">Tamamlanacak ({missing.length})</div>
      <ul>
        {missing.map((entry) => (
          <li key={entry.field}>
            <span className="menu-completion-mark" aria-hidden="true">!</span>
            <span className="min-w-0 flex-1"><strong>{entry.label}</strong> · {entry.consequence}</span>
            <Button type="button" variant="outline" size="xs" onClick={() => focusMenuField(itemId, entry.field)}>Düzelt</Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ ...S.label, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}


