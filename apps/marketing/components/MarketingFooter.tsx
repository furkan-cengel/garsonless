import { MI } from '../lib/icons'

const COLS = [
  { title: 'Ürün', items: [
    { l: 'Menü',          href: '/#özellikler' },
    { l: 'Sipariş',       href: '/#özellikler' },
    { l: 'QR Stüdyosu',   href: '/#özellikler' },
    { l: 'Tema',          href: '/#özellikler' },
    { l: 'Analiz',        href: '/#özellikler' },
    { l: 'Mutfak ekranı', href: '/#özellikler' },
  ]},
  { title: 'Çözümler', items: [
    { l: 'Kafeler',            href: '/solutions#kafeler' },
    { l: 'Restoranlar',        href: '/solutions#restoranlar' },
    { l: 'Bar & meyhane',      href: '/solutions#bar' },
    { l: 'Zincir & franchise', href: '/solutions#zincir' },
    { l: 'Otel restoranları',  href: '/solutions#otel' },
  ]},
  { title: 'Kaynaklar', items: [
    { l: 'Blog',              href: '/resources#blog' },
    { l: 'Vaka çalışmaları',  href: '/resources#vaka' },
    { l: 'Yardım merkezi',    href: '/resources#yardım' },
    { l: 'API dokümanı',      href: '/resources#api' },
    { l: 'Şablonlar',         href: '/resources#şablon' },
    { l: 'Topluluk',          href: '/resources#topluluk' },
  ]},
  { title: 'Şirket', items: [
    { l: 'Hakkımızda', href: '/company#hakkımızda' },
    { l: 'Kariyer',    href: '/company#kariyer' },
    { l: 'Basın',      href: '/company#basın' },
    { l: 'İletişim',   href: '/company#iletişim' },
    { l: 'Bayilik',    href: '/company#bayilik' },
  ]},
]

export function MarketingFooter() {
  return (
    <footer style={{ background: 'var(--bg)', padding: '100px 0 40px', borderTop: '1px solid var(--line)' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 48, marginBottom: 56 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'var(--ink)', color: 'var(--accent-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 19, lineHeight: 1,
              }}>g</div>
              <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' }}>garsonless</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 280, margin: 0 }}>
              Türk gastronomisi için tasarlandı.<br />Mekanınız ister kafe ister fine-dining — biz oradayız.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              {([<MI.ig key="ig" size={16} />, <MI.tw key="tw" size={16} />, <MI.lk key="lk" size={16} />]).map((ic, i) => (
                <a key={i} href="#" style={{
                  width: 36, height: 36, borderRadius: 999,
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  color: 'var(--ink-2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{ic}</a>
              ))}
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 16px' }}>
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {col.items.map((item) => (
                  <li key={item.l}>
                    <a href={item.href} style={{ fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none' }}>{item.l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{
          paddingTop: 28, borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>© 2026 garsonless · İstanbul, Türkiye</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--ink-3)' }}>
            <a href="/legal#gizlilik" style={{ textDecoration: 'none', color: 'inherit' }}>Gizlilik</a>
            <a href="/legal#şartlar" style={{ textDecoration: 'none', color: 'inherit' }}>Şartlar</a>
            <a href="/legal#kvkk" style={{ textDecoration: 'none', color: 'inherit' }}>KVKK</a>
            <a href="/legal#çerezler" style={{ textDecoration: 'none', color: 'inherit' }}>Çerezler</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--positive)' }} />
            Tüm sistemler operasyonel
          </div>
        </div>
      </div>
    </footer>
  )
}
