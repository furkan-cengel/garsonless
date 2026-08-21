import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
const panels = readFileSync(new URL('./ThemePropertyPanels.tsx', import.meta.url), 'utf8')
const footerPanel = readFileSync(new URL('./FooterPropertyPanel.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')
const footer = readFileSync(new URL('../../../../packages/ui/src/menu/MenuFooter.tsx', import.meta.url), 'utf8')

test('footer contrast blocks client and server publishing and exposes local repair', () => {
  assert.match(lifecycle, /inspectMenuFooterContrast\(previewTheme\)/)
  assert.match(lifecycle, /menuFooterContrastIssues\.length > 0/)
  assert.match(actions, /inspectMenuFooterContrast\(sanitizedDraft\)/)
  assert.match(client, /buildMenuFooterContrastRepairPatch\(previewTheme\)/)
  assert.match(client, /Footer tonunu güvenli hale getir/)
})

test('footer editor reports real store readiness and links to canonical store settings', () => {
  assert.match(client, /resolveFooterStoreDataAvailability\(restaurantSettings\)/)
  assert.match(client, /settings\?section=store/)
  assert.match(panels, /FooterPropertyPanel/)
  assert.match(footerPanel, /Footer mağaza verisi durumu/)
  assert.match(footerPanel, /İşletme alanı kapatılsa bile Masabu imzası görünür kalır/)
  assert.match(footerPanel, /Telefon, e-posta ve web sitesi bağlantılarını gösterir/)
})

test('footer uses shared cart clearance and compact 44px interaction targets', () => {
  assert.match(footer, /resolveFooterCartClearance\(theme\)/)
  assert.doesNotMatch(footer, /calc\(96px \+ env/)
  assert.match(footer, /\[data-menu-footer-social\] a\{width:44px;height:44px/)
  assert.match(footer, /@media\(hover:hover\) and \(pointer:fine\)/)
})
