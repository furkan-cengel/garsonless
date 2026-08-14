import Image from 'next/image'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

const PRODUCT_LINKS = [
  { label: 'Özellikler', href: '/#özellikler' },
  { label: 'Nasıl çalışır', href: '/#demo' },
  { label: 'Menü özelleştirme', href: '/#menu-ozellestirme' },
  { label: 'Fiyatlar', href: '/#fiyatlandırma' },
  { label: 'Sık sorulanlar', href: '/#sss' },
]

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="container">
        <div className="marketing-footer__main">
          <div className="marketing-footer__brand">
            <a href="/" aria-label="Masabu ana sayfa">
              <Image
                src="/brand/masabu-logo-transparent.svg"
                alt="Masabu"
                width={102}
                height={22}
              />
            </a>
            <p>QR menüden mutfak ekranına, servis operasyonunu tek akışta yönetin.</p>
          </div>

          <nav className="marketing-footer__nav" aria-label="Footer navigasyonu">
            <div>
              <h2>Keşfet</h2>
              <ul>
                {PRODUCT_LINKS.map((link) => (
                  <li key={link.label}><a href={link.href}>{link.label}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h2>Hesap</h2>
              <ul>
                <li><a href={`${DASHBOARD_URL}/login`}>Giriş yap</a></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="marketing-footer__bottom">
          <span>© 2026 Masabu · İstanbul, Türkiye</span>
          <span>Restoran operasyonları için tasarlandı.</span>
        </div>
      </div>
    </footer>
  )
}
