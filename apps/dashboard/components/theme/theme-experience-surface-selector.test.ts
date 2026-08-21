import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./ThemeExperienceSurfaceSelector.tsx', import.meta.url), 'utf8')
const stateSource = readFileSync(new URL('./use-theme-experience-surface.ts', import.meta.url), 'utf8')

test('trigger and opened options share one neutral icon and label treatment', () => {
  assert.match(source, /id: 'menu'[\s\S]*?icon: I\.menuDish/)
  assert.match(source, /<ActiveIcon className=\{`theme-surface-icon/)
  assert.match(source, /<Icon className=\{`theme-surface-icon/)
  assert.match(source, /data-theme-surface-option/)
  assert.match(source, /\[data-theme-surface-option\]\[data-selected\]/)
  assert.match(source, /<ActiveIcon className=\{`theme-surface-icon\$\{active\.id === 'menu' \? ' theme-surface-menu-dish'/)
  assert.match(source, /<Icon className=\{`theme-surface-icon\$\{surface\.id === 'menu' \? ' theme-surface-menu-dish'/)
  assert.match(source, /\.theme-surface-menu-dish path[\s\S]*?stroke-width: 28/)
  assert.match(source, /\[data-theme-surface-option\]:hover[\s\S]*?background: var\(--surface-3\) !important/)
  assert.match(source, /\[data-theme-surface-trigger\]:hover[\s\S]*?background: var\(--surface-3\) !important/)
  assert.doesNotMatch(source, /I\.cutlery|theme-surface-menu-icon|stroke-width: 90/)
  assert.match(source, /id: 'account'[\s\S]*label: 'Masabu Hesabım'/)
  assert.match(stateSource, /'home', 'menu', 'auth', 'account', 'checkout'/)
  assert.match(stateSource, /useState<AccountPreviewState>\('overview'\)/)
})

test('preview navigasyonundan gelen mevcut yüzey tekrar router navigasyonu üretmez', () => {
  assert.match(stateSource, /if \(next === surface\) return/)
  assert.match(stateSource, /params\.set\('surface', next\)/)
})
