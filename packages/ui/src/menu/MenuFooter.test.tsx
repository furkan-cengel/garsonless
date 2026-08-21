import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_THEME } from '@garsonless/design-engine'
import { ThemeProvider } from './ThemeContext'
import type { StoreInfo } from '../themes/types'
import {
  MenuFooter,
  normalizeFooterContactLinks,
  normalizeFooterSocialLinks,
  readableFooterForeground,
} from './MenuFooter'
import { NavDrawer } from './NavDrawer'

// The direct Node/tsx test runner compiles the existing context with the
// classic JSX runtime, while the package build uses the automatic runtime.
Object.assign(globalThis, { React })

const storeInfo: StoreInfo = {
  contact: {
    phone: '+90 216 000 00 00',
    email: 'hello@example.com',
    website: 'example.com',
    address: 'Örnek Caddesi 1',
    district: 'Kadıköy',
    city: 'İstanbul',
    instagram: '@ornek',
    facebook: 'ornek.sayfa',
    tiktok: '@ornekvideo',
    whatsapp: '+90 532 000 00 00',
  },
}

function renderFooter(theme = DEFAULT_THEME, info: StoreInfo = storeInfo) {
  return renderToStaticMarkup(
    <ThemeProvider initialTheme={theme} initialRestaurantName="Çok Uzun Restoran Adı" initialLogoUrl={null}>
      <MenuFooter storeInfo={info} cartCount={2} />
    </ThemeProvider>,
  )
}

test('footer renders real contact and social links without placeholder content', () => {
  const markup = renderFooter()

  assert.match(markup, /data-component="footer"/)
  assert.match(markup, /Örnek Caddesi 1, Kadıköy, İstanbul/)
  assert.match(markup, /href="tel:\+902160000000"/)
  assert.match(markup, /aria-label="Telefonla ara: \+90 216 000 00 00"/)
  assert.doesNotMatch(markup, />\+90 216 000 00 00</)
  assert.match(markup, /href="mailto:hello@example.com"/)
  assert.match(markup, /href="https:\/\/example.com\/"/)
  assert.match(markup, /aria-label="Instagram sayfasını aç"/)
  assert.match(markup, /aria-label="Facebook sayfasını aç"/)
  assert.match(markup, /aria-label="TikTok sayfasını aç"/)
  assert.match(markup, /aria-label="WhatsApp sayfasını aç"/)
  assert.match(markup, /href="https:\/\/wa.me\/905320000000"/)
  assert.match(markup, /href="https:\/\/masabu.co\/"/)
  assert.match(markup, /aria-label="Powered by Masabu"/)
  assert.match(markup, new RegExp(`© ${new Date().getFullYear()} · Çok Uzun Restoran Adı`))
  assert.doesNotMatch(markup, /henüz eklenmedi|bilgi girilmedi/i)
  assert.ok(markup.indexOf('href="tel:+902160000000"') < markup.indexOf('aria-label="Instagram sayfasını aç"'))
})

test('footer omits unavailable business groups while Masabu attribution is always rendered', () => {
  const emptyMarkup = renderFooter(DEFAULT_THEME, { contact: {} })
  assert.match(emptyMarkup, /Çok Uzun Restoran Adı/)
  assert.doesNotMatch(
    emptyMarkup,
    /data-menu-footer-(?:contact|social|address)="true"/,
  )

  const disabledMarkup = renderFooter({ ...DEFAULT_THEME, footerEnabled: false })
  assert.doesNotMatch(disabledMarkup, /Çok Uzun Restoran Adı/)
  assert.match(disabledMarkup, /data-business-footer-enabled="false"/)
  assert.match(disabledMarkup, /aria-label="Powered by Masabu"/)
  assert.match(disabledMarkup, /href="https:\/\/masabu.co\/"/)
})

test('footer link normalization rejects unsafe or malformed destinations', () => {
  assert.deepEqual(normalizeFooterContactLinks({ website: 'javascript:alert(1)', email: 'bozuk', phone: 'abc' }), [])
  assert.equal(normalizeFooterContactLinks({ website: 'https://example.com/menu' })[0]?.href, 'https://example.com/menu')
  assert.equal(normalizeFooterSocialLinks({ instagram: '@masabu' })[0]?.href, 'https://www.instagram.com/masabu')
})

test('brand footer foreground chooses the higher contrast neutral', () => {
  assert.equal(readableFooterForeground('#ffffff'), '#111318')
  assert.equal(readableFooterForeground('#111111'), '#ffffff')
  assert.equal(readableFooterForeground('#fff'), '#111318')
})

test('floating service action does not reserve an empty block below the footer', () => {
  const markup = renderToStaticMarkup(
    <ThemeProvider
      initialTheme={{ ...DEFAULT_THEME, cartPlacement: 'hidden', servicePlacement: 'floating' }}
      initialRestaurantName="Çok Uzun Restoran Adı"
      initialLogoUrl={null}
    >
      <MenuFooter storeInfo={storeInfo} cartCount={0} />
    </ThemeProvider>,
  )

  assert.match(markup, /padding-bottom:env\(safe-area-inset-bottom, 0px\)/)
  assert.doesNotMatch(markup, /padding-bottom:calc\(96px/)
})

test('footer clearance follows the selected cart trigger and disappears for an empty cart', () => {
  const pill = renderFooter({ ...DEFAULT_THEME, cartFooterTriggerStyle: 'pill', cartPillPosition: 'floating' })
  const thumbs = renderFooter({ ...DEFAULT_THEME, cartFooterTriggerStyle: 'thumbs' })
  const empty = renderToStaticMarkup(
    <ThemeProvider initialTheme={DEFAULT_THEME} initialRestaurantName="Masabu" initialLogoUrl={null}>
      <MenuFooter storeInfo={storeInfo} cartCount={0} />
    </ThemeProvider>,
  )

  assert.match(pill, /padding-bottom:calc\(98px \+ env\(safe-area-inset-bottom, 0px\)\)/)
  assert.match(thumbs, /padding-bottom:calc\(88px \+ env\(safe-area-inset-bottom, 0px\)\)/)
  assert.match(empty, /padding-bottom:env\(safe-area-inset-bottom, 0px\)/)
})

test('compact footer surfaces keep 44px hit areas and pointer-safe motion', () => {
  const markup = renderFooter()

  assert.match(markup, /\[data-menu-footer-contact\] a\{min-height:44px/)
  assert.match(markup, /\[data-menu-footer-social\] a\{width:44px;height:44px/)
  assert.match(markup, /\[data-menu-footer-attribution\] a\{min-height:44px/)
  assert.match(markup, /\[data-menu-footer-social-surface\]\{width:38px;height:38px/)
  assert.match(markup, /@media\(hover:hover\) and \(pointer:fine\)/)
  assert.match(markup, /@media\(prefers-reduced-motion:reduce\)/)
})

test('footer and drawer preserve the complete aspect ratio of uploaded logos', () => {
  const markup = renderToStaticMarkup(
    <ThemeProvider
      initialTheme={DEFAULT_THEME}
      initialRestaurantName="Çok Uzun Restoran Adı"
      initialLogoUrl="https://example.com/wide-logo.png"
    >
      <MenuFooter storeInfo={storeInfo} cartCount={0} />
      <NavDrawer open onClose={() => undefined} restaurantName="Çok Uzun Restoran Adı" />
    </ThemeProvider>,
  )

  assert.match(markup, /data-menu-footer-logo="true" data-logo-image="true"/)
  assert.match(markup, /data-drawer-mark="true" data-logo-image="true"/)
  assert.match(markup, /\[data-menu-footer-logo\] img\{[^}]*object-fit:contain/)
  assert.match(markup, /\[data-drawer-mark\] img\{[^}]*object-fit:contain/)
  assert.doesNotMatch(markup, /\[data-(?:menu-footer-logo|drawer-mark)\] img\{[^}]*object-fit:cover/)
})
