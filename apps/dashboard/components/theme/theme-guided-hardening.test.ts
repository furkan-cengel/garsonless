import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panels = readFileSync(new URL('./ThemePropertyPanels.tsx', import.meta.url), 'utf8')
const controls = readFileSync(new URL('./ThemePropertyControls.tsx', import.meta.url), 'utf8')
const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/theme.ts', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../../../../packages/ui/src/themes/default/settings.ts', import.meta.url), 'utf8')

test('guided theme panel exposes semantic colors, safe repair and advanced controls', () => {
  assert.match(panels, /Rehberli renkler/)
  assert.match(panels, /Gelişmiş renkler/)
  assert.match(panels, /Paleti güvenli hale getir/)
  assert.match(panels, /role="alert"/)
  assert.match(panels, /role="status"/)
  assert.match(controls, /issueLabels/)
  assert.match(controls, /size-11 cursor-pointer/)
})

test('font pairs and scale presets keep individual fields behind advanced typography', () => {
  assert.match(panels, /Font eşleşmesi/)
  assert.match(panels, /Yazı ölçeği/)
  assert.match(panels, /Gelişmiş tipografi/)
  assert.match(panels, /Özel\/eski font/)
  assert.match(settings, /id: 'lh'.*step: 1/)
})

test('shared theme contrast blocks client and server publishing and uses one repair builder', () => {
  assert.match(lifecycle, /inspectMenuThemeContrast\(previewTheme\)/)
  assert.match(actions, /inspectMenuThemeContrast\(sanitizedDraft\)/)
  assert.match(client, /buildMenuThemeContrastRepairPatch\(previewTheme\)/)
  assert.match(client, /themeContrastIssues=\{menuThemeContrastIssues\}/)
})
