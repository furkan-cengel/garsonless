'use client'

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import type { Tables } from '@garsonless/db'
import { I, S, Tag, btnPrimary } from '../../lib/ui'
import { InlineSpinner } from '@garsonless/ui'
import { SCard, FormRow, inputStyle } from './primitives'
import { updateSettings } from '../../lib/actions/restaurant'

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
          <Tag tone="positive">Canlı bilgi</Tag>
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
        <div style={{ padding: 18, paddingBottom: 0 }}>
          <div style={{
            minHeight: 132,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'linear-gradient(135deg, #eef2ee 0%, #e2ebe4 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <svg width="100%" height="132" viewBox="0 0 640 132" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 42 L190 56 L306 28 L446 49 L560 28 L640 42" stroke="#fff" strokeWidth="7" fill="none" />
              <path d="M0 98 L146 106 L284 84 L422 101 L540 92 L640 101" stroke="#fff" strokeWidth="5" fill="none" opacity=".75" />
              <path d="M306 0 L324 132" stroke="#fff" strokeWidth="4" opacity=".8" />
              <path d="M478 0 L494 132" stroke="#fff" strokeWidth="3" opacity=".6" />
              <rect x="30" y="20" width="90" height="48" fill="rgba(47,111,78,.09)" rx="4" />
              <rect x="360" y="84" width="150" height="42" fill="rgba(47,111,78,.09)" rx="4" />
              <rect x="150" y="102" width="90" height="26" fill="rgba(47,111,78,.09)" rx="4" />
            </svg>
            <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -100%)', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.22))' }}>
              <svg width="31" height="40" viewBox="0 0 34 44" aria-hidden="true">
                <path d="M17 0a14 14 0 0 1 14 14c0 10-14 30-14 30S3 24 3 14A14 14 0 0 1 17 0Z" fill="var(--accent)" />
                <circle cx="17" cy="14" r="5" fill="#fff" />
              </svg>
            </div>
            <div style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              maxWidth: 'calc(100% - 24px)',
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '7px 11px',
              boxShadow: 'var(--shadow-2)',
              fontSize: 11.5,
              color: 'var(--text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {[address, district, city, zip].filter(Boolean).join(', ') || 'Adres bilgisi girilmedi'}
            </div>
          </div>
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
          company, taxNumber, office, tcVkn, address,
        },
      })
      if ('error' in result) { setError(result.error); return }
      setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSave}>
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

      <SCard title="Firma bilgisi" subtitle="Checkout adres alanlarında kullanılır; e-fatura entegrasyonu bu sürümde yok" style={{ marginTop: 16 }}>
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

export function LanguagesSection() {
  const defaultLang = ALL_LANGS.find(l => l.code === 'tr')!

  return (
    <>
      <SCard title="Menü dili" subtitle="Bu sürümde müşteri menüsü tek dilde yayınlanır">
        <div style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 24 }}>{defaultLang.flag}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{defaultLang.name}</span>
              <Tag tone="positive">Varsayılan</Tag>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.45 }}>
              Çok dilli menü, manuel çeviri ve otomatik çeviri pipeline'ı henüz bağlı değil.
            </div>
          </div>
        </div>
      </SCard>

      <SCard title="Çeviri" subtitle="Gelecek sürüm kapsamı" style={{ marginTop: 16 }}>
        <FormRow label="Manuel çeviri" hint="Ürün/kategori metinlerinin ayrı dil varyantları henüz yok">
          <Tag tone="neutral">Yakında</Tag>
        </FormRow>
        <FormRow label="Otomatik çeviri" hint="DeepL/LLM sağlayıcı ve onay akışı bu fazda yok">
          <Tag tone="neutral">Kapalı</Tag>
        </FormRow>
      </SCard>
    </>
  )
}
