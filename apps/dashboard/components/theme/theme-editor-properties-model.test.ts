import assert from 'node:assert/strict'
import test from 'node:test'

import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingField } from '@garsonless/ui'
import {
  getAvailableEditorTabs,
  getFieldEditorTab,
  getVisibleThemeFields,
  resolveEffectiveEditorTab,
} from './theme-editor-properties-model'

function field(id: string, themeField: string, type: SettingField['type'] = 'select') {
  return { id, label: id, themeField, type } as SettingField
}

test('property fields are assigned to stable editor tabs', () => {
  assert.equal(getFieldEditorTab(field('headerHeight', 'headerPadY')), 'layout')
  assert.equal(getFieldEditorTab(field('headerShowMenu', 'headerShowMenu')), 'content')
  assert.equal(getFieldEditorTab(field('accent', 'accent', 'color')), 'design')
  assert.deepEqual(
    getAvailableEditorTabs([
      field('headerHeight', 'headerPadY'),
      field('headerShowMenu', 'headerShowMenu'),
      field('accent', 'accent', 'color'),
    ], 'header').map((tab) => tab.id),
    ['design', 'layout', 'content'],
  )
})

test('requested tab falls back to the first available tab', () => {
  assert.equal(resolveEffectiveEditorTab([{ id: 'content' }], 'layout'), 'content')
  assert.equal(resolveEffectiveEditorTab([], 'content'), 'design')
})

test('card fields respect layout and image capability gates', () => {
  const fields = [
    field('cardColumns', 'cardColumns'),
    field('cta', 'cardCtaIcon'),
    field('description', 'cardDescriptionLines'),
  ]
  const theme = {
    cardLayout: 'minimal',
    cardCtaStyle: 'icon',
    cardShowDesc: false,
  } as unknown as GarsonlessTheme
  assert.deepEqual(getVisibleThemeFields(fields, 'cards', theme, 'design'), [])
})

test('footer hides dependent fields while disabled', () => {
  const fields = [
    field('footerEnabled', 'footerEnabled'),
    field('footerShowLogo', 'footerShowLogo'),
    field('footerTone', 'footerTone'),
  ]
  const theme = { footerEnabled: false, footerTone: 'surface' } as unknown as GarsonlessTheme
  assert.deepEqual(
    getVisibleThemeFields(fields, 'footer', theme, 'content').map((item) => item.themeField),
    ['footerEnabled'],
  )
})

test('visual navigation hides pill-only controls and reveals overlay controls only for overlay cards', () => {
  const fields = [
    field('align', 'catnavAlign'),
    field('visual', 'catnavVisualWidth'),
    field('overlay', 'catnavOverlayOpacity'),
  ]
  const cardsTheme = { catnavStyle: 'visual', catnavVisualStyle: 'cards' } as unknown as GarsonlessTheme
  const overlayTheme = { catnavStyle: 'visual', catnavVisualStyle: 'overlay' } as unknown as GarsonlessTheme
  assert.deepEqual(
    getVisibleThemeFields(fields, 'nav', cardsTheme, 'design').map((item) => item.themeField),
    ['catnavVisualWidth'],
  )
  assert.deepEqual(
    getVisibleThemeFields(fields, 'nav', overlayTheme, 'design').map((item) => item.themeField),
    ['catnavVisualWidth', 'catnavOverlayOpacity'],
  )
})
