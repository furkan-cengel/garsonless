'use client'

import { useEffect, useState } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import type { TableItem } from './tables-builder-types'
import { TABLE_ATTENTION_ORDER, TABLE_LATE_AFTER_MINUTES, UNASSIGNED_LOCATION_FILTER } from './tables-operation-model'
import { TableStatusBadge } from './TableStatusBadge'
import type { useTableFloorLayout } from './use-table-floor-layout'

type LocationOptions = { values: string[]; hasUnassigned: boolean }

/** Plan header: floor tabs, area filter, delay threshold, layout actions and legend, plus the setup and edit hints under it. */
export function TablesFloorToolbar({
  restaurantId,
  tables,
  shownCount,
  floorFilter,
  onSelectFloor,
  areaFilter,
  onSelectArea,
  floorOptions,
  areaOptions,
  layout,
  editDisabledReason,
  canEditUnassigned,
  onOpenSettings,
}: {
  restaurantId: string
  tables: TableItem[]
  shownCount: number
  floorFilter: string
  onSelectFloor: (floor: string) => void
  areaFilter: string
  onSelectArea: (area: string) => void
  floorOptions: LocationOptions
  areaOptions: LocationOptions
  layout: Pick<ReturnType<typeof useTableFloorLayout>, 'editing' | 'saving' | 'collisions' | 'cancelEditing' | 'save' | 'startEditing'>
  editDisabledReason: string | null
  canEditUnassigned: boolean
  onOpenSettings: () => void
}) {
  const floorLabel = floorFilter === UNASSIGNED_LOCATION_FILTER ? 'Atanmamış kat' : floorFilter || 'Tüm katlar'
  const floorTabs = floorOptions.values.length === 0 ? [] : [
    { value: '', label: 'Tümü', count: tables.length },
    ...floorOptions.values.map((floor) => ({ value: floor, label: floor, count: tables.filter((table) => table.floorLabel === floor).length })),
    ...(floorOptions.hasUnassigned ? [{ value: UNASSIGNED_LOCATION_FILTER, label: 'Atanmamış', count: tables.filter((table) => !table.floorLabel).length }] : []),
  ]
  const [thresholdOpen, setThresholdOpen] = useState(false)
  const setupBanner = useFloorSetupBanner(restaurantId, tables.length > 0 && floorOptions.values.length === 0)

  return (
    <>
        <header className="tb-floor__toolbar">
          <div className="tb-floor__heading">
            <span className="tb-floor__eyebrow"><AppIcons.layout size={14} />Salon planı</span>
            <strong>{floorLabel}</strong>
            <span>{shownCount} masa gösteriliyor</span>
          </div>
          {floorTabs.length > 0 && (
            <div className="tb-floor__tabs" role="group" aria-label="Kata göre göster">
              {floorTabs.map((tab) => (
                <button key={tab.value || 'all'} type="button" className="tb-floor__tab" aria-pressed={floorFilter === tab.value} disabled={layout.editing} onClick={() => onSelectFloor(tab.value)}>
                  {tab.label}<span>{tab.count}</span>
                </button>
              ))}
            </div>
          )}
          {areaOptions.values.length > 0 && (
            <NativeSelect aria-label="Alana göre göster" size="sm" className="tb-floor__area" value={areaFilter} disabled={layout.editing} onChange={(event) => onSelectArea(event.target.value)}>
              <NativeSelectOption value="">Tüm alanlar</NativeSelectOption>
              {areaOptions.values.map((area) => <NativeSelectOption key={area} value={area}>{area}</NativeSelectOption>)}
              {areaOptions.hasUnassigned && <NativeSelectOption value={UNASSIGNED_LOCATION_FILTER}>Alanı atanmamış</NativeSelectOption>}
            </NativeSelect>
          )}
          <div
            className="tb-floor__threshold"
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setThresholdOpen(false) }}
            onKeyDown={(event) => { if (event.key === 'Escape') setThresholdOpen(false) }}
          >
            Gecikme eşiği <strong>{TABLE_LATE_AFTER_MINUTES} dk</strong>
            <button type="button" aria-label="Gecikme eşiği nedir?" aria-expanded={thresholdOpen} aria-controls="tb-floor-threshold-note" onClick={() => setThresholdOpen((open) => !open)}><AppIcons.question size={15} /></button>
            {thresholdOpen && <span id="tb-floor-threshold-note" role="note" className="tb-floor__threshold-note">Adisyon {TABLE_LATE_AFTER_MINUTES} dakikadan uzun açık kalırsa masa <strong>Gecikiyor</strong> durumuna geçer ve listede en üste çıkar.</span>}
          </div>
          <div className="tb-floor__actions">
            {layout.editing ? (
              <>
                <Button type="button" variant="outline" className="tb-floor__button" disabled={layout.saving} onClick={layout.cancelEditing}>İptal</Button>
                <Button type="button" className="tb-floor__button tb-floor__button--primary" aria-busy={layout.saving} disabled={layout.saving || layout.collisions.size > 0} onClick={() => { void layout.save() }}>
                  {layout.saving ? <Spinner aria-hidden="true" data-icon="inline-start" /> : <AppIcons.check data-icon="inline-start" />}{layout.saving ? 'Kaydediliyor…' : 'Düzeni kaydet'}
                </Button>
              </>
            ) : canEditUnassigned ? (
              <Button type="button" variant="outline" className="tb-floor__button tb-floor__edit-button" onClick={() => { onSelectFloor(UNASSIGNED_LOCATION_FILTER); layout.startEditing() }}>
                <AppIcons.grid data-icon="inline-start" />Düzeni düzenle
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" className="tb-floor__button tb-floor__edit-button" aria-disabled={Boolean(editDisabledReason)} aria-describedby={editDisabledReason ? 'table-layout-edit-disabled-reason' : undefined} onClick={() => { if (!editDisabledReason) layout.startEditing() }} title={editDisabledReason ?? 'Masa yerleşimini düzenle'}>
                  <AppIcons.grid data-icon="inline-start" />Düzeni düzenle
                </Button>
                {editDisabledReason && <span id="table-layout-edit-disabled-reason" className="tb-floor__edit-disabled-copy">{editDisabledReason}</span>}
              </>
            )}
          </div>
          <div className="tb-floor__legend" aria-label="Masa durumları">
            {/* The cards' badges with their full names, most urgent first. */}
            {TABLE_ATTENTION_ORDER.map((state) => <TableStatusBadge key={state} state={state} full />)}
          </div>
        </header>

        {setupBanner.visible && !layout.editing && (
          <div className="tb-floor__setup">
            <span className="tb-floor__setup-icon" aria-hidden="true"><AppIcons.layout size={20} /></span>
            <div>
              <strong>Salon planını katlara ayırmak için masalara kat adı ver</strong>
              <span>Masaların henüz bir kata ya da alana bağlı değil. Masa ayarlarından kat ve alan verince plan sekmelere ayrılır; yerleşimi şimdiden düzenleyebilirsin.</span>
            </div>
            <Button type="button" variant="outline" className="tb-floor__button" onClick={onOpenSettings}>Masa ayarlarını aç</Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Bu bilgiyi gizle" onClick={setupBanner.dismiss}><AppIcons.close /></Button>
          </div>
        )}

        {layout.editing && (
          <div className="tb-floor__edit-band" role="status">
            <AppIcons.drag size={16} aria-hidden="true" />Masaları sürükleyerek yerleştir. Seçili masayı ok tuşlarıyla ince ayarla; Shift + ok büyük adım atar.
          </div>
        )}
    </>
  )
}

/** The floor-setup hint can be hidden per browser; it comes back only if storage is unavailable. */
function useFloorSetupBanner(restaurantId: string, relevant: boolean) {
  const key = `masabu:tables-floor-setup-dismissed:${restaurantId}`
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    try { setDismissed(window.localStorage.getItem(key) === '1') } catch { setDismissed(false) }
  }, [key])
  const dismiss = () => {
    setDismissed(true)
    try { window.localStorage.setItem(key, '1') } catch { /* hidden for this visit only */ }
  }
  return { visible: relevant && !dismissed, dismiss }
}
