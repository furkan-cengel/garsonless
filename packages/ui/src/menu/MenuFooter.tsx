'use client'

import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { CSSProperties } from 'react'
import { AppIcons as I, type AppIcon } from '../icons'
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
  if (instagram) links.push({ key: 'instagram', label: 'Instagram', href: instagram, external: true, Icon: I.image })
  const facebook = contact.facebook ? socialUrl('facebook', contact.facebook) : null
  if (facebook) links.push({ key: 'facebook', label: 'Facebook', href: facebook, external: true, Icon: I.users })
  const tiktok = contact.tiktok ? socialUrl('tiktok', contact.tiktok) : null
  if (tiktok) links.push({ key: 'tiktok', label: 'TikTok', href: tiktok, external: true, Icon: I.music })
  const whatsappDigits = contact.whatsapp?.replace(/\D/g, '')
  if (whatsappDigits) links.push({ key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/${whatsappDigits}`, external: true, Icon: I.messageCircle })
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
  if (!(theme.footerEnabled ?? true)) return null

  const contact = storeInfo?.contact
  const address = [contact?.address, contact?.district, contact?.city, contact?.zip].filter(Boolean).join(', ')
  const contactLinks = (theme.footerShowContact ?? true) ? normalizeFooterContactLinks(contact) : []
  const socialLinks = (theme.footerShowSocial ?? true) ? normalizeFooterSocialLinks(contact) : []
  const palette = footerPalette(theme)
  const needsActionClearance = (
    theme.cartPlacement === 'footer' && (cartCount > 0 || theme.cardVariant === 'spain')
  ) || theme.servicePlacement === 'floating'

  return (
    <footer
      id="menu-global-footer"
      data-component="footer"
      data-menu-footer
      data-footer-tone={theme.footerTone ?? 'surface'}
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

        {socialLinks.length > 0 && (
          <div data-menu-footer-social aria-label="Sosyal medya bağlantıları">
            {socialLinks.map(({ key, label, href, Icon }) => (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                <Icon size={17} /><span>{label}</span>
              </a>
            ))}
          </div>
        )}

        {(theme.footerShowCopyright ?? true) && (
          <small data-menu-footer-copyright>© {new Date().getFullYear()} · {restaurantName}</small>
        )}
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
[data-menu-footer-social] a{min-width:38px;height:38px;padding:0 10px;border:1px solid var(--footer-line);border-radius:999px;background:var(--footer-chip);color:var(--footer-fg);display:inline-flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;font:700 11px var(--p-body)}
[data-menu-footer-copyright]{padding-top:14px;border-top:1px solid var(--footer-line);color:var(--footer-muted);font:550 10.5px var(--p-body)}
[data-menu-footer] a:focus-visible{outline:2px solid var(--footer-fg);outline-offset:3px}
@media(min-width:700px){
  [data-menu-footer-inner]{grid-template-columns:minmax(180px,1.15fr) minmax(260px,1.7fr) auto;align-items:start;padding-block:28px}
  [data-menu-footer-contact]{align-self:center}
  [data-menu-footer-social]{justify-content:flex-end;align-self:center}
  [data-menu-footer-social] a span{display:none}
  [data-menu-footer-copyright]{grid-column:1/-1}
}
@media(max-width:360px){[data-menu-footer-contact] a{width:100%;box-sizing:border-box}[data-menu-footer-social] a span{display:none}}
`
