'use client'

import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useState, useTransition } from 'react'
import { createCategory, updateCategory, uploadMenuImage } from '../../lib/actions/menu'
import { prepareMenuImage } from '../../lib/menu-image-client'
import type { Tables } from '@garsonless/db/types'
import { MenuImageAttachment } from './MenuImageAttachment'

interface Props {
  restaurantId: string
  parentId?: string
  existing?: Tables<'menu_categories'>
  kitchenStations?: Tables<'kitchen_stations'>[]
  onCreated?: (cat: Tables<'menu_categories'>) => void
  onUpdated?: (cat: Tables<'menu_categories'>) => void
  onCancel: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 7,
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const VAT_PRESETS = [1, 10, 20]

type KitchenStationOption = {
  value: string
  label: string
}

function KitchenStationCombobox({
  stations,
  value,
  onChange,
}: {
  stations: Tables<'kitchen_stations'>[]
  value: string
  onChange: (value: string) => void
}) {
  const options: KitchenStationOption[] = [
    { value: '', label: 'Atanmamış' },
    ...stations
      .filter((station) => station.is_active)
      .map((station) => ({ value: station.id, label: station.name })),
  ]
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(option) => {
        if (option) onChange(option.value)
      }}
      autoHighlight
    >
      <ComboboxInput
        aria-label="Varsayılan mutfak istasyonu"
        placeholder="İstasyon ara"
        className="h-8 w-full **:data-[slot=input-group-control]:text-[13px]"
      />
      <ComboboxContent className="min-w-(--anchor-width)">
        <ComboboxEmpty>İstasyon bulunamadı.</ComboboxEmpty>
        <ComboboxList>
          {(option) => (
            <ComboboxItem key={option.value || 'unassigned'} value={option} className="py-1.5 text-xs">
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export default function CategoryForm({ restaurantId, parentId, existing, kitchenStations = [], onCreated, onUpdated, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? null)
  const [vatRate, setVatRate] = useState(String(existing?.vat_rate ?? 10))
  const [kitchenStationId, setKitchenStationId] = useState(existing?.kitchen_station_id ?? '')
  const [imageUrl, setImageUrl] = useState(existing?.image_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const selectedVatPreset = VAT_PRESETS.includes(Number(vatRate)) ? [vatRate] : []

  async function handleImageUpload(file: File) {
    setUploading(true)
    setError('')
    try {
      const prepared = await prepareMenuImage(file)
      const fd = new FormData()
      fd.append('restaurantId', restaurantId)
      fd.append('entityId', existing?.id ?? crypto.randomUUID())
      fd.append('kind', 'categories')
      fd.append('file', prepared)
      const result = await uploadMenuImage(fd)
      if ('error' in result) setError(result.error)
      else setImageUrl(result.url)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Görsel yüklenemedi.')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const submittedVatRate = vatRate.trim() === '' ? String(existing?.vat_rate ?? 10) : vatRate
      const submittedVatNumber = Number(submittedVatRate)
      if (existing) {
        const fd = new FormData()
        fd.append('id', existing.id)
        fd.append('restaurantId', restaurantId)
        fd.append('name', name)
        fd.append('vat_rate', submittedVatRate)
        fd.append('kitchen_station_id', kitchenStationId)
        fd.append('image_url', imageUrl)
        if (description) fd.append('description', description)
        const result = await updateCategory(fd)
        if ('error' in result) {
          setError(result.error)
          return
        }
        onUpdated?.({
          ...existing,
          name,
          description: description ?? null,
          image_url: imageUrl || null,
          vat_rate: Number.isFinite(submittedVatNumber) ? submittedVatNumber : 0,
          kitchen_station_id: kitchenStationId || null,
        })
      } else {
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('name', name)
        fd.append('vat_rate', submittedVatRate)
        fd.append('kitchen_station_id', kitchenStationId)
        fd.append('image_url', imageUrl)
        if (description) fd.append('description', description)
        if (parentId) fd.append('parentId', parentId)
        const result = await createCategory(null, fd)
        if ('error' in result) {
          setError(result.error)
          return
        }
        onCreated?.({
          id: result.id,
          restaurant_id: restaurantId,
          name,
          description: description ?? null,
          image_url: imageUrl || null,
          position: 0,
          is_visible: true,
          parent_id: parentId ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          vat_rate: Number.isFinite(submittedVatNumber) ? submittedVatNumber : 10,
          kitchen_station_id: kitchenStationId || null,
        } as Tables<'menu_categories'>)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 10px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <Input type="text" placeholder="Kategori adı" value={name} onChange={(e) => setName(e.target.value)} required autoFocus style={inputStyle} />
      <MenuImageAttachment
        imageUrl={imageUrl || null}
        title="Kategori görseli"
        description={imageUrl ? 'Yüklendi · değiştirmek için tıkla' : 'JPG, PNG, WebP veya AVIF'}
        imageAlt={`${name || 'Kategori'} görseli`}
        uploading={uploading}
        onFileSelected={handleImageUpload}
        onRemove={() => setImageUrl('')}
      />
      <Input type="text" placeholder="Açıklama (opsiyonel)" value={description ?? ''} onChange={(e) => setDescription(e.target.value || null)} style={inputStyle} />
      <div style={{ display: 'grid', gap: 5 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)' }}>Varsayılan KDV oranı</label>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_64px] gap-1.5">
          <ToggleGroup
            aria-label="KDV oranı hazır değerleri"
            value={selectedVatPreset}
            onValueChange={(values) => {
              if (values[0]) setVatRate(values[0])
            }}
            variant="outline"
            size="sm"
            spacing={1}
            className="grid min-w-0 grid-cols-3"
          >
            {VAT_PRESETS.map((rate) => (
              <ToggleGroupItem
                key={rate}
                value={String(rate)}
                aria-label={`KDV yüzde ${rate}`}
                className="min-w-0 px-1 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                %{rate}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Input
            aria-label="Özel KDV oranı"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            className="h-7 min-w-0 px-1.5 text-right font-mono text-xs"
          />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)' }}>Varsayılan mutfak istasyonu</label>
        <KitchenStationCombobox stations={kitchenStations} value={kitchenStationId} onChange={setKitchenStationId} />
        {kitchenStations.length === 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.45,
              color: 'var(--text-3)',
            }}
          >
            Henüz istasyon oluşturulmamış.{' '}
            <a
              href={`/dashboard/${restaurantId}/settings#kitchen-stations`}
              style={{
                color: 'var(--text)',
                fontWeight: 700,
                textUnderlineOffset: 2,
              }}
            >
              Mutfak istasyonu oluştur
            </a>
          </p>
        )}
      </div>
      {error && <p style={{ fontSize: 11.5, color: 'var(--critical)', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <Button
          className="category-form-action category-form-submit"
          type="submit"
          disabled={isPending}
          style={{
            flex: 1,
            height: 30,
            borderRadius: 6,
            background: 'var(--action)',
            color: 'var(--on-action)',
            border: 'none',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isPending ? 0.55 : 1,
          }}
        >
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              Kaydediliyor…
            </>
          ) : existing ? (
            'Kaydet'
          ) : (
            'Ekle'
          )}
        </Button>
        <Button
          className="category-form-action category-form-cancel"
          type="button"
          onClick={onCancel}
          style={{
            height: 30,
            padding: '0 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-2)',
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          İptal
        </Button>
      </div>
    </form>
  )
}
