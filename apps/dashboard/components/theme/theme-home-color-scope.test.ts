import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')
const settings = readFileSync(new URL('./ThemeSectionSettings.tsx', import.meta.url), 'utf8')
const registry = readFileSync(new URL('./theme-editor-section-registry.ts', import.meta.url), 'utf8')

test('home-wide colors live in their own root selection instead of every section card', () => {
  assert.match(panel, /__home-style/)
  assert.match(panel, /Ana sayfa stili/)
  assert.match(panel, /Zemin, metin ve ortak renkler/)
  assert.doesNotMatch(panel, /function SurfaceOverrideFields/)
  assert.match(panel, /selectedSectionId === '__home-style'/)
})

test('home style exposes semantic groups, source labels, reset and contrast status', () => {
  assert.match(panel, /Zeminler/)
  assert.match(panel, /Metinler/)
  assert.match(panel, /Vurgular/)
  assert.match(panel, /Aksiyonlar/)
  assert.match(panel, /Ortak temadan/)
  assert.match(panel, /Ana sayfaya özel/)
  assert.match(panel, /Ortak temaya dön/)
  assert.match(panel, /inspectHomeSurfaceContrast/)
  assert.match(panel, /historyGroup/)
  assert.match(panel, /beginHistoryGroup/)
})

test('standard section colors advertise inheritance while creative palettes stay local', () => {
  assert.match(registry, /sectionBgColor[^\n]+inheritToken: 'surface'/)
  assert.match(registry, /cardBgColor[^\n]+inheritToken: 'surface'/)
  assert.match(registry, /buttonTextColor[^\n]+inheritToken: 'ctaText'/)
  assert.match(settings, /Ana sayfa stilinden/)
  assert.match(settings, /Ana sayfa stiline dön/)
  assert.match(settings, /Bölüme özel palet/)
})

test('homepage Header and Footer expose inherited global settings with local override status', () => {
  assert.match(panel, /homeState\.home\.chrome\?\.header/)
  assert.match(panel, /homeState\.home\.chrome\?\.footer/)
  assert.match(panel, /Ortak temel görünüm · 0px alt boşluk/)
  assert.match(panel, /Ana sayfaya özel ayarlar/)
})
