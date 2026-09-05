import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const lifecycle = readFileSync(new URL('./use-theme-editor-lifecycle.ts', import.meta.url), 'utf8')
const guidance = readFileSync(new URL('./use-theme-publish-guidance.ts', import.meta.url), 'utf8')
const properties = readFileSync(new URL('./ThemeEditorPropertiesWorkspace.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('./ThemeEditorClient.tsx', import.meta.url), 'utf8')
const propertyModel = readFileSync(new URL('./theme-editor-properties-model.ts', import.meta.url), 'utf8')

test('Menu Header contrast issues are visible and block unsafe publishing', () => {
  assert.match(lifecycle, /inspectThemePublishContrast\(previewTheme\)/)
  assert.match(lifecycle, /Object\.values\(publishContrast\)\.flat\(\)\[0\]/)
  assert.match(guidance, /Menü Header kritik kontrast sorunlarını düzelt/)
  assert.match(guidance, /setExperienceSurface\('menu'\)/)
  assert.match(properties, /Kontrast sorunu:/)
  assert.match(properties, /Tüm kontrast sorunları/)
  assert.match(client, /Header renklerini güvenli hale getir/)
  assert.match(client, /buildMenuHeaderContrastRepairPatch\(previewTheme\)/)
  assert.match(propertyModel, /if \(field\.type === 'color'\) return 'design'/)
  assert.match(properties, /!activeGroup\.startsWith\("header"\)/)
})
