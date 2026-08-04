import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui/themes'
import {
  buildSectionSettingsResetPatch,
  buildThemeGroupResetPatch,
  buildThemeSettingsClipboardPayload,
} from './theme-editor-property-command-model'

const group: SettingsGroup = {
  id: 'header',
  label: 'Header',
  fields: [
    {
      id: 'headerNameSize',
      label: 'Başlık boyutu',
      type: 'range',
      themeField: 'headerNameSize',
      default: 24,
    },
  ],
}

test('clipboard payload scopes section settings to the selected section', () => {
  const mergedTheme = {
    sectionSettings: {
      gallery: { title: 'Mekan' },
      reviews: { title: 'Yorumlar' },
    },
  } as unknown as GarsonlessTheme

  assert.deepEqual(buildThemeSettingsClipboardPayload({
    selectedSectionId: 'gallery',
    mergedTheme,
    previewTheme: mergedTheme,
    activeGroupData: group,
  }), {
    type: 'section',
    id: 'gallery',
    settings: { title: 'Mekan' },
  })
})

test('clipboard payload projects only active group fields from preview theme', () => {
  const previewTheme = { headerNameSize: 31 } as GarsonlessTheme
  assert.deepEqual(buildThemeSettingsClipboardPayload({
    selectedSectionId: null,
    mergedTheme: previewTheme,
    previewTheme,
    activeGroupData: group,
  }), {
    type: 'group',
    id: 'header',
    settings: { headerNameSize: 31 },
  })
})

test('section reset removes only the selected section settings', () => {
  const theme = {
    sectionSettings: {
      gallery: { title: 'Mekan' },
      reviews: { title: 'Yorumlar' },
    },
  } as unknown as GarsonlessTheme

  assert.deepEqual(buildSectionSettingsResetPatch(theme, 'gallery'), {
    sectionSettings: { reviews: { title: 'Yorumlar' } },
  })
})

test('group reset patch uses defaults only for fields owned by that group', () => {
  const defaults = { headerNameSize: 26, pagePadX: 18 } as unknown as GarsonlessTheme
  assert.deepEqual(buildThemeGroupResetPatch(group, defaults), { headerNameSize: 26 })
})
