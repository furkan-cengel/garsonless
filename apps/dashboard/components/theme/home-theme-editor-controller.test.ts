import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME, type GarsonlessTheme } from '@garsonless/design-engine'
import { createHomeThemeEditorController } from './home-theme-editor-controller'

test('menü bileşeni ana sayfa akışının sonuna eklenir', () => {
  let patch: Partial<GarsonlessTheme> | undefined
  const controller = createHomeThemeEditorController({
    theme: DEFAULT_THEME,
    query: '',
    group: 'Tümü',
    setQuery: () => undefined,
    setGroup: () => undefined,
    openPicker: () => undefined,
    closePicker: () => undefined,
    updateTheme: (next) => { patch = next },
    selectBlock: () => undefined,
    showDesignSurface: () => undefined,
  })

  controller.add('hero-banner')

  assert.deepEqual(patch?.surfaces?.home.blocks?.map((block) => block.sectionId), ['hero-banner'])
})

test('ana sayfa araması aynı Hero Banner ile ek Video Hero bileşenini bulur', () => {
  const controller = createHomeThemeEditorController({
    theme: DEFAULT_THEME,
    query: 'hero',
    group: 'Tümü',
    setQuery: () => undefined,
    setGroup: () => undefined,
    openPicker: () => undefined,
    closePicker: () => undefined,
    updateTheme: () => undefined,
    selectBlock: () => undefined,
    showDesignSurface: () => undefined,
  })

  assert.deepEqual(controller.filteredSections.map((section) => section.id), ['hero-banner', 'storefront-video-hero'])
})
