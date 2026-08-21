import assert from 'node:assert/strict'
import test from 'node:test'

import { inspectMenuCardSurfaceContrast } from './menu-card-surface-policy'
import { DEFAULT_THEME } from './schema'
import { sanitizeThemeTokens } from './theme-policy'

test('canonical menu card palette passes every critical pairing', () => {
  const theme = sanitizeThemeTokens({}, 'default')
  assert.ok(theme)
  assert.deepEqual(inspectMenuCardSurfaceContrast(theme), [])
})

test('menu card contrast reports text, CTA, promotion and focus failures', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.bg = '#ffffff'
  theme.cardColor = '#ffffff'
  theme.textColor = '#eeeeee'
  theme.mutedTextColor = '#eeeeee'
  theme.accent = '#eeeeee'
  theme.cta = '#ffffff'
  theme.ctaTextColor = '#eeeeee'

  assert.deepEqual(inspectMenuCardSurfaceContrast(theme).map((issue) => issue.id), [
    'title',
    'primary-text',
    'secondary-text',
    'cta',
    'promotion',
    'focus-card',
    'focus-page',
  ])
})

test('sanitizer preserves bounded card-only surface overrides without changing legacy globals', () => {
  const sanitized = sanitizeThemeTokens({
    radius: 18,
    shadow: 'hard',
    border: 'solid',
    cardRadius: 999,
    cardShadow: 'none',
    cardBorder: 'hair',
  }, 'default')

  assert.equal(sanitized?.radius, 18)
  assert.equal(sanitized?.shadow, 'hard')
  assert.equal(sanitized?.border, 'solid')
  assert.equal(sanitized?.cardRadius, 28)
  assert.equal(sanitized?.cardShadow, 'none')
  assert.equal(sanitized?.cardBorder, 'hair')
})
