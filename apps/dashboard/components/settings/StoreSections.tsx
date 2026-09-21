'use client'

import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import type { Tables } from '@garsonless/db/types'
import { I, S, Tag, btnPrimary } from '../../lib/ui'
import { InlineSpinner } from '@garsonless/ui/spinners'
import { SCard, FormRow, Toggle, inputStyle } from './primitives'
import { saveBusinessHours, updateRestaurantTimezone, updateSettings } from '../../lib/actions/restaurant'
import { notifySettingsSaved, useSettingsDirtyState } from './settings-dirty-state'
import {
  mergeCanonicalSettings,
  prepareSettingsMutationAttempt,
  type SettingsMutationAttempt,
} from './settings-save-contract'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import { notifySettingsConflict } from './settings-conflict-state'

/* ── STORE ────────────────────────────────────────── */
function StoreField({
  label,
  sub,
  lead,
  children,
  style,
}: {
  label: string
  sub?: string
  lead?: ReactNode
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
        {label}
        {sub ? <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}> · {sub}</span> : null}
      </span>
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {lead ? (
          <span style={{
            position: 'absolute',
            left: 11,
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--text-3)',
            pointerEvents: 'none',
            zIndex: 1,
          }}>
            {lead}
          </span>
        ) : null}
        {children}
      </span>
    </label>
  )
}

function storeInputStyle(overrides?: CSSProperties): CSSProperties {
  return {
    width: '100%',
    height: 38,
    padding: '0 12px',
    border: '1px solid var(--border-strong)',
    borderRadius: 9,
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13.5,
    outline: 'none',
    boxSizing: 'border-box',
    ...overrides,
  }
}

const gridStyle = (columns: string): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: columns,
  gap: '14px 16px',
  padding: 18,
})

export function StoreSection({ restaurant, isOwner }: { restaurant: Tables<'restaurants'>; isOwner: boolean }) {
  const existing = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const settingsSnapshotRef = useRef(existing)
  const mutationAttemptRef = useRef<SettingsMutationAttempt | null>(null)
  const c = (existing['contact'] as Record<string, unknown> | null) ?? {}
  const str = (v: unknown) => (typeof v === 'string' ? v : '')

  const [phone, setPhone] = useState(str(c['phone']))
  const [email, setEmail] = useState(str(c['email']))
  const [website, setWebsite] = useState(str(c['website']))
  const [address, setAddress] = useState(str(c['address']))
  const [district, setDistrict] = useState(str(c['district']))
  const [city, setCity] = useState(str(c['city']))
  const [zip, setZip] = useState(str(c['zip']))
  const [instagram, setInstagram] = useState(str(c['instagram']))
  const [facebook, setFacebook] = useState(str(c['facebook']))
  const [tiktok, setTiktok] = useState(str(c['tiktok']))
  const [whatsapp, setWhatsapp] = useState(str(c['whatsapp']))

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [timezone, setTimezone] = useState(restaurant.timezone || 'Europe/Istanbul')
  const initialTimezoneRef = useRef(restaurant.timezone || 'Europe/Istanbul')
  const timezoneRequestRef = useRef<string | null>(null)
  const [timezoneMessage, setTimezoneMessage] = useState('')
  const [timezonePending, startTimezoneTransition] = useTransition()
  const initialContactRef = useRef({ phone, email, website, address, district, city, zip, instagram, facebook, tiktok, whatsapp })
  const contactDraft = { phone, email, website, address, district, city, zip, instagram, facebook, tiktok, whatsapp }
  const storeDirty = JSON.stringify(contactDraft) !== JSON.stringify(initialContactRef.current)
  useSettingsDirtyState('store:contact', storeDirty)
  const timezoneDirty = timezone !== initialTimezoneRef.current
  useSettingsDirtyState('store:timezone', isOwner && timezoneDirty)

  function saveTimezone() {
    setTimezoneMessage('')
    const requestId = timezoneRequestRef.current ?? crypto.randomUUID()
    timezoneRequestRef.current = requestId
    startTimezoneTransition(async () => {
      try {
        const result = await updateRestaurantTimezone(restaurant.id, {
          timezone,
          expectedTimezone: initialTimezoneRef.current,
          requestId,
        })
        if ('error' in result) { setTimezoneMessage(result.error); return }
        initialTimezoneRef.current = result.timezone
        timezoneRequestRef.current = null
        setTimezone(result.timezone)
        setTimezoneMessage('Zaman dilimi kaydedildi.')
        notifySettingsSaved('store:timezone')
      } catch {
        setTimezoneMessage('Bağlantı kesildi. Seçiminiz korundu; tekrar deneyebilirsiniz.')
      }
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    const settingsPatch = {
      contact: contactDraft,
    }
    const attempt = prepareSettingsMutationAttempt(mutationAttemptRef.current, {
      patch: settingsPatch,
      expectedSettings: settingsSnapshotRef.current,
    })
    mutationAttemptRef.current = attempt
    startTransition(async () => {
      let result
      try {
        result = await updateSettings(restaurant.id, settingsPatch, {
          expectedSettings: settingsSnapshotRef.current,
          requestId: attempt.requestId,
        })
      } catch {
        setError('Bağlantı kesildi. Taslağın korundu; tekrar deneyebilirsin.')
        return
      }
      if ('error' in result) {
        if (result.code === 'CONFLICT') {
          mutationAttemptRef.current = null
          const canonicalSettings = result.canonicalSettings ?? {}
          notifySettingsConflict({
            source: 'store:contact', canonicalSettings, draft: settingsPatch,
            prepareReapply: () => { settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, canonicalSettings) },
          })
        }
        setError(result.error)
        return
      }
      settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, result.canonicalSettings)
      initialContactRef.current = contactDraft
      mutationAttemptRef.current = null
      setSaved(true)
      notifySettingsSaved('store:contact')
    })
  }

  return (
    <form onSubmit={handleSave} aria-busy={isPending}>
      <SCard title="Mağaza kimliği" subtitle="Menü, fiş ve müşteri bilgi bölümlerinde kullanılan gerçek bilgiler">
        <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--surface-inset)',
            color: 'var(--text-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <I.store size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{restaurant.name}</div>
            <div style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
              menu.masabu.co/{restaurant.slug}
            </div>
          </div>
          <Tag tone="neutral">Kayıtlı bilgi</Tag>
        </div>
        <div style={{
          padding: '11px 18px',
          borderTop: '1px solid var(--divider)',
          background: 'var(--surface-2)',
          fontSize: 12,
          color: 'var(--text-2)',
          lineHeight: 1.45,
        }}>
          Mağaza adı, kısa URL ve logo Çalışma Alanı bölümünden yönetilir. Bu ekrandaki iletişim,
          adres ve sosyal medya alanları müşteri menüsünde ve checkout adreslerinde kullanılır.
        </div>
      </SCard>

      <SCard title="İletişim" subtitle="Müşteriler ve dijital fişlerde görünen bilgiler" style={{ marginTop: 16 }}>
        <div style={gridStyle('1fr 1fr')}>
          <StoreField label="Telefon">
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+90 216 000 00 00" style={storeInputStyle()} />
          </StoreField>
          <StoreField label="E-posta" lead={<I.mail size={15} />}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="info@site.com" style={storeInputStyle({ paddingLeft: 34 })} />
          </StoreField>
          <StoreField label="Web sitesi" lead={<span style={{ ...S.mono, fontSize: 11 }}>https://</span>}>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="site.com" style={storeInputStyle({ paddingLeft: 62 })} />
          </StoreField>
          <StoreField label="WhatsApp sipariş hattı" sub="isteğe bağlı" lead={<span style={{ color: '#25a35a', fontWeight: 800 }}>W</span>}>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+90 532 000 00 00" style={storeInputStyle({ paddingLeft: 34 })} />
          </StoreField>
        </div>
      </SCard>

      <SCard title="Adres" subtitle="Yol tarifi, checkout ve fiş adres alanlarında kullanılır" style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 18px 0', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
          Bu alan yalnızca kayıtlı adres metnidir; harita veya konum doğrulaması yapılmaz.
        </div>
        <div style={gridStyle('2fr 1fr')}>
          <StoreField label="Adres">
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Cadde / Sokak No" style={storeInputStyle()} />
          </StoreField>
          <StoreField label="Posta kodu">
            <input value={zip} onChange={e => setZip(e.target.value)} placeholder="00000" style={storeInputStyle({ fontFamily: "'Geist Mono', monospace" })} />
          </StoreField>
          <StoreField label="İlçe">
            <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="İlçe" style={storeInputStyle()} />
          </StoreField>
          <StoreField label="İl">
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="İl" style={storeInputStyle()} />
          </StoreField>
        </div>
      </SCard>

      {isOwner && <SCard title="Bölgesel ayarlar" subtitle="Rapor ve operasyon gün sınırlarını belirler" style={{ marginTop: 16 }}>
        <FormRow label="Zaman dilimi" hint="Raporlar ve kampanya saatleri için kullanılır">
          <select value={timezone} onChange={(event) => { setTimezone(event.target.value); setTimezoneMessage(''); timezoneRequestRef.current = null }} style={storeInputStyle({ width: 230 })}>
            <option value="Europe/Istanbul">Europe/Istanbul</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </FormRow>
        <FormRow label="Ürün politikası" hint="Menünüzün dili Türkçe, para birimi Türk lirasıdır">
          <Tag tone="neutral">Türkçe · TRY · tr-TR</Tag>
        </FormRow>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t p-4">
          {timezoneMessage && <span role={timezoneMessage.includes('kaydedildi') ? 'status' : 'alert'} className="mr-auto text-xs">{timezoneMessage}</span>}
          <Button type="button" variant="outline" disabled={timezonePending || !timezoneDirty} onClick={saveTimezone}>
            {timezonePending && <Spinner data-icon="inline-start" />}Zaman dilimini kaydet
          </Button>
        </div>
      </SCard>}

      <SCard title="Sosyal medya" subtitle="Müşteri menüsündeki sosyal medya bölümünde görünür" style={{ marginTop: 16 }}>
        <div style={gridStyle('1fr 1fr')}>
          <StoreField label="Instagram" lead={<span style={{ color: '#c13584', fontWeight: 800 }}>@</span>}>
            <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="kullaniciadi" style={storeInputStyle({ paddingLeft: 34 })} />
          </StoreField>
          <StoreField label="Facebook" lead={<span style={{ color: '#1877f2', fontWeight: 800 }}>f</span>}>
            <input value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="sayfa adı" style={storeInputStyle({ paddingLeft: 34 })} />
          </StoreField>
          <StoreField label="TikTok" lead={<span style={{ color: 'var(--text)', fontWeight: 800 }}>♪</span>}>
            <input value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="kullaniciadi" style={storeInputStyle({ paddingLeft: 34 })} />
          </StoreField>
          <StoreField label="WhatsApp" lead={<span style={{ color: '#25a35a', fontWeight: 800 }}>W</span>}>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+90 532 000 00 00" style={storeInputStyle({ paddingLeft: 34 })} />
          </StoreField>
        </div>
      </SCard>

      <div style={{
        marginTop: 20, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span role={error ? 'alert' : 'status'} style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (isPending ? 'Kaydediliyor…' : storeDirty ? 'Kaydedilmemiş değişiklikler' : saved ? 'Kaydedildi' : 'Değişiklik yok')}
        </span>
        <button type="submit" disabled={isPending || !storeDirty} style={btnPrimary()}>
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.check size={13} />}{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}

/* ── HOURS ────────────────────────────────────────── */
const HOUR_DAYS = [
  { key: 'mon', label: 'Pazartesi' },
  { key: 'tue', label: 'Salı' },
  { key: 'wed', label: 'Çarşamba' },
  { key: 'thu', label: 'Perşembe' },
  { key: 'fri', label: 'Cuma' },
  { key: 'sat', label: 'Cumartesi' },
  { key: 'sun', label: 'Pazar' },
]

interface DaySchedule { open: string; close: string; active: boolean; intervals: Array<{ open: string; close: string }> }

export function HoursSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const existing = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const settingsSnapshotRef = useRef(existing)
  const mutationAttemptRef = useRef<SettingsMutationAttempt | null>(null)
  const hoursRaw = (existing['hours'] as Record<string, unknown> | null) ?? {}

  const getDay = (key: string): DaySchedule => {
    const d = hoursRaw[key] as Record<string, unknown> | undefined
    const legacy = {
      open: typeof d?.['open'] === 'string' ? d['open'] : '08:00',
      close: typeof d?.['close'] === 'string' ? d['close'] : '22:00',
    }
    const intervals = Array.isArray(d?.['intervals'])
      ? d['intervals'].flatMap((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return []
        const interval = value as Record<string, unknown>
        return typeof interval['open'] === 'string' && typeof interval['close'] === 'string'
          ? [{ open: interval['open'], close: interval['close'] }]
          : []
      }).slice(0, 3)
      : []
    return {
      ...legacy,
      active: d?.['active'] !== false,
      intervals: intervals.length > 0 ? intervals : [legacy],
    }
  }

  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(
    () => Object.fromEntries(HOUR_DAYS.map(d => [d.key, getDay(d.key)]))
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const initialScheduleRef = useRef(schedule)
  const hoursDirty = JSON.stringify(schedule) !== JSON.stringify(initialScheduleRef.current)
  useSettingsDirtyState('hours:schedule', hoursDirty)

  function update(key: string, patch: Partial<DaySchedule>) {
    setSaved(false)
    setSchedule(prev => ({ ...prev, [key]: { ...prev[key]!, ...patch } }))
  }

  function updateInterval(key: string, index: number, patch: Partial<{ open: string; close: string }>) {
    setSaved(false)
    setSchedule((previous) => {
      const day = previous[key]!
      const intervals = day.intervals.map((interval, intervalIndex) => intervalIndex === index ? { ...interval, ...patch } : interval)
      return { ...previous, [key]: { ...day, intervals, open: intervals[0]!.open, close: intervals[0]!.close } }
    })
  }

  function addInterval(key: string) {
    setSchedule((previous) => {
      const day = previous[key]!
      if (day.intervals.length >= 3) return previous
      return { ...previous, [key]: { ...day, intervals: [...day.intervals, { open: '12:00', close: '14:00' }] } }
    })
  }

  function removeInterval(key: string, index: number) {
    setSchedule((previous) => {
      const day = previous[key]!
      const intervals = day.intervals.filter((_, intervalIndex) => intervalIndex !== index)
      const safe = intervals.length > 0 ? intervals : [{ open: '08:00', close: '22:00' }]
      return { ...previous, [key]: { ...day, intervals: safe, open: safe[0]!.open, close: safe[0]!.close } }
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    const settingsPatch = { hours: schedule }
    const attempt = prepareSettingsMutationAttempt(mutationAttemptRef.current, {
      patch: settingsPatch,
      expectedSettings: settingsSnapshotRef.current,
    })
    mutationAttemptRef.current = attempt
    startTransition(async () => {
      let result
      try {
        result = await saveBusinessHours(restaurant.id, schedule, {
          expectedSettings: settingsSnapshotRef.current,
          requestId: attempt.requestId,
        })
      } catch {
        setError('Bağlantı kesildi. Taslağın korundu; tekrar deneyebilirsin.')
        return
      }
      if ('error' in result) {
        if (result.code === 'CONFLICT') {
          mutationAttemptRef.current = null
          const canonicalSettings = result.canonicalSettings ?? {}
          notifySettingsConflict({
            source: 'hours:schedule', canonicalSettings, draft: settingsPatch,
            prepareReapply: () => { settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, canonicalSettings) },
          })
        }
        setError(result.error)
        return
      }
      settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, result.canonicalSettings)
      initialScheduleRef.current = schedule
      mutationAttemptRef.current = null
      setSaved(true)
      notifySettingsSaved('hours:schedule')
    })
  }

  const todayIdx = ((new Date().getDay() + 6) % 7)

  return (
    <form onSubmit={handleSave} aria-busy={isPending}>
      <SCard title="Haftalık program" subtitle="Her gün için üç servis aralığı eklenebilir; kapanış açılıştan erkense aralık gece yarısını aşar.">
        {HOUR_DAYS.map((day, i) => {
          const s = schedule[day.key]!
          const isToday = i === todayIdx
          return (
            <div key={day.key} style={{
              padding: '10px 18px',
              display: 'grid', gridTemplateColumns: '40px 140px 1fr',
              alignItems: 'center', gap: 10,
              borderBottom: i === HOUR_DAYS.length - 1 ? 'none' : '1px solid var(--divider)',
              background: isToday ? 'var(--surface-2)' : 'transparent',
            }}>
              <Toggle on={s.active} onChange={(active) => update(day.key, { active })} ariaLabel={`${day.label} ${s.active ? 'açık' : 'kapalı'}`} />
              <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500 }}>
                {day.label}
                {isToday && <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>Bugün</span>}
              </div>
              {s.active ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  {s.intervals.map((interval, intervalIndex) => <div key={intervalIndex} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    aria-label={`${day.label} ${intervalIndex + 1}. açılış saati`}
                    type="time"
                    value={interval.open}
                    onChange={e => updateInterval(day.key, intervalIndex, { open: e.target.value })}
                    style={inputStyle({ width: 90, fontFamily: "'Geist Mono'" })}
                  />
                  <span style={{ color: 'var(--text-3)' }}>-</span>
                  <input
                    aria-label={`${day.label} ${intervalIndex + 1}. kapanış saati`}
                    type="time"
                    value={interval.close}
                    onChange={e => updateInterval(day.key, intervalIndex, { close: e.target.value })}
                    style={inputStyle({ width: 90, fontFamily: "'Geist Mono'" })}
                  />
                  {s.intervals.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => removeInterval(day.key, intervalIndex)} aria-label={`${day.label} ${intervalIndex + 1}. aralığı kaldır`}>Kaldır</Button>}
                  </div>)}
                  {s.intervals.length < 3 && <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => addInterval(day.key)}>Servis aralığı ekle</Button>}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Kapalı</span>
              )}
            </div>
          )
        })}
      </SCard>

      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span role={error ? 'alert' : 'status'} style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (isPending ? 'Kaydediliyor…' : hoursDirty ? 'Kaydedilmemiş değişiklikler' : saved ? 'Kaydedildi' : 'Değişiklik yok')}
        </span>
        <button type="submit" disabled={isPending || !hoursDirty} style={btnPrimary()}>
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.check size={13} />}{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}

/* ── TAX ──────────────────────────────────────────── */
export function TaxSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const existing = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const settingsSnapshotRef = useRef(existing)
  const mutationAttemptRef = useRef<SettingsMutationAttempt | null>(null)
  const taxRaw = (existing['tax'] as Record<string, unknown> | null) ?? {}
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)

  const [company, setCompany] = useState(str(taxRaw['company']))
  const [taxNumber, setTaxNumber] = useState(str(taxRaw['taxNumber']))
  const [office, setOffice] = useState(str(taxRaw['office']))
  const [tcVkn, setTcVkn] = useState(str(taxRaw['tcVkn']))
  const [address, setAddress] = useState(str(taxRaw['address']))

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const initialTaxRef = useRef({ company, taxNumber, office, tcVkn, address })
  const taxDraft = { company, taxNumber, office, tcVkn, address }
  const taxDirty = JSON.stringify(taxDraft) !== JSON.stringify(initialTaxRef.current)
  useSettingsDirtyState('tax:company', taxDirty)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    const settingsPatch = {
      tax: taxDraft,
    }
    const attempt = prepareSettingsMutationAttempt(mutationAttemptRef.current, {
      patch: settingsPatch,
      expectedSettings: settingsSnapshotRef.current,
    })
    mutationAttemptRef.current = attempt
    startTransition(async () => {
      let result
      try {
        result = await updateSettings(restaurant.id, settingsPatch, {
          expectedSettings: settingsSnapshotRef.current,
          requestId: attempt.requestId,
        })
      } catch {
        setError('Bağlantı kesildi. Taslağın korundu; tekrar deneyebilirsin.')
        return
      }
      if ('error' in result) {
        if (result.code === 'CONFLICT') {
          mutationAttemptRef.current = null
          const canonicalSettings = result.canonicalSettings ?? {}
          notifySettingsConflict({
            source: 'tax:company', canonicalSettings, draft: settingsPatch,
            prepareReapply: () => { settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, canonicalSettings) },
          })
        }
        setError(result.error)
        return
      }
      settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, result.canonicalSettings)
      initialTaxRef.current = taxDraft
      mutationAttemptRef.current = null
      setSaved(true)
      notifySettingsSaved('tax:company')
    })
  }

  return (
    <form onSubmit={handleSave} aria-busy={isPending}>
      <SCard title="KDV politikası" subtitle="Ürün fiyatları müşteriye KDV dahil gösterilir.">
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'grid',
          gap: 6,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Fiyatlar KDV dahildir
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-2)' }}>
            Gerçek KDV oranları kategori varsayılanı ve ürün özel oranı olarak Menü ekranında yönetilir.
            Fişte KDV tutarı satış fiyatının içinden ayrıştırılarak gösterilir; bu ekranda ek vergi hesaplanmaz.
          </div>
        </div>
      </SCard>

      <SCard title="Firma bilgisi" subtitle="Sipariş ve fiş bilgilerinde kullanılır" style={{ marginTop: 16 }}>
        <FormRow label="Şirket adı"><Input value={company} onChange={e => setCompany(e.target.value)} className="w-80" /></FormRow>
        <FormRow label="Vergi numarası"><Input value={taxNumber} onChange={e => setTaxNumber(e.target.value)} className="w-50 font-mono" /></FormRow>
        <FormRow label="Vergi dairesi"><Input value={office} onChange={e => setOffice(e.target.value)} className="w-50" /></FormRow>
        <FormRow label="TC / VKN"><Input value={tcVkn} onChange={e => setTcVkn(e.target.value)} className="w-50 font-mono" /></FormRow>
        <FormRow label="Fatura adresi" hint="Şirket adresi"><Input value={address} onChange={e => setAddress(e.target.value)} className="w-90" /></FormRow>
      </SCard>

      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span role={error ? 'alert' : 'status'} style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (isPending ? 'Kaydediliyor…' : taxDirty ? 'Kaydedilmemiş değişiklikler' : saved ? 'Kaydedildi' : 'Değişiklik yok')}
        </span>
        <Button type="submit" disabled={isPending || !taxDirty}>
          {isPending ? <Spinner data-icon="inline-start" /> : <I.check data-icon="inline-start" />}
          {isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )
}
