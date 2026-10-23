'use client'

import { useMenuDraft } from './MenuDraftProvider'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { Tables } from '@garsonless/db/types'
import { parseMenuNumericInput } from '@garsonless/domain/menu'
import { createItem } from '../../lib/actions/menu'
import { I } from '../../lib/ui'
import NutritionFields, { nutritionFromItem, appendNutritionToFormData, applyNutritionPatch, NutritionStatusPill, type NutritionState } from './NutritionFields'
import { MenuImageAttachment } from './MenuImageAttachment'
import { useMenuImageDraft } from './use-menu-image-draft'
import { MenuModifierGroupEditor } from './MenuModifierGroupEditor'
import { ProductDescriptionField, ProductLoyaltyField, ProductNameField, ProductPriceFields, ProductStationField, ProductStatusField } from './MenuProductFields'
import { MenuCategoryPicker, MenuProductPanelHeader, MenuProductPanelTabs, PRODUCT_PANEL_TABS } from './MenuProductPanelChrome'
import { Tabs } from '@/components/ui/tabs'
import type { MenuModifierGroup } from '@garsonless/db/browser'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { isNewMenuItemDraftDirty, type NewMenuItemDraftSnapshot } from './menu-item-editor-model'


/**
 * New product in the same three-tab panel as the editor, walked in order:
 *   1 Temel — ad / kategori / satış / maliyet / fotoğraf / varyantlar
 *   2 Detaylar — açıklama + shared NutritionFields
 *   3 Yayın — durum / sadakat damgası / mutfak istasyonu
 * Photo selection stays local until submission; variants and images are saved with the product.
 */
export default function NewProductDrawer({
  restaurantId,
  categoryId: initialCategoryId,
  categories,
  kitchenStations,
  loyaltyStampEnabled,
  onClose,
  onCreated,
}: {
  restaurantId: string
  categoryId: string
  categories: Tables<'menu_categories'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  loyaltyStampEnabled: boolean
  onClose: () => void
  onCreated: (item: Tables<'menu_items'>) => void
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const selectedCategory = categories.find((category) => category.id === categoryId)
  const categoryStationId = selectedCategory?.kitchen_station_id
    ?? categories.find((category) => category.id === selectedCategory?.parent_id)?.kitchen_station_id
    ?? null
  const [draftId] = useState(() => crypto.randomUUID())
  const media = useMenuImageDraft([], restaurantId, draftId)
  const [modifiers, setModifiers] = useState<MenuModifierGroup[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [earnsStamp, setEarnsStamp] = useState(false)
  const [stationMode, setStationMode] = useState<'category' | 'custom'>('category')
  const [kitchenStationId, setKitchenStationId] = useState(() => categories.find((category) => category.id === initialCategoryId)?.kitchen_station_id ?? '')
  const [initialNutrition] = useState<NutritionState>(() => nutritionFromItem(null))
  const [nutri, setNutri] = useState<NutritionState>(() => initialNutrition)
  const setN = (patch: Partial<NutritionState>) => setNutri((current) => applyNutritionPatch(current, patch))
  const [err, setErr] = useState<string | null>(null)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const onCloseRef = useRef(onClose)
  const pendingRef = useRef(pending)
  const discardConfirmOpenRef = useRef(discardConfirmOpen)
  const initialDraftRef = useRef<NewMenuItemDraftSnapshot>({
    name: '',
    description: '',
    price: '',
    cost: '',
    isAvailable: true,
    earnsStamp: false,
    stationMode: 'category',
    kitchenStationId: categories.find((category) => category.id === initialCategoryId)?.kitchen_station_id ?? '',
    nutrition: initialNutrition,
  })
  const isDirty = media.images.length > 0 || modifiers.length > 0 || isNewMenuItemDraftDirty(
    {
      name,
      description,
      price,
      cost,
      isAvailable,
      earnsStamp,
      stationMode,
      kitchenStationId,
      nutrition: nutri,
    },
    initialDraftRef.current,
  )
  useMenuDraft(isDirty, pending, () => onCloseRef.current())
  const dirtyRef = useRef(isDirty)

  onCloseRef.current = onClose
  pendingRef.current = pending
  discardConfirmOpenRef.current = discardConfirmOpen
  dirtyRef.current = isDirty

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const focusFrame = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    function handleKeyDown(event: KeyboardEvent) {
      if (discardConfirmOpenRef.current) return
      if (event.key === 'Escape') {
        if (pendingRef.current) return
        event.preventDefault()
        event.stopImmediatePropagation()
        if (dirtyRef.current) setDiscardConfirmOpen(true)
        else onCloseRef.current()
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  const parsedPrice = parseMenuNumericInput(price, {
    required: true,
    min: 0.01,
  })
  const parsedCost = parseMenuNumericInput(cost, { min: 0 })
  const step1Valid = name.trim().length > 0 && parsedPrice.ok && parsedCost.ok

  function create() {
    setErr(null)
    startTransition(async () => {
      try {
        const resolvedImages = await media.resolve()
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('categoryId', categoryId)
        fd.append('name', name.trim())
        fd.append('description', description.trim())
        fd.append('price', price)
        fd.append('cost', cost)
        fd.append('kitchen_station_id', stationMode === 'category' ? '' : kitchenStationId)
        fd.append('is_available', String(isAvailable))
        if (loyaltyStampEnabled) fd.append('earns_stamp', String(earnsStamp))
        fd.append('modifier_groups', JSON.stringify(modifiers))
        fd.append('images', JSON.stringify(resolvedImages))
        appendNutritionToFormData(fd, nutri)
        const res = await createItem(null, fd)
        if ('error' in res) {
          setErr(res.error)
          return
        }
        media.commit(resolvedImages)
        onCreated(res.item)
      } catch (error) {
        console.error('[menu-item-create-error]', error)
        setErr('Ürün oluşturulamadı. Bağlantıyı kontrol edip tekrar deneyin.')
      }
    })
  }

  const next = () => {
    if (step < 3) setStep(step + 1)
    else create()
  }
  const requestClose = () => {
    if (pending) return
    if (isDirty) setDiscardConfirmOpen(true)
    else onClose()
  }

  return (
    <aside className="menu-item-editor new-product-overlay" aria-labelledby="new-product-title" style={{ width: 'var(--props)', minWidth: 0, minHeight: 0, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        className="new-product-drawer"
        ref={drawerRef}
        role="region"
        aria-hidden={discardConfirmOpen ? true : undefined}
        inert={discardConfirmOpen ? true : undefined}
        aria-labelledby="new-product-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          minHeight: 0,
          flex: 1,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        <MenuProductPanelHeader
          headingId="new-product-title"
          title={name.trim() || 'Yeni ürün'}
          subtitle={`Taslak · adım ${step}/3`}
          closeLabel="Yeni ürün panelini kapat"
          busy={pending}
          onClose={requestClose}
        />
        <Tabs value={PRODUCT_PANEL_TABS[step - 1]!.id} onValueChange={(value) => setStep(PRODUCT_PANEL_TABS.findIndex((tab) => tab.id === value) + 1)}>
          {/* Create is linear: earlier steps stay reachable, later ones open with İleri. */}
          <MenuProductPanelTabs mode="create" reachable={(tab) => PRODUCT_PANEL_TABS.findIndex((entry) => entry.id === tab) < step} />
        </Tabs>

        <div className="new-product-content" style={{ flex: 1, overflow: 'auto' }}>
          {err && (
            <Alert className="m-4 w-auto" variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          {step === 1 && (
            <FieldGroup className="gap-4 p-5">
              <ProductNameField id="new-product-name" inputRef={nameInputRef} value={name} onChange={setName} />
              <MenuCategoryPicker idPrefix="new-product" categories={categories} value={categoryId} onChange={setCategoryId} disabled={pending} />
              <ProductPriceFields idPrefix="new-product" price={price} cost={cost} onPriceChange={setPrice} onCostChange={setCost} />
              <Field>
                <FieldLabel>Fotoğraf</FieldLabel>
                <MenuImageAttachment title="Ürün görseli" imageUrl={media.images[0] ?? null} imageAlt={name || 'Yeni ürün'} uploading={pending} onFileSelected={(file) => {
                  try { media.select(file) } catch (error) { setErr(error instanceof Error ? error.message : 'Görsel seçilemedi.') }
                }} onAssetSelected={media.selectExisting} onRemove={media.remove} description="Fotoğraf ürün oluşturulduğunda kaydedilir." />
              </Field>
              <Field>
                <FieldLabel>Varyantlar</FieldLabel>
                <MenuModifierGroupEditor groups={modifiers} onChange={(groups) => { setModifiers(groups); setN({ reviewed: false }) }} />
              </Field>
            </FieldGroup>
          )}

          {step === 2 && (
            <>
              <FieldGroup className="gap-4 px-5 pt-5">
                <ProductDescriptionField id="new-product-description" value={description} onChange={setDescription} />
              </FieldGroup>
              <NutritionFields s={nutri} set={setN} />
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3 p-5">
              <ProductStatusField isAvailable={isAvailable} onChange={setIsAvailable} />
              <ProductLoyaltyField id="new-product-earns-stamp" enabled={loyaltyStampEnabled} checked={earnsStamp} onChange={setEarnsStamp} />
              <ProductStationField id="new-product-station" restaurantId={restaurantId} stations={kitchenStations} mode={stationMode} onModeChange={setStationMode} stationId={kitchenStationId} onStationChange={setKitchenStationId} categoryStationId={categoryStationId} />

              <div className="mt-0.5">
                <NutritionStatusPill s={nutri} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="new-product-footer"
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--divider)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button className="new-product-action new-product-action-secondary" type="button" variant="outline" size="lg" disabled={pending} onClick={step > 1 ? () => setStep(step - 1) : requestClose}>
            {step > 1 ? 'Geri' : 'İptal'}
          </Button>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button className="new-product-action new-product-action-primary" type="button" size="lg" aria-busy={pending} disabled={pending || (step === 1 && !step1Valid)} onClick={next}>
              {pending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {pending ? 'Oluşturuluyor…' : step === 3 ? 'Ürünü oluştur' : 'İleri'}
              {step < 3 && !pending && <I.chevRight data-icon="inline-end" size={13} />}
            </Button>
          </div>
        </div>
      </div>
      {discardConfirmOpen && (
        <UnsavedChangesDialog
          description="Yeni ürün taslağındaki bilgiler henüz kaydedilmedi. Çıkarsan taslak silinecek."
          discardLabel="Taslağı sil"
          keepLabel="Düzenlemeye dön"
          onKeepEditing={() => setDiscardConfirmOpen(false)}
          onDiscard={() => onCloseRef.current()}
        />
      )}
    </aside>
  )
}
