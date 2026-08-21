import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const guidance = readFileSync(new URL('./use-theme-publish-guidance.ts', import.meta.url), 'utf8')
const panels = readFileSync(new URL('./ThemePropertyPanels.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../../../../packages/ui/src/themes/default/settings.ts', import.meta.url), 'utf8')

test('navigation schema exposes presets and removes deprecated micro controls', () => {
  const navSchema = settings.slice(settings.indexOf("id: 'nav'"), settings.indexOf("id: 'header'"))
  for (const label of ['Hap', 'Görselli', 'Alt Çizgi', 'Sekmeli', 'Nokta', 'Çerçeveli']) {
    assert.match(navSchema, new RegExp(`label: '${label}'`))
  }
  for (const id of ['catnavAlign', 'catnavItemGap', 'catnavFontSize', 'catnavAutoCenter', 'catnavEdgeFade', 'catnavVisualCardWidth', 'catnavVisualCardHeight', 'catnavOverlayTextAlign']) {
    assert.doesNotMatch(navSchema, new RegExp(`id: '${id}'`))
    assert.doesNotMatch(panels, new RegExp(`"${id}"`))
  }
})

test('navigation contrast blocks both publish layers and offers safe repair', () => {
  assert.match(lifecycle, /inspectMenuNavigationContrast\(previewTheme\)/)
  assert.match(lifecycle, /menuNavigationContrastIssues\.length > 0/)
  assert.match(actions, /inspectMenuNavigationContrast\(sanitizedDraft\)/)
  assert.match(guidance, /Menü navigasyonu kritik kontrast sorunlarını düzelt/)
  assert.match(client, /Navigasyon paletini güvenli hale getir/)
})
