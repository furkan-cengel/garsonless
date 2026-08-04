'use client'

import React, { useEffect, useRef, useState, useTransition } from 'react'
import { InlineSpinner } from '@garsonless/ui/spinners'
import type { Tables } from '@garsonless/db/types'
import { normalizeMenuNumericText, parseMenuNumericInput } from '@garsonless/domain/menu'
import { createItem } from '../../lib/actions/menu'
import NutritionFields, { nutritionFromItem, appendNutritionToFormData, applyNutritionPatch, NutritionStatusPill, type NutritionState } from './NutritionFields'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { isNewMenuItemDraftDirty, type NewMenuItemDraftSnapshot } from './menu-item-editor-model'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const icX = <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
const icChevR = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>

/**
 * 3-step new-product drawer (reference design, real data):
 *   1 Temel — ad / açıklama / satış / maliyet
 *   2 İçerik & alerjen — shared NutritionFields
 *   3 Görünürlük & oluştur — yayında / sadakat damgası
 * Görsel + varyantlar are added afterwards from the product panel (no fake
 * upload-before-create). On finish → createItem → onCreated opens the panel.
 */
export default function NewProductDrawer({
  restaurantId, categoryId, categoryName, categoryStationId, kitchenStations, onClose, onCreated,
}: {
  restaurantId: string
  categoryId: string
  categoryName: string
  categoryStationId: string | null
  kitchenStations: Tables<'kitchen_stations'>[]
  onClose: () => void
  onCreated: (item: Tables<'menu_items'>) => void
}) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [earnsStamp, setEarnsStamp] = useState(false)
  const [stationMode, setStationMode] = useState<'category' | 'custom'>('category')
  const [kitchenStationId, setKitchenStationId] = useState(categoryStationId ?? '')
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
    kitchenStationId: categoryStationId ?? '',
    nutrition: initialNutrition,
  })
  const isDirty = isNewMenuItemDraftDirty({
    name,
    description,
    price,
    cost,
    isAvailable,
    earnsStamp,
    stationMode,
    kitchenStationId,
    nutrition: nutri,
  }, initialDraftRef.current)
  const dirtyRef = useRef(isDirty)

  onCloseRef.current = onClose
  pendingRef.current = pending
  discardConfirmOpenRef.current = discardConfirmOpen
  dirtyRef.current = isDirty

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLElement>('[aria-label="Ürün adı"], button')?.focus()
    })
    function handleKeyDown(event: KeyboardEvent) {
      if (discardConfirmOpenRef.current) return
      if (event.key === 'Escape') {
        if (pendingRef.current) return
        event.preventDefault()
        if (dirtyRef.current) setDiscardConfirmOpen(true)
        else onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        event.preventDefault()
        drawerRef.current?.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  const parsedPrice = parseMenuNumericInput(price, { required: true, min: 0.01 })
  const parsedCost = parseMenuNumericInput(cost, { min: 0 })
  const step1Valid = name.trim().length > 0 && parsedPrice.ok && parsedCost.ok

  function create() {
    setErr(null)
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('restaurantId', restaurantId)
        fd.append('categoryId', categoryId)
        fd.append('name', name.trim())
        fd.append('description', description.trim())
        fd.append('price', price)
        fd.append('cost', cost)
        fd.append('kitchen_station_id', stationMode === 'category' ? '' : kitchenStationId)
        fd.append('is_available', String(isAvailable))
        fd.append('earns_stamp', String(earnsStamp))
        fd.append('modifier_groups', JSON.stringify([]))
        appendNutritionToFormData(fd, nutri)
        const res = await createItem(null, fd)
        if ('error' in res) { setErr(res.error); return }
        onCreated(res.item)
      } catch (error) {
        console.error('[menu-item-create-error]', error)
        setErr('Ürün oluşturulamadı. Bağlantıyı kontrol edip tekrar deneyin.')
      }
    })
  }

  const next = () => { if (step < 3) setStep(step + 1); else create() }
  const requestClose = () => {
    if (pending) return
    if (isDirty) setDiscardConfirmOpen(true)
    else onClose()
  }

  return (
    <div className="new-product-overlay" onClick={pending ? undefined : (event) => { if (event.target === event.currentTarget) requestClose() }} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(17,17,19,.4)', backdropFilter: 'blur(3px)' }}>
      <div className="new-product-drawer" ref={drawerRef} role="dialog" aria-modal={discardConfirmOpen ? undefined : 'true'} aria-hidden={discardConfirmOpen ? true : undefined} inert={discardConfirmOpen ? true : undefined} aria-labelledby="new-product-title" tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(480px, 100vw)', background: 'var(--surface)', boxShadow: '-20px 0 60px -10px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', outline: 'none' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div id="new-product-title" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)' }}>Yeni ürün ekle</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Adım {step}/3 · {categoryName} kategorisine</div>
            </div>
            <button className="new-product-close" type="button" disabled={pending} onClick={requestClose} aria-label="Yeni ürün penceresini kapat" style={{ width: 44, height: 44, borderRadius: 9, background: 'var(--surface-2)', color: 'var(--text-3)', display: 'grid', placeItems: 'center', border: '1px solid var(--border)', cursor: pending ? 'not-allowed' : 'pointer' }}>{icX}</button>
          </div>
          <div className="new-product-steps" aria-label={`3 adımın ${step}. adımı`}>
            {['Temel bilgiler', 'Gıda bilgileri', 'Yayın ayarları'].map((label, index) => {
              const n = index + 1
              return <div key={label} className="new-product-step" data-state={n === step ? 'current' : n < step ? 'complete' : 'upcoming'}><span>{n}</span>{label}</div>
            })}
          </div>
        </div>

        <div className="new-product-content" style={{ flex: 1, overflow: 'auto' }}>
          {err && <div role="alert" style={{ margin: 16, fontSize: 12, color: 'var(--critical)', background: 'var(--critical-bg)', padding: '9px 11px', borderRadius: 9 }}>{err}</div>}

          {step === 1 && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Ürün adı" required>
                <input aria-label="Ürün adı" autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="örn. Serpme Kahvaltı" style={inp(38, 14)} />
              </Field>
              <Field label="Açıklama" hint={`${description.length}/120 önerilen`}>
                <textarea aria-label="Ürün açıklaması" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="İçerik, porsiyon ve öne çıkan özellikler" style={{ ...inp(undefined, 13), height: 'auto', minHeight: 86, padding: '8px 10px', resize: 'vertical' }} />
              </Field>
              <div className="new-product-price-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Satış fiyatı" required><CurrencyInput label="Satış fiyatı" value={price} onChange={setPrice} /></Field>
                <Field label="Maliyet" hint="opsiyonel"><CurrencyInput label="Maliyet" value={cost} onChange={setCost} /></Field>
              </div>
            </div>
          )}

          {step === 2 && <NutritionFields s={nutri} set={setN} firstBorderless />}

          {step === 3 && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: -2 }}>Görünürlük</div>
              <ToggleRow label="Menüde yayında" desc="Tüm müşteriler görebilir" on={isAvailable} onToggle={() => setIsAvailable((v) => !v)} />
              <ToggleRow label="Sadakat damgası kazandırır" desc="Her adet bir damga sayılır (ör. kahve)" on={earnsStamp} onToggle={() => setEarnsStamp((v) => !v)} />
              <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--divider)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Mutfak istasyonu</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button className="new-product-segment" type="button" aria-pressed={stationMode === 'category'} onClick={() => setStationMode('category')} style={segment(stationMode === 'category')}>Kategori varsayılanı</button>
                  <button className="new-product-segment" type="button" aria-pressed={stationMode === 'custom'} onClick={() => setStationMode('custom')} style={segment(stationMode === 'custom')}>Özel istasyon</button>
                </div>
                {stationMode === 'custom' ? (
                  <div>
                    <select value={kitchenStationId} onChange={(e) => setKitchenStationId(e.target.value)} style={{ ...inp(34, 12.5), marginTop: 8 }}>
                      <option value="">Atanmamış</option>
                      {kitchenStations.filter((station) => station.is_active).map((station) => (
                        <option key={station.id} value={station.id}>{station.name}</option>
                      ))}
                    </select>
                    {kitchenStations.length === 0 && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>Henüz istasyon yok. <a href={`/dashboard/${restaurantId}/settings#kitchen-stations`} style={{ color: 'var(--text)', fontWeight: 700 }}>İstasyon oluştur</a></div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.45 }}>
                    {categoryStationId
                      ? `Kategori varsayılanı kullanılacak: ${kitchenStations.find((station) => station.id === categoryStationId)?.name ?? 'Atanmamış'}`
                      : 'Kategori istasyonu yoksa sipariş mutfakta Atanmamış görünür.'}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--divider)', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Görsel ve varyantları ürünü oluşturduktan sonra ürün panelinden ekleyebilirsin.
              </div>
              <div style={{ marginTop: 2 }}><NutritionStatusPill s={nutri} /></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="new-product-footer" style={{ padding: '12px 18px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className="new-product-action new-product-action-secondary" type="button" disabled={pending} onClick={requestClose} style={btnGhost}>İptal</button>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 1 && <button className="new-product-action new-product-action-secondary" type="button" disabled={pending} onClick={() => setStep(step - 1)} style={btnGhost}>Geri</button>}
            <button className="new-product-action new-product-action-primary" type="button" disabled={pending || (step === 1 && !step1Valid)} onClick={next} style={{ ...btnPrimary, opacity: pending || (step === 1 && !step1Valid) ? 0.5 : 1, cursor: pending || (step === 1 && !step1Valid) ? 'not-allowed' : 'pointer' }}>
              {pending ? <InlineSpinner size={13} color="#fff" /> : null}
              {pending ? 'Oluşturuluyor…' : step === 3 ? 'Ürünü oluştur' : 'Devam'}
              {step < 3 && !pending && icChevR}
            </button>
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
    </div>
  )
}

/* ── small pieces ──────────────────────────────────────────────────────── */
const inp = (height?: number, fontSize = 12.5): React.CSSProperties => ({
  width: '100%', height: height ?? 32, padding: '0 10px', border: '1px solid var(--border-strong)', borderRadius: 7,
  background: 'var(--surface)', fontSize, outline: 'none', color: 'var(--text)', fontFamily: 'inherit',
})
const btnGhost: React.CSSProperties = { minHeight: 44, padding: '0 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border-strong)', cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { minHeight: 44, padding: '0 16px', borderRadius: 8, background: 'var(--action)', color: 'var(--on-action)', fontSize: 12.5, fontWeight: 600, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }
const segment = (active: boolean): React.CSSProperties => ({
  minHeight: 44,
  borderRadius: 7,
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
  background: active ? 'var(--text)' : 'var(--surface)',
  color: active ? 'var(--surface)' : 'var(--text-2)',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
})

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{label}{required && <span style={{ color: 'var(--critical)', marginLeft: 3 }}>*</span>}</label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function CurrencyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="new-product-currency" style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden' }}>
      <span style={{ padding: '0 10px', background: 'var(--surface-3)', color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 500, borderRight: '1px solid var(--border)' }}>₺</span>
      <input aria-label={label} value={value} onChange={(e) => onChange(normalizeMenuNumericText(e.target.value))} placeholder="0,00" inputMode="decimal" style={{ flex: 1, minWidth: 0, width: 0, padding: '0 10px', border: 'none', outline: 'none', fontSize: 14, height: 38, fontFamily: "'Geist Mono', monospace", background: 'var(--surface)', color: 'var(--text)' }} />
    </div>
  )
}

function ToggleRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <button className="new-product-toggle" type="button" role="switch" aria-checked={on} onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--divider)', borderRadius: 9, cursor: 'pointer' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{desc}</div>
      </div>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? 'var(--text)' : 'var(--border-strong)', position: 'relative', flexShrink: 0, transition: 'background .12s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 999, background: '#fff', transition: 'left .12s', boxShadow: '0 1px 2px rgba(0,0,0,.18)' }} />
      </span>
    </button>
  )
}
