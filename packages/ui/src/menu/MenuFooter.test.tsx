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
  assert.match(markup, /href="mailto:hello@example.com"/)
  assert.match(markup, /href="https:\/\/example.com\/"/)
  assert.match(markup, /aria-label="Instagram"/)
  assert.match(markup, /href="https:\/\/wa.me\/905320000000"/)
  assert.match(markup, new RegExp(`© ${new Date().getFullYear()} · Çok Uzun Restoran Adı`))
  assert.doesNotMatch(markup, /henüz eklenmedi|bilgi girilmedi/i)
})

test('footer omits unavailable groups and can be disabled globally', () => {
  const emptyMarkup = renderFooter(DEFAULT_THEME, { contact: {} })
  assert.match(emptyMarkup, /Çok Uzun Restoran Adı/)
  assert.doesNotMatch(
    emptyMarkup,
    /data-menu-footer-(?:contact|social|address)="true"/,
  )

  const disabledMarkup = renderFooter({ ...DEFAULT_THEME, footerEnabled: false })
  assert.equal(disabledMarkup, '')
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
