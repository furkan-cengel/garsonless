'use client'

import { useState, useTransition } from 'react'
import type { Tables } from '@garsonless/db'
import { I, S, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import { InlineSpinner } from '@garsonless/ui'
import { SCard, FormRow, inputStyle } from './primitives'
import { updateSettings } from '../../lib/actions/restaurant'

/* ── STORE ────────────────────────────────────────── */
export function StoreSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const existing = (restaurant.settings as Record<string, unknown> | null) ?? {}
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

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateSettings(restaurant.id, {
        contact: { phone, email, website, address, district, city, zip, instagram, facebook, tiktok, whatsapp },
      })
      if ('error' in result) { setError(result.error); return }
      setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSave}>
      <SCard title="İletişim">
        <FormRow label="Mağaza adı" hint="Çalışma Alanı bölümünden değiştirin">
          <input value={restaurant.name} readOnly style={inputStyle({ width: 280, opacity: 0.6 })} />
        </FormRow>
        <FormRow label="Telefon">
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+90 ..." style={inputStyle({ width: 200 })} />
        </FormRow>
        <FormRow label="E-posta">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="info@..." style={inputStyle({ width: 240 })} />
        </FormRow>
        <FormRow label="Web sitesi">
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." style={inputStyle({ width: 280 })} />
        </FormRow>
      </SCard>

      <SCard title="Adres" subtitle="Yol tarifi ve fatura adresi olarak kullanılır" style={{ marginTop: 16 }}>
        <FormRow label="Adres">
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Cadde / Sokak No:" style={inputStyle({ width: 320 })} />
        </FormRow>
        <FormRow label="İlçe / İl">
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="İlçe" style={inputStyle({ width: 140 })} />
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="İl" style={inputStyle({ width: 140 })} />
          </div>
        </FormRow>
        <FormRow label="Posta kodu">
          <input value={zip} onChange={e => setZip(e.target.value)} placeholder="00000" style={inputStyle({ width: 100, fontFamily: "'Geist Mono'" })} />
        </FormRow>
      </SCard>

      <SCard title="Sosyal medya" subtitle="Footer ve menü altında görünür" style={{ marginTop: 16 }}>
        <FormRow label="Instagram">
          <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@kullaniciadi" style={inputStyle({ width: 260 })} />
        </FormRow>
        <FormRow label="Facebook">
          <input value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="sayfa adı" style={inputStyle({ width: 260 })} />
        </FormRow>
        <FormRow label="TikTok">
          <input value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="@kullaniciadi" style={inputStyle({ width: 260 })} />
        </FormRow>
        <FormRow label="WhatsApp">
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+90..." style={inputStyle({ width: 260 })} />
        </FormRow>
      </SCard>

      <div style={{
        marginTop: 20, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (saved ? '✓ Kaydedildi' : 'Değişiklikleri kaydedin')}
        </span>
        <button type="submit" disabled={isPending} style={btnPrimary()}>
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

interface DaySchedule { open: string; close: string; active: boolean }

export function HoursSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const existing = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const hoursRaw = (existing['hours'] as Record<string, unknown> | null) ?? {}

  const getDay = (key: string): DaySchedule => {
    const d = hoursRaw[key] as Record<string, unknown> | undefined
    return {
      open: typeof d?.['open'] === 'string' ? d['open'] : '08:00',
      close: typeof d?.['close'] === 'string' ? d['close'] : '22:00',
      active: d?.['active'] !== false,
    }
  }

  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(
    () => Object.fromEntries(HOUR_DAYS.map(d => [d.key, getDay(d.key)]))
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function update(key: string, patch: Partial<DaySchedule>) {
    setSaved(false)
    setSchedule(prev => ({ ...prev, [key]: { ...prev[key]!, ...patch } }))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateSettings(restaurant.id, { hours: schedule })
      if ('error' in result) { setError(result.error); return }
      setSaved(true)
    })
  }

  const todayIdx = ((new Date().getDay() + 6) % 7)

  return (
    <form onSubmit={handleSave}>
      <SCard title="Haftalık program" subtitle="Müşteriler menüde bu saatleri görür">
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
              <button
                type="button"
                onClick={() => update(day.key, { active: !s.active })}
                style={{
                  width: 34, height: 20, borderRadius: 999,
                  background: s.active ? 'var(--text)' : 'var(--border-strong)',
                  border: 'none', position: 'relative', cursor: 'pointer',
                  transition: 'background 120ms', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: s.active ? 16 : 2,
                  width: 16, height: 16, borderRadius: 999, background: '#fff',
                  transition: 'left 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.18)',
                }} />
              </button>
              <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500 }}>
                {day.label}
                {isToday && <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>Bugün</span>}
              </div>
              {s.active ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="time"
                    value={s.open}
                    onChange={e => update(day.key, { open: e.target.value })}
                    style={inputStyle({ width: 90, fontFamily: "'Geist Mono'" })}
                  />
                  <span style={{ color: 'var(--text-3)' }}>—</span>
                  <input
                    type="time"
                    value={s.close}
                    onChange={e => update(day.key, { close: e.target.value })}
                    style={inputStyle({ width: 90, fontFamily: "'Geist Mono'" })}
                  />
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
        <span style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (saved ? '✓ Kaydedildi' : 'Değişiklikleri kaydedin')}
        </span>
        <button type="submit" disabled={isPending} style={btnPrimary()}>
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.check size={13} />}{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}

/* ── TAX ──────────────────────────────────────────── */
export function TaxSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const existing = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const taxRaw = (existing['tax'] as Record<string, unknown> | null) ?? {}
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
  const num = (v: unknown, fallback: number) => (typeof v === 'number' ? String(v) : fallback)

  const [taxType, setTaxType] = useState(str(taxRaw['type'], 'KDV'))
  const [rate, setRate] = useState(num(taxRaw['rate'], 10))
  const [included, setIncluded] = useState((taxRaw['included'] as boolean | undefined) !== false)
  const [withholding, setWithholding] = useState(num(taxRaw['withholding'], 0))
  const [company, setCompany] = useState(str(taxRaw['company']))
  const [taxNumber, setTaxNumber] = useState(str(taxRaw['taxNumber']))
  const [office, setOffice] = useState(str(taxRaw['office']))
  const [tcVkn, setTcVkn] = useState(str(taxRaw['tcVkn']))
  const [address, setAddress] = useState(str(taxRaw['address']))

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateSettings(restaurant.id, {
        tax: {
          type: taxType,
          rate: parseFloat(String(rate)) || 0,
          included,
          withholding: parseFloat(String(withholding)) || 0,
          company, taxNumber, office, tcVkn, address,
        },
      })
      if ('error' in result) { setError(result.error); return }
      setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSave}>
      <SCard title="Vergi yapılandırması">
        <FormRow label="Vergi türü">
          <select
            value={taxType}
            onChange={e => setTaxType(e.target.value)}
            style={inputStyle({ width: 200 })}
          >
            {['KDV', 'KDV Muafiyet', 'OSS'].map(o => <option key={o}>{o}</option>)}
          </select>
        </FormRow>
        <FormRow label="Vergi oranı" hint="Standart oran">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={rate}
              onChange={e => setRate(e.target.value)}
              style={inputStyle({ width: 80, textAlign: 'right', fontFamily: "'Geist Mono'" })}
            />
            <span style={{ ...S.mono, fontSize: 12 }}>%</span>
          </div>
        </FormRow>
        <FormRow label="Fiyatlara dahil" hint="Müşteri vergi dahil fiyat görür">
          <button
            type="button"
            onClick={() => setIncluded(v => !v)}
            style={{
              width: 34, height: 20, borderRadius: 999,
              background: included ? 'var(--text)' : 'var(--border-strong)',
              border: 'none', position: 'relative', cursor: 'pointer',
              transition: 'background 120ms',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: included ? 16 : 2,
              width: 16, height: 16, borderRadius: 999, background: '#fff',
              transition: 'left 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.18)',
            }} />
          </button>
        </FormRow>
        <FormRow label="Stopaj" hint="Hizmet sektörü için %0">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={withholding}
              onChange={e => setWithholding(e.target.value)}
              style={inputStyle({ width: 80, textAlign: 'right', fontFamily: "'Geist Mono'" })}
            />
            <span style={{ ...S.mono, fontSize: 12 }}>%</span>
          </div>
        </FormRow>
      </SCard>

      <SCard title="Fatura bilgisi" subtitle="E-fatura ve e-arşivde kullanılır" style={{ marginTop: 16 }}>
        <FormRow label="Şirket adı"><input value={company} onChange={e => setCompany(e.target.value)} style={inputStyle({ width: 320 })} /></FormRow>
        <FormRow label="Vergi numarası"><input value={taxNumber} onChange={e => setTaxNumber(e.target.value)} style={inputStyle({ width: 200, fontFamily: "'Geist Mono'" })} /></FormRow>
        <FormRow label="Vergi dairesi"><input value={office} onChange={e => setOffice(e.target.value)} style={inputStyle({ width: 200 })} /></FormRow>
        <FormRow label="TC / VKN"><input value={tcVkn} onChange={e => setTcVkn(e.target.value)} style={inputStyle({ width: 200, fontFamily: "'Geist Mono'" })} /></FormRow>
        <FormRow label="Fatura adresi" hint="Şirket adresi"><input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle({ width: 360 })} /></FormRow>
      </SCard>

      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (saved ? '✓ Kaydedildi' : 'Değişiklikleri kaydedin')}
        </span>
        <button type="submit" disabled={isPending} style={btnPrimary()}>
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.check size={13} />}{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}

/* ── LANGUAGES ────────────────────────────────────── */
const ALL_LANGS = [
  { code: 'tr', name: 'Türkçe',    flag: '🇹🇷', rtl: false, isDefault: true },
  { code: 'en', name: 'English',   flag: '🇬🇧', rtl: false, isDefault: false },
  { code: 'ar', name: 'العربية',   flag: '🇸🇦', rtl: true,  isDefault: false },
  { code: 'de', name: 'Deutsch',   flag: '🇩🇪', rtl: false, isDefault: false },
  { code: 'ru', name: 'Русский',   flag: '🇷🇺', rtl: false, isDefault: false },
  { code: 'fr', name: 'Français',  flag: '🇫🇷', rtl: false, isDefault: false },
  { code: 'es', name: 'Español',   flag: '🇪🇸', rtl: false, isDefault: false },
  { code: 'it', name: 'Italiano',  flag: '🇮🇹', rtl: false, isDefault: false },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', rtl: false, isDefault: false },
  { code: 'nl', name: 'Nederlands',flag: '🇳🇱', rtl: false, isDefault: false },
]

export function LanguagesSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const existing = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const langsRaw = (existing['languages'] as Record<string, unknown> | null) ?? {}
  const activeRaw = Array.isArray(langsRaw['active']) ? (langsRaw['active'] as string[]) : ['tr', 'en']

  const [activeCodes, setActiveCodes] = useState<string[]>(activeRaw)
  const [autoTranslate, setAutoTranslate] = useState((langsRaw['autoTranslate'] as boolean | undefined) !== false)
  const [provider, setProvider] = useState(typeof langsRaw['provider'] === 'string' ? langsRaw['provider'] : 'DeepL')
  const [requireApproval, setRequireApproval] = useState((langsRaw['requireApproval'] as boolean | undefined) !== false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggleLang(code: string) {
    if (code === 'tr') return
    setSaved(false)
    setActiveCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateSettings(restaurant.id, {
        languages: { active: activeCodes, autoTranslate, provider, requireApproval },
      })
      if ('error' in result) { setError(result.error); return }
      setSaved(true)
    })
  }

  const activeLangs = ALL_LANGS.filter(l => activeCodes.includes(l.code))
  const inactiveLangs = ALL_LANGS.filter(l => !activeCodes.includes(l.code))

  return (
    <form onSubmit={handleSave}>
      <SCard title="Aktif diller" subtitle="Müşteri menü ekranında dil seçebilir">
        {activeLangs.map((l, i, arr) => (
          <div key={l.code} style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--divider)',
          }}>
            <span style={{ fontSize: 24 }}>{l.flag}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{l.name}</span>
                {l.isDefault && <Tag tone="positive">Varsayılan</Tag>}
                {l.rtl && <Tag>RTL</Tag>}
              </div>
            </div>
            {!l.isDefault && (
              <button type="button" onClick={() => toggleLang(l.code)} style={btnGhost()}>
                <I.close size={12} />Kaldır
              </button>
            )}
          </div>
        ))}
      </SCard>

      {inactiveLangs.length > 0 && (
        <SCard title="Dil ekle" style={{ marginTop: 16 }}>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {inactiveLangs.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => toggleLang(l.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18 }}>{l.flag}</span>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{l.name}</span>
              </button>
            ))}
          </div>
        </SCard>
      )}

      <SCard title="Otomatik çeviri" subtitle="Yapay zekâ ile içeriğini diğer dillere çevirir" style={{ marginTop: 16 }}>
        <FormRow label="Otomatik çeviri" hint="Yeni ürünleri tüm aktif dillere çevir">
          <button type="button" onClick={() => setAutoTranslate(v => !v)} style={{
            width: 34, height: 20, borderRadius: 999,
            background: autoTranslate ? 'var(--text)' : 'var(--border-strong)',
            border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 120ms',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: autoTranslate ? 16 : 2,
              width: 16, height: 16, borderRadius: 999, background: '#fff',
              transition: 'left 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.18)',
            }} />
          </button>
        </FormRow>
        <FormRow label="Sağlayıcı">
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            style={inputStyle({ width: 200 })}
          >
            {['DeepL', 'Google Translate', 'Claude'].map(o => <option key={o}>{o}</option>)}
          </select>
        </FormRow>
        <FormRow label="Onay gerektir" hint="Çevirileri yayınlamadan önce onayla">
          <button type="button" onClick={() => setRequireApproval(v => !v)} style={{
            width: 34, height: 20, borderRadius: 999,
            background: requireApproval ? 'var(--text)' : 'var(--border-strong)',
            border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 120ms',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: requireApproval ? 16 : 2,
              width: 16, height: 16, borderRadius: 999, background: '#fff',
              transition: 'left 120ms', boxShadow: '0 1px 2px rgba(0,0,0,.18)',
            }} />
          </button>
        </FormRow>
      </SCard>

      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: error ? 'var(--critical)' : 'var(--text-3)' }}>
          {error || (saved ? '✓ Kaydedildi' : 'Değişiklikleri kaydedin')}
        </span>
        <button type="submit" disabled={isPending} style={btnPrimary()}>
          {isPending ? <InlineSpinner size={13} color="var(--on-action)" /> : <I.check size={13} />}{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
