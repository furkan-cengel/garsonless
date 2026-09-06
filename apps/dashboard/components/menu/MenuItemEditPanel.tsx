'use client'

import { useMenuDraft, useMenuDrafts } from './MenuDraftProvider'
import { useMenuImageDraft } from './use-menu-image-draft'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { LockKeyhole } from 'lucide-react'

import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import type { MenuModifierGroup as ModifierGroup } from '@garsonless/db/browser'
import { calculateMarginPercent, parseMenuNumericInput } from '@garsonless/domain/menu'
import { deleteItem, updateItem } from '../../lib/actions/menu'
import { I, S } from '../../lib/ui'
import NutritionFields, { appendNutritionToFormData, applyNutritionPatch, nutritionFromItem, NutritionStatusPill, type NutritionState } from './NutritionFields'
import { MenuConfirmDialog } from './MenuConfirmDialog'
import { isMenuItemEditorDirty, type MenuItemEditorSnapshot } from './menu-item-editor-model'
import { MenuItemEditorFrame } from './MenuItemEditorFrame'
import { MenuModifierGroupEditor } from './MenuModifierGroupEditor'
import { MenuItemRecommendationEditor } from './MenuItemRecommendationEditor'
import { MenuImageAttachment } from './MenuImageAttachment'
import { normalizeGroups, tintFor } from './menu-manager-utils'
import { useMenuSaveFeedback } from './use-menu-save-feedback'

const VAT_RATE_PRESETS = [1, 10, 20]

/* ============================================================
   ITEM EDIT PANEL
   ============================================================ */
export function MenuItemEditPanel({
  item,
  externalPending = false,
  categoryName,
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
  categoryName: string
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
  const [name, setName] = useState(item.name)
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
  const tint = tintFor(item.id)
  const marginPercent = calculateMarginPercent(Number(price), cost.trim() === '' ? null : Number(cost))
  const parsedPrice = parseMenuNumericInput(price, { required: true, min: 0.01 })
  const parsedCost = parseMenuNumericInput(cost, { min: 0 })
  const fieldErrors = {
    name: !name.trim() || name.trim().length > 100 ? 'Ad 1–100 karakter olmalıdır.' : undefined,
    description: description.length > 500 ? 'Açıklama en fazla 500 karakter olabilir.' : undefined,
    price: !parsedPrice.ok ? parsedPrice.error : undefined,
    cost: !parsedCost.ok ? parsedCost.error : undefined,
  }
  const fieldProps = (key: keyof typeof fieldErrors) => ({
    id: `${item.id}-${key}`,
    'aria-invalid': validationAttempted && Boolean(fieldErrors[key]),
    'aria-describedby': validationAttempted && fieldErrors[key] ? `${item.id}-${key}-error` : undefined,
  })
  const currentSnapshot: MenuItemEditorSnapshot = {
    name,
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
    setName(saved.name); setDescription(saved.description); setPrice(saved.price); setCost(saved.cost)
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

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    background: 'var(--surface-2)',
    border: '1px solid var(--divider)',
    borderRadius: 6,
    fontSize: 12.5,
    color: 'var(--text)',
    outline: 'none',
  }

  const mainImage = images[0] ?? null

  function handleRemoveImage() {
    if (!operationLock.current && !externalPending) media.remove()
  }

  return (
    <MenuItemEditorFrame
      busy={isPending || deleting || externalPending}
      itemId={item.id}
      itemName={item.name}
      position={item.position}
      createdAt={item.created_at}
      updatedAt={item.updated_at}
      tint={tint}
      onClose={onClose}
      footer={
        <>
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <NutritionStatusPill s={nutri} />
              <span aria-live="polite">
                {itemSaveState === 'saving' ? (
                  <Badge variant="secondary">
                    <Spinner aria-hidden="true" className="size-3" />
                    Kaydediliyor…
                  </Badge>
                ) : itemIsDirty ? (
                  <Badge variant="warning">Kaydedilmemiş değişiklik</Badge>
                ) : recommendationsDirty ? (
                  <Badge variant="warning">Öneriler kaydedilmedi</Badge>
                ) : itemSaveState === 'saved' ? (
                  <Badge variant="positive">
                    <I.check size={11} />
                    Kaydedildi
                  </Badge>
                ) : (
                  <Badge variant="positive">
                    <I.check size={11} />
                    Değişiklikler güncel
                  </Badge>
                )}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              className="menu-item-footer-action menu-item-delete-action"
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={externalPending || deleting || isPending}
              style={{ flex: 1 }}
            >
              <I.trash size={13} />
              Sil
            </Button>
            <Button
              className="menu-item-footer-action menu-item-save-action menu-save-action"
              type="button"
              onClick={handleSave}
              disabled={externalPending || deleting || itemSaveState !== 'dirty'}
              aria-busy={itemSaveState === 'saving'}
              data-save-state={itemSaveState}
              variant={itemSaveState === 'saved' ? 'positive' : itemSaveState === 'clean' ? 'secondary' : 'default'}
              style={{ flex: 2 }}
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
      {/* Image */}
      <div style={{ padding: 16 }}>
        <MenuImageAttachment
          className="menu-product-image-attachment"
          mediaClassName="text-[rgba(17,17,19,.34)]"
          mediaStyle={{ background: tint }}
          imageUrl={mainImage}
          title={`${item.name} görseli`}
          description={mainImage?.startsWith('blob:') ? 'Taslak · Kaydet ile yayımlanır' : mainImage ? 'Değişiklikler Kaydet ile yayımlanır' : 'JPG, PNG, WebP veya AVIF'}
          imageAlt={item.name}
          uploading={isPending}
          orientation="vertical"
          placeholder={<I.menuDish size={58} />}
          onFileSelected={handleUpload}
          onRemove={handleRemoveImage}
        />
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {images.slice(1).map((url, i) => (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                }}
              >
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Genel */}
      <PanelSection title="Genel">
        <FieldRow label="Ad" htmlFor={`${item.id}-name`} error={validationAttempted ? fieldErrors.name : undefined}>
          <Input {...fieldProps('name')} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </FieldRow>
        <FieldRow label="Açıklama" htmlFor={`${item.id}-description`} error={validationAttempted ? fieldErrors.description : undefined}>
          <Textarea {...fieldProps('description')} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
        </FieldRow>
        <FieldRow label="Kategori">
          <span
            style={{
              display: 'inline-flex',
              padding: '3px 9px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {categoryName}
          </span>
        </FieldRow>
        <FieldRow label="İstasyon">
          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
              }}
            >
              <Button
                type="button"
                aria-pressed={stationMode === 'category'}
                onClick={() => setStationMode('category')}
                style={{
                  height: 32,
                  borderRadius: 7,
                  border: `1px solid ${stationMode === 'category' ? 'var(--text)' : 'var(--border)'}`,
                  background: stationMode === 'category' ? 'var(--text)' : 'var(--surface)',
                  color: stationMode === 'category' ? 'var(--surface)' : 'var(--text-2)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Kategori
              </Button>
              <Button
                type="button"
                aria-pressed={stationMode === 'custom'}
                onClick={() => setStationMode('custom')}
                style={{
                  height: 32,
                  borderRadius: 7,
                  border: `1px solid ${stationMode === 'custom' ? 'var(--text)' : 'var(--border)'}`,
                  background: stationMode === 'custom' ? 'var(--text)' : 'var(--surface)',
                  color: stationMode === 'custom' ? 'var(--surface)' : 'var(--text-2)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Özel
              </Button>
            </div>
            {stationMode === 'custom' ? (
              <div>
                <NativeSelect value={kitchenStationId} onChange={(e) => setKitchenStationId(e.target.value)} style={inputStyle}>
                  <NativeSelectOption value="">Atanmamış</NativeSelectOption>
                  {kitchenStations
                    .filter((station) => station.is_active)
                    .map((station) => (
                      <NativeSelectOption key={station.id} value={station.id}>
                        {station.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
                {kitchenStations.length === 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: 'var(--text-3)',
                      lineHeight: 1.4,
                    }}
                  >
                    Henüz istasyon yok.{' '}
                    <a href={`/dashboard/${restaurantId}/settings#kitchen-stations`} style={{ color: 'var(--text)', fontWeight: 700 }}>
                      İstasyon oluştur
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-3)',
                  lineHeight: 1.4,
                }}
              >
                {categoryStationId
                  ? `Kategori varsayılanı: ${kitchenStations.find((station) => station.id === categoryStationId)?.name ?? 'Atanmamış'}`
                  : 'Kategori için varsayılan istasyon yok; sipariş Atanmamış görünür.'}
              </div>
            )}
          </div>
        </FieldRow>
      </PanelSection>

      {/* Fiyatlandırma */}
      <PanelSection title="Fiyatlandırma">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FieldInline label="Satış fiyatı" htmlFor={`${item.id}-price`} error={validationAttempted ? fieldErrors.price : undefined}>
            <Input
              type="number"
              {...fieldProps('price')}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                ...inputStyle,
                fontFamily: "'Geist Mono', monospace",
                fontWeight: 700,
              }}
            />
          </FieldInline>
          <FieldInline label="Maliyet" htmlFor={`${item.id}-cost`} error={validationAttempted ? fieldErrors.cost : undefined}>
            <Input {...fieldProps('cost')} type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="—" style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace" }} />
          </FieldInline>
        </div>
        {marginPercent !== null && (
          <div
            style={{
              marginTop: 8,
              padding: '10px 12px',
              background: 'var(--accent-soft)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            >
              Kâr marjı
            </span>
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              %{marginPercent}
            </span>
          </div>
        )}
        <div
          style={{
            marginTop: 10,
            padding: 10,
            border: '1px solid var(--divider)',
            borderRadius: 8,
            background: 'var(--surface-2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                KDV oranı
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Fiyatlar müşteriye KDV dahil görünür.</div>
            </div>
            <span style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-3)' }}>Etkin %{vatMode === 'category' ? categoryVatRate : Number(vatRate) || 0}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              marginTop: 10,
            }}
          >
            <Button
              type="button"
              aria-pressed={vatMode === 'category'}
              onClick={() => setVatMode('category')}
              style={{
                height: 32,
                borderRadius: 7,
                border: `1px solid ${vatMode === 'category' ? 'var(--text)' : 'var(--border)'}`,
                background: vatMode === 'category' ? 'var(--text)' : 'var(--surface)',
                color: vatMode === 'category' ? 'var(--surface)' : 'var(--text-2)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Kategori oranı (%{categoryVatRate})
            </Button>
            <Button
              type="button"
              aria-pressed={vatMode === 'custom'}
              onClick={() => setVatMode('custom')}
              style={{
                height: 32,
                borderRadius: 7,
                border: `1px solid ${vatMode === 'custom' ? 'var(--text)' : 'var(--border)'}`,
                background: vatMode === 'custom' ? 'var(--text)' : 'var(--surface)',
                color: vatMode === 'custom' ? 'var(--surface)' : 'var(--text-2)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Özel oran
            </Button>
          </div>
          {vatMode === 'custom' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr) 76px',
                gap: 6,
                marginTop: 8,
              }}
            >
              {VAT_RATE_PRESETS.map((rate) => {
                const active = Number(vatRate) === rate
                return (
                  <Button
                    key={rate}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setVatRate(String(rate))}
                    style={{
                      height: 30,
                      borderRadius: 7,
                      border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                      background: active ? 'var(--text)' : 'var(--surface)',
                      color: active ? 'var(--surface)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    %{rate}
                  </Button>
                )
              })}
              <Input
                aria-label="Özel ürün KDV oranı"
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                style={{
                  ...inputStyle,
                  height: 30,
                  textAlign: 'right',
                  fontFamily: "'Geist Mono', monospace",
                }}
              />
            </div>
          )}
        </div>
      </PanelSection>

      {/* İçindekiler · Alerjenler · Özel içerik · Kontrol */}
      <NutritionFields s={nutri} set={setN} />

      {/* Varyantlar */}
      <PanelSection title="Varyantlar">
        <MenuModifierGroupEditor
          groups={modifiers}
          onChange={(next) => {
            setModifiers(next)
            setN({ reviewed: false })
          }}
        />
      </PanelSection>

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

      {/* Görünürlük */}
      <PanelSection title="Görünürlük">
        <FieldRow label="Yayında">
          <div className="flex items-center gap-2">
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} aria-label="Ürün yayında" />
            <Badge variant={isAvailable ? 'positive' : 'secondary'}>{isAvailable ? 'Açık' : 'Kapalı'}</Badge>
          </div>
        </FieldRow>
      </PanelSection>

      <PanelSection title="Sadakat">
        <FieldRow label="Damga kazandırır">
          <div className="flex items-center gap-2">
            <Switch checked={loyaltyStampEnabled && earnsStamp} onCheckedChange={setEarnsStamp} disabled={!loyaltyStampEnabled} aria-label="Sadakat damgası kazandırır" />
            <Badge variant={loyaltyStampEnabled && earnsStamp ? 'positive' : 'secondary'}>
              {loyaltyStampEnabled ? earnsStamp ? 'Evet' : 'Hayır' : <><LockKeyhole className="size-3" strokeWidth={1.8} />Pro</>}
            </Badge>
          </div>
        </FieldRow>
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-3)',
            margin: '6px 16px 0',
            lineHeight: 1.4,
          }}
        >
          {loyaltyStampEnabled
            ? 'Bu ürün satın alındığında her uygun adet için 1 sadakat damgası kazanılır.'
            : 'QR siparişi ve sadakat etkinleştirildiğinde bu ayarı kullanabilirsin.'}
        </p>
      </PanelSection>
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

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ ...S.label, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function FieldRow({ label, children, htmlFor, error }: { label: string; children: ReactNode; htmlFor?: string; error?: string }) {
  return (
    <Field data-invalid={Boolean(error)} orientation="horizontal" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
      <FieldLabel htmlFor={htmlFor} style={{ fontSize: 12, color: 'var(--text-2)', width: 80, flex: '0 0 80px', fontWeight: 400, paddingTop: 6 }}>{label}</FieldLabel>
      <div style={{ flex: 1, minWidth: 0 }}>{children}{error && <FieldError id={`${htmlFor}-error`}>{error}</FieldError>}</div>
    </Field>
  )
}

function FieldInline({ label, children, htmlFor, error }: { label: string; children: ReactNode; htmlFor?: string; error?: string }) {
  return (
    <Field data-invalid={Boolean(error)} style={{ marginBottom: 8, gap: 0 }}>
      <FieldLabel htmlFor={htmlFor} style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</FieldLabel>
      {children}
      {error && <FieldError id={`${htmlFor}-error`}>{error}</FieldError>}
    </Field>
  )
}
