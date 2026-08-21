'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import type { MenuModifierGroup as ModifierGroup } from '@garsonless/db/browser'
import { calculateMarginPercent } from '@garsonless/domain/menu'
import { deleteItem, updateItem, uploadMenuImage } from '../../lib/actions/menu'
import { prepareMenuImage } from '../../lib/menu-image-client'
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
  categoryName,
  categoryVatRate,
  categoryStationId,
  kitchenStations,
  allItems,
  recommendationIds,
  restaurantId,
  onClose,
  onSaved,
  onDeleted,
  onError,
  onDirtyChange,
  onRecommendationsSaved,
}: {
  item: Tables<'menu_items'>
  categoryName: string
  categoryVatRate: number
  categoryStationId: string | null
  kitchenStations: Tables<'kitchen_stations'>[]
  allItems: Tables<'menu_items'>[]
  recommendationIds: string[]
  restaurantId: string
  onClose: () => void
  onSaved: (updated: Tables<'menu_items'>) => void
  onDeleted: (id: string) => void
  onError: (msg: string) => void
  onDirtyChange: (dirty: boolean) => void
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
  const [images, setImages] = useState<string[]>(() => initialImages)
  const [initialModifiers] = useState<ModifierGroup[]>(() => normalizeGroups(item.modifier_groups))
  const [modifiers, setModifiers] = useState<ModifierGroup[]>(() => initialModifiers)
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [recommendationsDirty, setRecommendationsDirty] = useState(false)
  const tint = tintFor(item.id)
  const marginPercent = calculateMarginPercent(Number(price), cost.trim() === '' ? null : Number(cost))
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
  const savedSnapshotRef = useRef<MenuItemEditorSnapshot>({
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
    saving: isPending || uploading,
  })

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => onDirtyChange(false)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  async function handleUpload(file: File) {
    const prevImages = images
    setUploading(true)
    try {
      const prepared = await prepareMenuImage(file)
      const uploadData = new FormData()
      uploadData.append('restaurantId', restaurantId)
      uploadData.append('entityId', item.id)
      uploadData.append('kind', 'items')
      uploadData.append('file', prepared)
      const uploadResult = await uploadMenuImage(uploadData)
      if ('error' in uploadResult) throw new Error(uploadResult.error)

      const newImages = [uploadResult.url, ...prevImages.slice(1)]
      setImages(newImages)
      const fd = new FormData()
      fd.append('id', item.id)
      fd.append('restaurantId', restaurantId)
      fd.append('images', JSON.stringify(newImages))
      const result = await updateItem(fd)
      if ('error' in result) throw new Error(result.error)
      savedSnapshotRef.current = {
        ...savedSnapshotRef.current,
        images: newImages,
      }
      markItemSaved()
      onSaved(result.item)
    } catch (uploadError) {
      setImages(prevImages)
      onError(uploadError instanceof Error ? uploadError.message : 'Görsel yüklenemedi.')
    } finally {
      setUploading(false)
    }
  }

  function handleSave() {
    if (!itemIsDirty || isPending || uploading) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('id', item.id)
      fd.append('restaurantId', restaurantId)
      fd.append('name', name)
      fd.append('description', description)
      fd.append('price', price)
      fd.append('vat_rate', vatMode === 'category' ? '' : vatRate)
      fd.append('kitchen_station_id', stationMode === 'category' ? '' : kitchenStationId)
      fd.append('is_available', String(isAvailable))
      fd.append('earns_stamp', String(earnsStamp))
      appendNutritionToFormData(fd, nutri)
      fd.append('cost', cost)
      fd.append('images', JSON.stringify(images))
      fd.append('modifier_groups', JSON.stringify(modifiers))
      const result = await updateItem(fd)
      if ('error' in result) {
        onError(result.error)
        return
      }
      savedSnapshotRef.current = currentSnapshot
      markItemSaved()
      onSaved(result.item)
    })
  }

  function handleDelete() {
    setDeleteConfirmOpen(true)
  }

  function confirmDelete() {
    setDeleting(true)
    startTransition(async () => {
      const result = await deleteItem(item.id, restaurantId)
      if ('error' in result) {
        setDeleting(false)
        onError(result.error)
        return
      }
      setDeleteConfirmOpen(false)
      onDeleted(item.id)
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

  async function handleRemoveImage() {
    const previousImages = images
    setImages([])
    setUploading(true)
    const fd = new FormData()
    fd.append('id', item.id)
    fd.append('restaurantId', restaurantId)
    fd.append('images', JSON.stringify([]))
    const result = await updateItem(fd)
    if ('error' in result) {
      setImages(previousImages)
      setUploading(false)
      onError(result.error)
      return
    }
    savedSnapshotRef.current = {
      ...savedSnapshotRef.current,
      images: [],
    }
    setUploading(false)
    markItemSaved()
    onSaved(result.item)
  }

  return (
    <MenuItemEditorFrame
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
                    <Spinner className="size-3" />
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
              disabled={deleting || isPending}
              style={{ flex: 1 }}
            >
              <I.trash size={13} />
              Sil
            </Button>
            <Button
              className="menu-item-footer-action menu-item-save-action menu-save-action"
              type="button"
              onClick={handleSave}
              disabled={deleting || itemSaveState !== 'dirty'}
              data-save-state={itemSaveState}
              variant={itemSaveState === 'saved' ? 'positive' : itemSaveState === 'clean' ? 'secondary' : 'default'}
              style={{ flex: 2 }}
            >
              {itemSaveState === 'saving' ? (
                <>
                  <Spinner data-icon="inline-start" />
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
      {/* Image */}
      <div style={{ padding: 16 }}>
        <MenuImageAttachment
          className="menu-product-image-attachment"
          mediaClassName="text-[rgba(17,17,19,.34)]"
          mediaStyle={{ background: tint }}
          imageUrl={mainImage}
          title={`${item.name} görseli`}
          description={mainImage ? 'Yüklendi · değiştirmek için tıkla' : 'JPG, PNG, WebP veya AVIF'}
          imageAlt={item.name}
          uploading={uploading}
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
        <FieldRow label="Ad">
          <Input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </FieldRow>
        <FieldRow label="Açıklama">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
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
          <FieldInline label="Satış fiyatı">
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                ...inputStyle,
                fontFamily: "'Geist Mono', monospace",
                fontWeight: 700,
              }}
            />
          </FieldInline>
          <FieldInline label="Maliyet">
            <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="—" style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace" }} />
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
        <MenuItemRecommendationEditor
          restaurantId={restaurantId}
          sourceItem={item}
          allItems={allItems}
          initialIds={recommendationIds}
          onSaved={onRecommendationsSaved}
          onError={onError}
          onDirtyChange={setRecommendationsDirty}
        />
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
            <Switch checked={earnsStamp} onCheckedChange={setEarnsStamp} aria-label="Sadakat damgası kazandırır" />
            <Badge variant={earnsStamp ? 'positive' : 'secondary'}>{earnsStamp ? 'Evet' : 'Hayır'}</Badge>
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
          Bu ürün satın alındığında her uygun adet için 1 sadakat damgası kazanılır.
        </p>
      </PanelSection>
    </MenuItemEditorFrame>
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

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '6px 0',
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-2)',
          width: 80,
          flexShrink: 0,
          paddingTop: 6,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

function FieldInline({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-3)',
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}
