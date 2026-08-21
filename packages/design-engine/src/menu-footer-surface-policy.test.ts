import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_THEME } from './schema'
import {
  buildMenuFooterContrastRepairPatch,
  inspectMenuFooterContrast,
  resolveMenuFooterPalette,
} from './menu-footer-surface-policy'

test('canonical surface, brand and dark footer presets pass every critical pairing', () => {
  for (const footerTone of ['surface', 'brand', 'dark'] as const) {
    assert.deepEqual(inspectMenuFooterContrast({ ...DEFAULT_THEME, footerTone }), [])
  }
})

test('surface footer reports unsafe inherited text and muted colors', () => {
  const theme = {
    ...DEFAULT_THEME,
    footerTone: 'surface' as const,
    cardColor: '#ffffff',
    textColor: '#eeeeee',
    mutedTextColor: '#eeeeee',
  }
  const ids = inspectMenuFooterContrast(theme).map((issue) => issue.id)
  assert.ok(ids.includes('primary-text'))
  assert.ok(ids.includes('secondary-text'))
  assert.ok(ids.includes('contact-text'))
})

test('footer repair changes only the tone and resolves an unsafe inherited surface', () => {
  const theme = {
    ...DEFAULT_THEME,
    footerTone: 'surface' as const,
    cardColor: '#ffffff',
    textColor: '#eeeeee',
    mutedTextColor: '#eeeeee',
  }
  const patch = buildMenuFooterContrastRepairPatch(theme)
  assert.deepEqual(Object.keys(patch), ['footerTone'])
  assert.equal(patch.footerTone, 'dark')
  assert.deepEqual(inspectMenuFooterContrast({ ...theme, ...patch }), [])
})

test('derived footer boundaries and focus tokens are concrete safe colors', () => {
  const palette = resolveMenuFooterPalette({ ...DEFAULT_THEME, footerTone: 'brand' })
  for (const value of Object.values(palette)) assert.match(value, /^#[0-9a-f]{6}$/i)
})
