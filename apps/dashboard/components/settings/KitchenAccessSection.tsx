'use client'

import { useState, useTransition } from 'react'
import type { Tables } from '@garsonless/db/types'
import {
  createKitchenStation,
  generateKitchenToken,
  reorderKitchenStations,
  updateKitchenStation,
} from '../../lib/actions/restaurant'
import { notifySettingsDirty, notifySettingsSaved } from './settings-dirty-state'

interface Props {
  restaurantId: string
  featureAllowed: boolean
  initialHasAccess?: boolean
  initialStations?: Tables<'kitchen_stations'>[]
}

const STATION_COLORS = ['#2e7d52', '#c8922a', '#2563eb', '#d9480f', '#8b5cf6', '#0f766e']

export default function KitchenAccessSection({ restaurantId, featureAllowed, initialHasAccess = false, initialStations = [] }: Props) {
  const canUseKitchenDisplay = featureAllowed
  const [hasAccess, setHasAccess] = useState(initialHasAccess)
  const [error, setError] = useState('')
  const [stations, setStations] = useState(() => [...initialStations].sort((a, b) => a.position - b.position))
  const [stationName, setStationName] = useState('')
  const [stationColor, setStationColor] = useState(STATION_COLORS[0]!)
  const [renewalConfirmationOpen, setRenewalConfirmationOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [stationPending, startStationTransition] = useTransition()

  async function handleGenerate() {
    setError('')
    startTransition(async () => {
      const result = await generateKitchenToken(restaurantId)
      if ('error' in result) { setError(result.error); return }
      setHasAccess(true)
      setRenewalConfirmationOpen(false)
      notifySettingsSaved()
    })
  }

  function handleCreateStation(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startStationTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('name', stationName)
        fd.append('color', stationColor)
        const result = await createKitchenStation(fd)
        if ('error' in result) { setError(result.error); return }
        setStations((prev) => [...prev, result.station].sort((a, b) => a.position - b.position))
        setStationName('')
        notifySettingsSaved()
      } catch {
        setError('İstasyon eklenemedi')
      }
    })
  }

  function patchStation(id: string, patch: Partial<Pick<Tables<'kitchen_stations'>, 'name' | 'color' | 'is_active'>>) {
    const current = stations.find((station) => station.id === id)
    if (!current) return
    const optimistic = { ...current, ...patch }
    notifySettingsDirty()
    setStations((prev) => prev.map((station) => station.id === id ? optimistic : station))
    setError('')
    startStationTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('id', id)
        fd.append('restaurantId', restaurantId)
        fd.append('name', optimistic.name)
        fd.append('color', optimistic.color)
        fd.append('is_active', String(optimistic.is_active))
        const result = await updateKitchenStation(fd)
        if ('error' in result) {
          setStations((prev) => prev.map((station) => station.id === id ? current : station))
          setError(result.error)
          return
        }
        setStations((prev) => prev.map((station) => station.id === id ? result.station : station).sort((a, b) => a.position - b.position))
        notifySettingsSaved()
      } catch {
        setStations((prev) => prev.map((station) => station.id === id ? current : station))
        setError('İstasyon güncellenemedi')
      }
    })
  }

  function moveStation(id: string, direction: -1 | 1) {
    if (stationPending) return
    const index = stations.findIndex((station) => station.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= stations.length) return
    const snapshot = stations
    const next = [...snapshot]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(target, 0, moved)
    const reordered = next.map((station, position) => ({ ...station, position }))
    notifySettingsDirty()
    setStations(reordered)
    setError('')
    startStationTransition(async () => {
      try {
        const result = await reorderKitchenStations(restaurantId, reordered.map((station) => station.id))
        if ('error' in result) {
          setError(result.error)
          setStations(snapshot)
          return
        }
        notifySettingsSaved()
      } catch {
        setError('İstasyon sırası kaydedilemedi')
        setStations(snapshot)
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section id="kitchen-stations" aria-busy={isPending} style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', scrollMarginTop: 80 }}>
      {isPending && <span role="status" aria-live="polite" className="sr-only">Mutfak erişimi güncelleniyor…</span>}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Mutfak Erişimi</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.45 }}>
          Kalıcı erişim kodu artık tarayıcıya gösterilmez. Mutfak ekranı kısa ömürlü bir açılış biletiyle güvenli oturum kurar.
        </div>
      </div>

      {canUseKitchenDisplay && hasAccess && (
        <div style={{ padding: 12, borderRadius: 9, background: 'var(--positive-bg)', color: 'var(--positive)', fontSize: 12.5, marginBottom: 14 }}>
          Mutfak erişimi hazır. Erişimi yenilemek açık KDS oturumlarını anında kapatır.
        </div>
      )}

      {error && (
        <p role="alert" style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 12 }}>{error}</p>
      )}

      {!canUseKitchenDisplay && (
        <div style={{ padding: 12, borderRadius: 9, background: 'var(--warning-bg, #fff8e8)', border: '1px solid var(--warning-border, #e6c989)', color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
          Mutfak ekranı Pro paketiyle kullanılabilir. Mevcut erişim kodları ve açık KDS oturumları paket yükseltilene kadar çalışmaz.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {canUseKitchenDisplay && hasAccess && (
          <a
            href={`/api/kitchen/launch/${restaurantId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 36, padding: '0 16px', borderRadius: 7, display: 'inline-flex',
              alignItems: 'center', textDecoration: 'none', background: 'var(--action)',
              color: 'var(--on-action)', fontSize: 13, fontWeight: 700,
            }}
          >
            Mutfak ekranını aç
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            setError('')
            if (hasAccess) setRenewalConfirmationOpen(true)
            else void handleGenerate()
          }}
          disabled={isPending || !canUseKitchenDisplay}
          style={{
            height: 36, padding: '0 16px', borderRadius: 7,
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            color: 'var(--text)', fontSize: 13, fontWeight: 500,
            cursor: isPending || !canUseKitchenDisplay ? 'not-allowed' : 'pointer', opacity: isPending || !canUseKitchenDisplay ? 0.55 : 1,
          }}
        >
          {isPending ? 'Kaydediliyor…' : canUseKitchenDisplay ? (hasAccess ? 'Erişimi yenile' : 'Mutfak erişimi oluştur') : 'Pro pakette kullanılabilir'}
        </button>
      </div>
      {renewalConfirmationOpen && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="kitchen-access-renewal-title"
          aria-describedby="kitchen-access-renewal-description"
          style={{ marginTop: 14, padding: 14, border: '1px solid var(--warning-border, #e6c989)', borderRadius: 10, background: 'var(--warning-bg, #fff8e8)' }}
        >
          <div id="kitchen-access-renewal-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Mutfak erişimi yenilensin mi?</div>
          <p id="kitchen-access-renewal-description" style={{ margin: '5px 0 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-2)' }}>
            Bu işlem açık Mutfak Ekranı oturumlarını anında kapatır. Ekranı kullanan ekip üyeleri yeniden açılış yapmalıdır.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setRenewalConfirmationOpen(false)}
              disabled={isPending}
              style={confirmationButtonStyle(false, isPending)}
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isPending}
              style={confirmationButtonStyle(true, isPending)}
            >
              {isPending ? 'Yenileniyor…' : 'Erişimi yenile'}
            </button>
          </div>
        </div>
      )}
      </section>

      <section style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Mutfak istasyonları</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.45 }}>
            Kategoriler varsayılan istasyona bağlanır; ürünler isterse özel istasyon kullanır. Sipariş anında istasyon snapshot&apos;ı alınır.
          </div>
        </div>

        <form onSubmit={handleCreateStation} aria-busy={stationPending} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 14 }}>
          {stationPending && <span role="status" aria-live="polite" className="sr-only">Mutfak istasyonu kaydediliyor…</span>}
          <input
            aria-label="Yeni istasyon adı"
            value={stationName}
            onChange={(event) => setStationName(event.target.value)}
            placeholder="Yeni istasyon adı"
            style={{
              height: 36, padding: '0 10px', border: '1px solid var(--border)',
              borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)',
              fontSize: 13, outline: 'none',
            }}
          />
          <select
            aria-label="Yeni istasyon rengi"
            value={stationColor}
            onChange={(event) => setStationColor(event.target.value)}
            style={{
              height: 36, border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12,
            }}
          >
            {STATION_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
          <button
            type="submit"
            disabled={stationPending || stationName.trim().length === 0}
            style={{
              height: 36, padding: '0 13px', borderRadius: 8, border: 'none',
              background: 'var(--action)', color: 'var(--on-action)', fontSize: 12.5,
              fontWeight: 700, cursor: stationPending || !stationName.trim() ? 'not-allowed' : 'pointer',
              opacity: stationPending || !stationName.trim() ? 0.55 : 1,
            }}
          >
            Ekle
          </button>
        </form>

        <div style={{ display: 'grid', gap: 8 }}>
          {stations.length === 0 ? (
            <div style={{ padding: 18, border: '1px dashed var(--border-strong)', borderRadius: 10, color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center' }}>
              Henüz istasyon yok. Ürünler mutfakta “Atanmamış” olarak görünür.
            </div>
          ) : stations.map((station, index) => (
            <div key={station.id} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto auto auto', gap: 8,
              alignItems: 'center', padding: 8, border: '1px solid var(--divider)',
              borderRadius: 10, background: station.is_active ? 'var(--surface-2)' : 'var(--surface)',
              opacity: station.is_active ? 1 : 0.6,
            }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, background: station.color, border: '1px solid var(--border)' }} />
              <input
                aria-label={`${station.name} istasyon adı`}
                value={station.name}
                onChange={(event) => {
                  const name = event.target.value
                  setStations((prev) => prev.map((row) => row.id === station.id ? { ...row, name } : row))
                }}
                onBlur={(event) => {
                  const name = event.target.value.trim()
                  if (name) patchStation(station.id, { name })
                }}
                style={{
                  height: 32, padding: '0 9px', borderRadius: 7, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, outline: 'none',
                }}
              />
              <input
                aria-label={`${station.name} rengi`}
                type="color"
                value={station.color}
                onChange={(event) => patchStation(station.id, { color: event.target.value })}
                style={{ width: 36, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)' }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" aria-label={`${station.name} istasyonunu yukarı taşı`} onClick={() => moveStation(station.id, -1)} disabled={stationPending || index === 0} style={miniButton(stationPending || index === 0)}>↑</button>
                <button type="button" aria-label={`${station.name} istasyonunu aşağı taşı`} onClick={() => moveStation(station.id, 1)} disabled={stationPending || index === stations.length - 1} style={miniButton(stationPending || index === stations.length - 1)}>↓</button>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={station.is_active}
                aria-label={`${station.name} istasyonu ${station.is_active ? 'aktif' : 'pasif'}`}
                onClick={() => patchStation(station.id, { is_active: !station.is_active })}
                style={{
                  height: 30, padding: '0 10px', borderRadius: 999, border: 'none',
                  background: station.is_active ? 'var(--positive-bg)' : 'var(--surface-3)',
                  color: station.is_active ? 'var(--positive)' : 'var(--text-3)',
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {station.is_active ? 'Aktif' : 'Pasif'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function miniButton(disabled: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
}

function confirmationButtonStyle(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 12px',
    borderRadius: 7,
    border: primary ? 'none' : '1px solid var(--border-strong)',
    background: primary ? 'var(--action)' : 'var(--surface)',
    color: primary ? 'var(--on-action)' : 'var(--text)',
    fontSize: 12.5,
    fontWeight: primary ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  }
}
