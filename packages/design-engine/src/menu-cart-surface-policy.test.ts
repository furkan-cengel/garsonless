import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import {
  buildMenuCartContrastRepairPatch,
  inspectMenuCartContrast,
  resolveReadableMenuForeground,
} from './menu-cart-surface-policy'

test('cart inspector covers triggers, CTA, badge and focus surfaces', () => {
  const unsafe = { ...DEFAULT_THEME, accent: '#eeeeee', cta: '#eeeeee', ctaTextColor: '#ffffff' }
  const issues = inspectMenuCartContrast(unsafe)
  assert.ok(issues.some((issue) => issue.id === 'cta'))
  assert.ok(issues.some((issue) => issue.id === 'badge'))
  assert.ok(issues.some((issue) => issue.id === 'focus-page'))
})

test('cart repair preserves brand surfaces while fixing shared palette pairs', () => {
  const theme = { ...DEFAULT_THEME, cta: '#eeeeee', ctaTextColor: '#ffffff' }
  const patch = buildMenuCartContrastRepairPatch(theme)
  assert.equal(patch.cta, undefined)
  assert.notEqual(patch.ctaTextColor, '#ffffff')
  assert.equal(inspectMenuCartContrast({ ...theme, ...patch }).length, 0)
})

test('dynamic dark and brand trigger foregrounds are deterministic', () => {
  assert.equal(resolveReadableMenuForeground('#111111'), '#ffffff')
  assert.equal(resolveReadableMenuForeground('#f4f4f4'), '#111111')
})
