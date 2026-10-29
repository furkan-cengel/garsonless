import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import { applyGarsonlessTheme, resolveThemeFontFamily } from './apply'

test('self-hosted theme fonts resolve to their loaded font variables', () => {
  assert.equal(resolveThemeFontFamily('DM Sans', 'sans-serif'), 'var(--font-dm-sans)')
  assert.equal(resolveThemeFontFamily('Fraunces', 'serif'), 'var(--font-fraunces)')
})

test('system fonts pass through and unknown fonts use the generic fallback', () => {
  assert.equal(resolveThemeFontFamily('Georgia', 'sans-serif'), 'Georgia')
  assert.equal(resolveThemeFontFamily('Unknown Font', 'sans-serif'), 'sans-serif')
  assert.equal(resolveThemeFontFamily('Unknown Font', 'serif'), 'serif')
})

test('root theme CSS uses the same font resolution as surface overrides', () => {
  const css = applyGarsonlessTheme({ ...DEFAULT_THEME, bodyFont: 'DM Sans', displayFont: 'Fraunces' })
  assert.match(css, /--p-body: var\(--font-dm-sans\);/)
  assert.match(css, /--p-display: var\(--font-fraunces\);/)
})
