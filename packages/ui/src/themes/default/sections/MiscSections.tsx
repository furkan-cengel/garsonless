import React from 'react'
import { makeReaders, customSectionShell } from '../lib/sectionHelpers'
import { AppIcons as I } from '../../../icons'
import type { MenuCategory } from '../../../menu/types'
import type { StoreInfo } from '../../types'

export function ModeTabsSection({ config }: { config: Record<string, string> }) {
  const { text } = makeReaders(config)
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{ borderRadius: 'var(--p-radius)', background: 'var(--p-card)', border: 'var(--p-border-w) solid var(--p-border)', padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[text('mode1', 'Salon'), text('mode2', 'Paket'), text('mode3', 'Teslimat')].map((mode, index) => (
            <button key={mode} type="button" style={{ height: 34, border: 'none', borderRadius: 999, background: index === 0 ? 'var(--p-accent)' : 'var(--p-accent-soft)', color: index === 0 ? '#fff' : 'var(--p-accent)', fontWeight: 800 }}>
              {mode}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function AddressBarSection({ sectionId, config }: { sectionId: string; config: Record<string, string> }) {
  const { text } = makeReaders(config)
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{ height: 46, borderRadius: 999, background: 'var(--p-card)', border: 'var(--p-border-w) solid var(--p-border)', boxShadow: 'var(--p-shadow)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', color: 'var(--p-text-2)', fontSize: 13 }}>
        <span>{sectionId === 'search' ? 'Ara' : 'Konum'}</span>
        <span>{text('title', sectionId === 'search' ? 'Ürün ara...' : 'Masa teslimatı · Adres seç')}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--p-accent)' }}>→</span>
      </div>
    </section>
  )
}

export function QuickLinksSection({ categories }: { categories: MenuCategory[] }) {
  const links = ['Popüler', 'Yeni', 'Vejetaryen']
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {links.map((label, index) => (
          <a
            key={label}
            href={categories[index]?.id ? `#section-${categories[index]?.id}` : '#'}
            style={{
              minHeight: 68,
              borderRadius: 'var(--p-radius)',
              background: index === 0 ? 'var(--p-accent)' : 'var(--p-card)',
              color: index === 0 ? '#fff' : 'var(--p-text)',
              border: index === 0 ? 'none' : 'var(--p-border-w) solid var(--p-border)',
              boxShadow: 'var(--p-shadow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {label}
          </a>
        ))}
      </div>
    </section>
  )
}

export function InfoCardSection({ sectionId }: { sectionId: string }) {
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{
        borderRadius: `calc(var(--p-radius) + 2px)`,
        background: 'var(--p-card)',
        border: 'var(--p-border-w) solid var(--p-border)',
        boxShadow: 'var(--p-shadow)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--p-accent-soft)',
          color: 'var(--p-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          flexShrink: 0,
        }}>
          ★
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, color: 'var(--p-text)', fontSize: 15, fontWeight: 800 }}>
            {sectionId === 'minimal-list' ? 'Sade Fiyat Listesi' : 'Şef Önerileri'}
          </h3>
          <p style={{ margin: '4px 0 0', color: 'var(--p-text-2)', fontSize: 12.5, lineHeight: 1.4 }}>
            Bugün en çok tercih edilen lezzetleri öne çıkarın.
          </p>
        </div>
      </div>
    </section>
  )
}

const DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  mon: 'Pazartesi',
  tue: 'Salı',
  wed: 'Çarşamba',
  thu: 'Perşembe',
  fri: 'Cuma',
  sat: 'Cumartesi',
  sun: 'Pazar',
}

type HoursRow = { key: string; label: string; value: string; active: boolean }

export function HoursInfoSection({
  storeInfo,
}: {
  storeInfo?: StoreInfo | null
}) {
  const now = new Date()
  const todayKey = DAY_ORDER[now.getDay()]!
  const today = storeInfo?.hours?.[todayKey]
  const rows = buildHoursRows(storeInfo, todayKey)
  const status = today
    ? today.active === false
      ? 'Bugün kapalı'
      : dayIntervals(today).some((interval) => isTimeWithinRange(now, interval.open, interval.close))
        ? 'Şimdi açık'
        : 'Şu an kapalı'
    : 'Saat bilgisi yok'
  const statusActive = status === 'Şimdi açık'

  return (
    <section data-component="custom-section" data-hours-info-preview style={customSectionShell}>
      <div style={infoPreviewCardStyle}>
        <div style={infoPreviewHeaderStyle}>
          <span style={infoPreviewIconStyle}><I.clock size={19} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={infoPreviewTitleStyle}>Çalışma Saatleri</h3>
            <p style={infoPreviewSubtitleStyle}>Haftalık servis programı</p>
          </div>
          <span style={{ ...infoPreviewStatusStyle, background: statusActive ? 'var(--p-accent-soft)' : 'color-mix(in srgb, var(--p-text) 7%, transparent)', color: statusActive ? 'var(--p-accent)' : 'var(--p-text-2)' }}>
            <i style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            {status}
          </span>
        </div>

        {rows.length > 0 ? (
          <div style={infoPreviewRowsStyle}>
            {rows.map((row) => (
              <div key={row.key} data-today={row.key === todayKey || undefined} style={{ ...infoPreviewRowStyle, ...(row.key === todayKey ? infoPreviewTodayRowStyle : {}) }}>
                <span>{row.label}</span>
                <b style={{ color: row.active ? 'var(--p-text)' : 'var(--p-text-2)' }}>{row.value}</b>
              </div>
            ))}
          </div>
        ) : (
          <p style={infoPreviewEmptyStyle}>Çalışma saatleri henüz eklenmedi.</p>
        )}
      </div>
    </section>
  )
}

export function WifiInfoSection({
  config,
  catalogMock = false,
}: {
  config: Record<string, string>
  catalogMock?: boolean
}) {
  const { text } = makeReaders(config)
  const networkName = config.networkName?.trim() || (catalogMock ? 'MAF Guest' : '')
  const password = config.password?.trim() || (catalogMock ? 'misafir2026' : '')
  const note = text('note', catalogMock ? 'Misafir ağına bağlanmak için bilgileri kopyalayın.' : '')
  const hasInfo = Boolean(networkName || password)

  return (
    <section data-component="custom-section" data-wifi-info-preview style={customSectionShell}>
      <div style={infoPreviewCardStyle}>
        <div style={infoPreviewHeaderStyle}>
          <span style={infoPreviewIconStyle}><I.globe size={19} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={infoPreviewTitleStyle}>Wi-Fi Bilgisi</h3>
            <p style={infoPreviewSubtitleStyle}>{note || 'Misafir ağı bağlantısı'}</p>
          </div>
          {hasInfo && <span style={{ ...infoPreviewStatusStyle, background: 'var(--p-accent-soft)', color: 'var(--p-accent)' }}>Misafir ağı</span>}
        </div>

        {hasInfo ? (
          <div style={infoPreviewRowsStyle}>
            {networkName && <InfoCopyRow label="Ağ adı" value={networkName} />}
            {password && <InfoCopyRow label="Şifre" value={maskPassword(password)} />}
          </div>
        ) : (
          <p style={infoPreviewEmptyStyle}>Wi-Fi bilgileri henüz eklenmedi.</p>
        )}
      </div>
    </section>
  )
}

function InfoCopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoPreviewRowStyle}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <small style={{ color: 'var(--p-text-2)', fontSize: 10.5 }}>{label}</small>
        <b style={{ color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</b>
      </span>
      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--p-accent-soft)', color: 'var(--p-accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <I.copy size={14} />
      </span>
    </div>
  )
}

function buildHoursRows(storeInfo: StoreInfo | null | undefined, todayKey: (typeof DAY_ORDER)[number]): HoursRow[] {
  const todayIndex = DAY_ORDER.indexOf(todayKey)
  const rotatedDays = [...DAY_ORDER.slice(todayIndex), ...DAY_ORDER.slice(0, todayIndex)]
  const realRows = rotatedDays.flatMap((key) => {
    const day = storeInfo?.hours?.[key]
    if (!day) return []
    const intervals = dayIntervals(day)
    const active = day.active !== false && intervals.length > 0
    return [{
      key,
      label: key === todayKey ? 'Bugün' : DAY_LABELS[key],
      value: active ? intervals.map((interval) => `${interval.open}–${interval.close}`).join(' · ') : 'Kapalı',
      active,
    }]
  })
  return realRows.slice(0, 3)
}

function dayIntervals(day: NonNullable<NonNullable<StoreInfo['hours']>[string]>): Array<{ open: string; close: string }> {
  if (day.intervals?.length) return day.intervals
  return day.open && day.close ? [{ open: day.open, close: day.close }] : []
}

function isTimeWithinRange(now: Date, open: string, close: string) {
  const toMinutes = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value)
    if (!match) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours > 23 || minutes > 59) return null
    return hours * 60 + minutes
  }
  const openMinutes = toMinutes(open)
  const closeMinutes = toMinutes(close)
  if (openMinutes === null || closeMinutes === null) return false
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return closeMinutes > openMinutes
    ? nowMinutes >= openMinutes && nowMinutes < closeMinutes
    : nowMinutes >= openMinutes || nowMinutes < closeMinutes
}

function maskPassword(password: string) {
  return '•'.repeat(Math.min(10, Math.max(6, password.length)))
}

const infoPreviewCardStyle = {
  borderRadius: 'calc(var(--p-radius) + 2px)',
  background: 'var(--p-card)',
  border: 'var(--p-border-w) solid var(--p-border)',
  boxShadow: 'var(--p-shadow)',
  padding: 14,
  color: 'var(--p-text)',
} as const
const infoPreviewHeaderStyle = { display: 'flex', alignItems: 'center', gap: 11 } as const
const infoPreviewIconStyle = { width: 38, height: 38, borderRadius: 12, background: 'var(--p-accent-soft)', color: 'var(--p-accent)', display: 'grid', placeItems: 'center', flexShrink: 0 } as const
const infoPreviewTitleStyle = { margin: 0, color: 'var(--p-text)', fontSize: 14, lineHeight: 1.2, fontWeight: 850 } as const
const infoPreviewSubtitleStyle = { margin: '3px 0 0', color: 'var(--p-text-2)', fontSize: 10.5, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const
const infoPreviewStatusStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 24, padding: '0 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 } as const
const infoPreviewRowsStyle = { display: 'grid', gap: 0, marginTop: 10, borderTop: '1px solid var(--p-border)' } as const
const infoPreviewRowStyle = { minHeight: 37, padding: '6px 7px', borderBottom: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'var(--p-text-2)', fontSize: 11.5 } as const
const infoPreviewTodayRowStyle = { marginInline: -4, paddingInline: 11, borderRadius: 9, borderBottomColor: 'transparent', background: 'color-mix(in srgb, var(--p-accent-soft) 72%, transparent)', color: 'var(--p-accent)', fontWeight: 750 } as const
const infoPreviewEmptyStyle = { margin: '12px 0 0', padding: '11px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--p-accent-soft) 58%, transparent)', color: 'var(--p-text-2)', fontSize: 11.5, lineHeight: 1.45 } as const

export function InfoBlockSection({
  sectionId,
  config,
  storeInfo,
}: {
  sectionId: string
  config: Record<string, string>
  storeInfo?: StoreInfo | null
}) {
  const { text } = makeReaders(config)
  const titleMap: Record<string, string> = {
    reviews: 'Misafir Yorumu',
    hours: 'Çalışma Saatleri',
    allergens: 'Alerjen Bilgileri',
    'service-info': 'Servis Bilgisi',
    'request-buttons': 'Hızlı İstekler',
    'waiter-call': 'Garson Çağır',
    'wifi-info': 'Wi-Fi Bilgisi',
    'bill-summary': 'Hesap Özeti',
  }
  const realBody = readRealInfoBody(sectionId, storeInfo)
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{
        borderRadius: 'var(--p-radius)',
        border: '1px dashed var(--p-accent)',
        background: 'color-mix(in srgb, var(--p-accent-soft) 72%, transparent)',
        padding: 14,
        color: 'var(--p-text)',
      }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 850 }}>{text('title', titleMap[sectionId] ?? sectionId)}</h3>
        <p style={{ margin: '6px 0 0', color: 'var(--p-text-2)', fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'pre-line' }}>
          {realBody ?? text('body', 'Bu bilgi işletme tarafından henüz doldurulmadı.')}
        </p>
      </div>
    </section>
  )
}

function readRealInfoBody(sectionId: string, storeInfo?: StoreInfo | null): string | null {
  if (!storeInfo) return null
  if (sectionId === 'hours') {
    const hours = storeInfo.hours ?? {}
    const lines = Object.entries(DAY_LABELS)
      .map(([key, label]) => {
        const day = hours[key]
        if (!day) return null
        if (day.active === false) return `${label}: Kapalı`
        const intervals = dayIntervals(day)
        if (!intervals.length) return null
        return `${label}: ${intervals.map((interval) => `${interval.open}-${interval.close}`).join(', ')}`
      })
      .filter((line): line is string => Boolean(line))
    return lines.length ? lines.join('\n') : 'Çalışma saatleri henüz eklenmedi.'
  }

  return null
}
