'use client'

import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { CSSProperties } from 'react'
import { AppIcons as I, type AppIcon, type AppIconProps } from '../icons'
import type { StoreInfo } from '../themes/types'
import { useTheme } from './ThemeContext'

type FooterLink = {
  key: string
  label: string
  href: string
  external?: boolean
  Icon: AppIcon
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MASABU_URL = 'https://masabu.co/'

function InstagramIcon({ size = 18 }: AppIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.35" cy="6.7" r="1.15" fill="currentColor" />
    </svg>
  )
}

function FacebookIcon({ size = 18 }: AppIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M13.7 21v-8h2.8l.45-3.2H13.7V7.9c0-.93.3-1.55 1.62-1.55h1.75V3.5a24 24 0 0 0-2.55-.13c-2.52 0-4.25 1.54-4.25 4.37V9.8H7.42V13h2.85v8h3.43Z" />
    </svg>
  )
}

function TikTokIcon({ size = 18 }: AppIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M14.2 4v10.1a4.45 4.45 0 1 1-3.7-4.39v3.02a1.55 1.55 0 1 0 .8 1.37V4h2.9Zm0 0c.55 2.12 2.05 3.47 4.3 3.87v2.98c-1.7-.12-3.13-.72-4.3-1.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WhatsAppIcon({ size = 18 }: AppIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M20.2 11.7a8.2 8.2 0 0 1-12.05 7.2L4 20l1.1-4.02A8.2 8.2 0 1 1 20.2 11.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.75 7.85c.2-.45.42-.46.73-.47h.62c.2 0 .4.08.5.35l.82 1.93c.08.2.04.37-.08.55l-.64.82c-.13.16-.07.32.03.48.75 1.25 1.76 2.15 3.02 2.76.2.1.35.08.48-.08l.92-1.12c.15-.18.34-.2.54-.12l1.86.88c.25.12.36.27.34.5-.12 1.2-.67 1.88-1.42 2.2-.62.27-1.47.3-2.4-.02-1.07-.37-2.36-.98-3.66-2.13-1.1-.97-2.08-2.22-2.63-3.4-.47-1.02-.48-1.9-.05-2.9Z" fill="currentColor" />
    </svg>
  )
}

function safeHttpUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function socialUrl(platform: 'instagram' | 'facebook' | 'tiktok', value: string) {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return safeHttpUrl(trimmed)
  const handle = trimmed.replace(/^@/, '').replace(/^\/+|\/+$/g, '')
  if (!handle) return null
  const base = platform === 'instagram'
    ? 'https://www.instagram.com/'
    : platform === 'facebook'
      ? 'https://www.facebook.com/'
      : 'https://www.tiktok.com/@'
  return safeHttpUrl(`${base}${handle}`)
}

export function normalizeFooterContactLinks(contact?: NonNullable<StoreInfo['contact']> | null): FooterLink[] {
  if (!contact) return []
  const links: FooterLink[] = []
  const phone = contact.phone?.trim()
  const phoneTarget = phone?.replace(/[^\d+]/g, '')
  if (phone && phoneTarget && /\d/.test(phoneTarget)) {
    links.push({ key: 'phone', label: phone, href: `tel:${phoneTarget}`, Icon: I.phoneCall })
  }
  const email = contact.email?.trim()
  if (email && EMAIL_PATTERN.test(email)) {
    links.push({ key: 'email', label: email, href: `mailto:${email}`, Icon: I.mail })
  }
  const website = contact.website?.trim()
  const websiteHref = website ? safeHttpUrl(website) : null
  if (website && websiteHref) {
    links.push({ key: 'website', label: website.replace(/^https?:\/\//i, '').replace(/\/$/, ''), href: websiteHref, external: true, Icon: I.globe })
  }
  return links
}

export function normalizeFooterSocialLinks(contact?: NonNullable<StoreInfo['contact']> | null): FooterLink[] {
  if (!contact) return []
  const links: FooterLink[] = []
  const instagram = contact.instagram ? socialUrl('instagram', contact.instagram) : null
  if (instagram) links.push({ key: 'instagram', label: 'Instagram', href: instagram, external: true, Icon: InstagramIcon })
  const facebook = contact.facebook ? socialUrl('facebook', contact.facebook) : null
  if (facebook) links.push({ key: 'facebook', label: 'Facebook', href: facebook, external: true, Icon: FacebookIcon })
  const tiktok = contact.tiktok ? socialUrl('tiktok', contact.tiktok) : null
  if (tiktok) links.push({ key: 'tiktok', label: 'TikTok', href: tiktok, external: true, Icon: TikTokIcon })
  const whatsappDigits = contact.whatsapp?.replace(/\D/g, '')
  if (whatsappDigits) links.push({ key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${whatsappDigits}`, external: true, Icon: WhatsAppIcon })
  return links
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace(/^#/, '')
  const expanded = normalized.length === 3
    ? normalized.split('').map((character) => character + character).join('')
    : normalized.slice(0, 6)
  if (!/^[\da-f]{6}$/i.test(expanded)) return null
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

export function readableFooterForeground(background: string) {
  const luminance = relativeLuminance(background)
  if (luminance === null) return '#ffffff'
  const whiteContrast = 1.05 / (luminance + 0.05)
  const darkContrast = (luminance + 0.05) / 0.05
  return darkContrast >= whiteContrast ? '#111318' : '#ffffff'
}

function footerPalette(theme: GarsonlessTheme) {
  const tone = theme.footerTone ?? 'surface'
  if (tone === 'brand') {
    const foreground = readableFooterForeground(theme.accent)
    return {
      background: 'var(--p-accent)',
      foreground,
      muted: `color-mix(in srgb, ${foreground} 72%, transparent)`,
      line: `color-mix(in srgb, ${foreground} 20%, transparent)`,
      chip: `color-mix(in srgb, ${foreground} 12%, transparent)`,
    }
  }
  if (tone === 'dark') {
    return {
      background: '#17191d',
      foreground: '#ffffff',
      muted: 'rgba(255,255,255,.7)',
      line: 'rgba(255,255,255,.14)',
      chip: 'rgba(255,255,255,.1)',
    }
  }
  return {
    background: 'var(--p-card)',
    foreground: 'var(--p-text)',
    muted: 'var(--p-text-2)',
    line: 'var(--p-border)',
    chip: 'color-mix(in srgb,var(--p-text) 6%,transparent)',
  }
}

export function MenuFooter({ storeInfo, cartCount = 0 }: { storeInfo?: StoreInfo | null; cartCount?: number }) {
  const { theme, restaurantName, logoUrl } = useTheme()
  const businessFooterEnabled = theme.footerEnabled ?? true

  const contact = storeInfo?.contact
  const address = [contact?.address, contact?.district, contact?.city, contact?.zip].filter(Boolean).join(', ')
  const normalizedContactLinks = normalizeFooterContactLinks(contact)
  const showContact = businessFooterEnabled && (theme.footerShowContact ?? true)
  const contactLinks = showContact ? normalizedContactLinks.filter((link) => link.key !== 'phone') : []
  const phoneLink = showContact ? normalizedContactLinks.find((link) => link.key === 'phone') : undefined
  const socialLinks = businessFooterEnabled && (theme.footerShowSocial ?? true) ? normalizeFooterSocialLinks(contact) : []
  const iconLinks = phoneLink ? [phoneLink, ...socialLinks] : socialLinks
  const palette = footerPalette(theme)
  const needsActionClearance = (
    theme.cartPlacement === 'footer' && cartCount > 0
  ) || theme.servicePlacement === 'floating'

  return (
    <footer
      id="menu-global-footer"
      data-component="footer"
      data-menu-footer
      data-footer-tone={theme.footerTone ?? 'surface'}
      data-business-footer-enabled={businessFooterEnabled ? 'true' : 'false'}
      style={{
        '--footer-fg': palette.foreground,
        '--footer-muted': palette.muted,
        '--footer-line': palette.line,
        '--footer-chip': palette.chip,
        background: palette.background,
        color: palette.foreground,
        borderTop: `1px solid ${palette.line}`,
        paddingBottom: needsActionClearance
          ? 'calc(96px + env(safe-area-inset-bottom, 0px))'
          : 'env(safe-area-inset-bottom, 0px)',
      } as CSSProperties}
    >
      {businessFooterEnabled && (
        <div data-menu-footer-inner>
          <div data-menu-footer-brand>
            {(theme.footerShowLogo ?? true) && (
              <span data-menu-footer-logo aria-hidden="true">
                {logoUrl ? <img src={logoUrl} alt="" /> : restaurantName.trim().charAt(0).toLocaleUpperCase('tr-TR') || 'M'}
              </span>
            )}
            <div>
              <strong>{restaurantName}</strong>
              {(theme.footerShowAddress ?? true) && address && (
                <span data-menu-footer-address><I.mapPin size={15} />{address}</span>
              )}
            </div>
          </div>

          {contactLinks.length > 0 && (
            <div data-menu-footer-contact aria-label="İletişim bağlantıları">
              {contactLinks.map(({ key, label, href, external, Icon }) => (
                <a key={key} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  <Icon size={15} /><span>{label}</span>{external && <I.externalLink size={12} />}
                </a>
              ))}
            </div>
          )}

          {iconLinks.length > 0 && (
            <div data-menu-footer-social aria-label="Telefon ve sosyal medya bağlantıları">
              {iconLinks.map(({ key, label, href, external, Icon }) => (
                <a
                  key={key}
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  aria-label={key === 'phone' ? `Telefonla ara: ${label}` : `${label} sayfasını aç`}
                  title={key === 'phone' ? 'Telefonla ara' : label}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          )}

          {(theme.footerShowCopyright ?? true) && (
            <small data-menu-footer-copyright>© {new Date().getFullYear()} · {restaurantName}</small>
          )}
        </div>
      )}
      <div data-menu-footer-attribution>
        <a href={MASABU_URL} target="_blank" rel="noopener noreferrer" aria-label="Powered by Masabu">
          <span>Powered by</span>
          <strong data-menu-footer-wordmark aria-hidden="true"><b>masa</b><b data-wordmark-accent>bu.</b></strong>
        </a>
      </div>
      <style>{MENU_FOOTER_CSS}</style>
    </footer>
  )
}

const MENU_FOOTER_CSS = `
[data-menu-footer-inner]{max-width:1200px;margin:0 auto;padding:24px max(var(--p-pad),18px);display:grid;gap:18px;box-sizing:border-box}
[data-menu-footer-brand]{display:flex;align-items:flex-start;gap:12px;min-width:0}
[data-menu-footer-logo]{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;overflow:hidden;background:var(--footer-chip);color:var(--footer-fg);font:800 18px var(--p-body)}
[data-menu-footer-logo] img{width:100%;height:100%;object-fit:cover}
[data-menu-footer-brand]>div{min-width:0;display:grid;gap:7px}
[data-menu-footer-brand] strong{font:750 17px/1.2 var(--p-body);letter-spacing:-.01em}
[data-menu-footer-address]{display:flex;align-items:flex-start;gap:7px;color:var(--footer-muted);font-size:12px;line-height:1.45}
[data-menu-footer-address] svg{margin-top:1px;flex:0 0 auto}
[data-menu-footer-contact]{display:flex;flex-wrap:wrap;gap:8px}
[data-menu-footer-contact] a{min-height:36px;max-width:100%;padding:0 11px;border:1px solid var(--footer-line);border-radius:999px;background:var(--footer-chip);color:var(--footer-fg);display:inline-flex;align-items:center;gap:7px;text-decoration:none;font:650 11.5px var(--p-body)}
[data-menu-footer-contact] a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-menu-footer-social]{display:flex;flex-wrap:wrap;gap:8px}
[data-menu-footer-social] a{width:38px;height:38px;padding:0;border:1px solid var(--footer-line);border-radius:999px;background:var(--footer-chip);color:var(--footer-fg);display:inline-flex;align-items:center;justify-content:center;text-decoration:none;transition:transform 150ms ease,background 150ms ease}
[data-menu-footer-social] a:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--footer-fg) 10%,transparent)}
[data-menu-footer-copyright]{padding-top:14px;border-top:1px solid var(--footer-line);color:var(--footer-muted);font:550 10.5px var(--p-body)}
[data-menu-footer-attribution]{max-width:1200px;margin:0 auto;padding:0 max(var(--p-pad),18px) 18px;display:flex;justify-content:center;box-sizing:border-box}
[data-menu-footer-attribution] a{min-height:34px;padding:0 10px;border:1px solid rgba(17,19,24,.1);border-radius:999px;background:rgba(255,255,255,.94);color:#17191d;display:inline-flex;align-items:center;gap:6px;text-decoration:none;box-shadow:0 1px 3px rgba(15,17,21,.06)}
[data-menu-footer-attribution] a>span{color:#747982;font:650 9.5px/1 var(--p-body);letter-spacing:.01em}
[data-menu-footer-wordmark]{display:inline-flex;align-items:baseline;font:900 14px/1 var(--p-body);letter-spacing:-.055em}
[data-menu-footer-wordmark] b{font:inherit}
[data-menu-footer-wordmark] [data-wordmark-accent]{color:#2e7d52}
[data-menu-footer][data-business-footer-enabled="false"] [data-menu-footer-attribution]{padding-top:16px}
[data-menu-footer] a:focus-visible{outline:2px solid var(--footer-fg);outline-offset:3px}
@media(prefers-reduced-motion:reduce){[data-menu-footer-social] a{transition:none}[data-menu-footer-social] a:hover{transform:none}}
@media(min-width:700px){
  [data-menu-footer-inner]{grid-template-columns:minmax(180px,1.15fr) minmax(260px,1.7fr) auto;align-items:start;padding-block:28px}
  [data-menu-footer-contact]{align-self:center}
  [data-menu-footer-social]{justify-content:flex-end;align-self:center}
  [data-menu-footer-copyright]{grid-column:1/-1}
}
@media(max-width:360px){[data-menu-footer-contact] a{width:100%;box-sizing:border-box}}
`
