import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import { buildMenuThemeContrastRepairPatch, inspectMenuThemeContrast } from './menu-theme-surface-policy'

test('canonical shared menu palette satisfies its semantic contrast contract', () => {
  assert.deepEqual(inspectMenuThemeContrast(DEFAULT_THEME), [])
})

test('shared menu palette reports text, accent, CTA, focus and active border failures', () => {
  const unsafe = {
    ...DEFAULT_THEME,
    bg: '#ffffff',
    cardColor: '#ffffff',
    textColor: '#eeeeee',
    mutedTextColor: '#dddddd',
    accent: '#eeeeee',
    accentSoft: '#ffffff',
    cta: '#eeeeee',
    ctaTextColor: '#ffffff',
    border: 'solid' as const,
    borderColor: '#eeeeee',
  }
  assert.deepEqual(inspectMenuThemeContrast(unsafe).map((issue) => issue.id), [
    'text-page', 'text-surface', 'muted-page', 'muted-surface',
    'accent-page', 'accent-surface', 'accent-soft', 'cta',
    'focus-page', 'focus-surface', 'border-page', 'border-surface',
  ])
})

test('safe repair preserves surfaces and produces a publishable shared palette', () => {
  const unsafe = {
    ...DEFAULT_THEME,
    bg: '#f8f9f8',
    cardColor: '#ffffff',
    accent: '#38a169',
    accentSoft: '#e8f5ee',
    cta: '#38a169',
    ctaTextColor: '#ffffff',
  }
  const patch = buildMenuThemeContrastRepairPatch(unsafe)
  const repaired = { ...unsafe, ...patch }
  assert.equal(repaired.bg, unsafe.bg)
  assert.equal(repaired.cardColor, unsafe.cardColor)
  assert.equal(repaired.cta, unsafe.cta)
  assert.deepEqual(inspectMenuThemeContrast(repaired), [])
})
