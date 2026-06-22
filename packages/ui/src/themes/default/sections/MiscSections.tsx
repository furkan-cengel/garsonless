import { makeReaders, customSectionShell } from '../lib/sectionHelpers'
import type { MenuCategory } from '../../../menu/types'

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

export function InfoBlockSection({
  sectionId,
  config,
  restaurantName,
}: {
  sectionId: string
  config: Record<string, string>
  restaurantName: string
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
    'social-block': 'Sosyal Medya',
    footer: restaurantName,
  }
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
        <p style={{ margin: '6px 0 0', color: 'var(--p-text-2)', fontSize: 12.5, lineHeight: 1.45 }}>
          {text('body', 'Sipariş deneyimini zenginleştiren bilgi ve etkileşim bloğu.')}
        </p>
      </div>
    </section>
  )
}
