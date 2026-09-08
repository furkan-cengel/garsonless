import Image from 'next/image'
import { LEGAL_IDENTITY } from '../lib/legal-identity'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

type SocialIconProps = { size?: number }

function InstagramIcon({ size = 18 }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.35" cy="6.7" r="1.15" fill="currentColor" />
    </svg>
  )
}

function FacebookIcon({ size = 18 }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M13.7 21v-8h2.8l.45-3.2H13.7V7.9c0-.93.3-1.55 1.62-1.55h1.75V3.5a24 24 0 0 0-2.55-.13c-2.52 0-4.25 1.54-4.25 4.37V9.8H7.42V13h2.85v8h3.43Z" />
    </svg>
  )
}

function LinkedInIcon({ size = 18 }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="3.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="7.55" cy="8.15" r="1.1" fill="currentColor" />
      <path d="M7.55 11.4V17M11.3 17v-5.6M11.3 13.8c.48-1.55 1.55-2.4 2.93-2.4 1.74 0 2.67 1.14 2.67 3.2V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon({ size = 18 }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.51 11.24h-6.66l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.11l11.97 15.64Z" />
    </svg>
  )
}

const SOCIAL_PLATFORMS = [
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'LinkedIn', Icon: LinkedInIcon, href: 'https://www.linkedin.com/company/masabu/' },
  { label: 'X', Icon: XIcon },
] as const

const FOOTER_GROUPS = [
  {
    title: 'Ürün',
    links: [
      ['Özellikler', '/#özellikler'],
      ['Nasıl çalışır', '/#demo'],
      ['Fiyatlar', '/fiyatlar'],
      ['Sık sorulanlar', '/#sss'],
    ],
  },
  {
    title: 'Yasal',
    links: [
      ['KVKK Aydınlatma', '/yasal/kvkk-aydinlatma-metni'],
      ['Gizlilik', '/yasal/gizlilik-politikasi'],
      ['Çerezler', '/yasal/cerez-politikasi'],
      ['Hizmet sözleşmesi', '/yasal/abonelik-hizmet-sozlesmesi'],
      ['İptal ve iade', '/yasal/iptal-iade-ve-dijital-teslimat'],
    ],
  },
  {
    title: 'masabu',
    links: [
      ['Hakkımızda', '/hakkimizda'],
      ['Blog', '/blog'],
      ['İletişim', '/iletisim'],
      ['Giriş yap', `${DASHBOARD_URL}/auth/login`],
    ],
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="container">
        <div className="marketing-footer__main">
          <div className="marketing-footer__brand">
            <a href="/" aria-label="masabu ana sayfa">
              <Image src="/brand/masabu-logo-transparent.svg" alt="masabu" width={102} height={22} />
            </a>
            <p>QR menüden mutfak ekranına, servis operasyonunu tek akışta yönetin.</p>
            <address className="marketing-footer__identity">
              <strong>{LEGAL_IDENTITY.proprietor}</strong>
              <span>{LEGAL_IDENTITY.entityType} · VKN {LEGAL_IDENTITY.taxNumber}</span>
              <span>{LEGAL_IDENTITY.address}</span>
              <a href={`mailto:${LEGAL_IDENTITY.generalEmail}`}>{LEGAL_IDENTITY.generalEmail}</a>
              {LEGAL_IDENTITY.phone && <a href={`tel:${LEGAL_IDENTITY.phone.replace(/\s/g, '')}`}>{LEGAL_IDENTITY.phone}</a>}
            </address>
          </div>

          <nav className="marketing-footer__nav" aria-label="Footer navigasyonu">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 style={group.title === 'masabu' ? { textTransform: 'none' } : undefined}>{group.title}</h2>
                <ul>
                  {group.links.map(([label, href]) => (
                    <li key={label}><a href={href}>{label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="marketing-footer__payments" aria-label="Desteklenen güvenli ödeme yöntemleri">
          <span>Güvenli ödeme yöntemleri</span>
          <Image
            src="/payments/iyzico-payment-methods.svg"
            alt="iyzico ile Öde, Mastercard, Visa, American Express ve Troy"
            width={429}
            height={32}
          />
        </div>

        <div className="marketing-footer__bottom">
          <span>© 2026 masabu · İstanbul, Türkiye</span>
          <ul className="marketing-footer__socials" aria-label="masabu sosyal medya hesapları">
            {SOCIAL_PLATFORMS.map(({ label, Icon, ...social }) => (
              <li key={label}>
                {'href' in social ? (
                  <a
                    className="marketing-footer__social-link"
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${label} sayfasını aç`}
                  >
                    <Icon />
                  </a>
                ) : (
                  <span
                    className="marketing-footer__social-placeholder"
                    aria-label={`${label} bağlantısı yakında`}
                    aria-disabled="true"
                    title={`${label} bağlantısı yakında`}
                  >
                    <Icon />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
