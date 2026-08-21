import assert from 'node:assert/strict'
import test from 'node:test'

import { inspectMenuNavigationContrast } from './menu-navigation-surface-policy'
import { DEFAULT_THEME } from './schema'
import { sanitizeThemeTokens } from './theme-policy'

test('canonical menu navigation palette passes every critical pairing', () => {
  const theme = sanitizeThemeTokens({}, 'default')
  assert.ok(theme)
  assert.deepEqual(inspectMenuNavigationContrast(theme), [])
})

test('menu navigation contrast reports text, active, overlay, filter and focus failures', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.bg = '#ffffff'
  theme.cardColor = '#ffffff'
  theme.mutedTextColor = '#eeeeee'
  theme.accent = '#eeeeee'
  theme.accentSoft = '#ffffff'
  theme.ctaTextColor = '#ffffff'
  theme.catnavOverlayColor = '#ffffff'
  theme.catnavOverlayTextColor = '#eeeeee'

  assert.deepEqual(inspectMenuNavigationContrast(theme).map((issue) => issue.id), [
    'inactive',
    'active-filled',
    'active-soft',
    'active-line',
    'overlay-caption',
    'filter-icon',
    'focus-page',
    'focus-card',
  ])
})

test('navigation sanitizer keeps deprecated fields while bounding live controls', () => {
  const theme = sanitizeThemeTokens({
    catnavAlign: 'spread',
    catnavItemGap: 22,
    catnavFontSize: 18,
    catnavAutoCenter: false,
    catnavEdgeFade: false,
    catnavVisualCardWidth: 999,
    catnavVisualCardHeight: 999,
    catnavOverlayTextAlign: 'right',
    catnavShowIcons: true,
    catnavVisualRadius: 999,
    catnavOverlayOpacity: 999,
    catnavOverlayBlur: 999,
    navTopGap: 999,
    navBottomGap: 999,
  }, 'default')

  assert.equal(theme?.catnavAlign, 'spread')
  assert.equal(theme?.catnavShowIcons, true)
  assert.equal(theme?.catnavVisualRadius, 40)
  assert.equal(theme?.catnavOverlayOpacity, 90)
  assert.equal(theme?.catnavOverlayBlur, 14)
  assert.equal(theme?.navTopGap, 40)
  assert.equal(theme?.navBottomGap, 48)
})
