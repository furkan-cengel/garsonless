import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingsGroup } from '@garsonless/ui/themes'
import {
  appendHistorySnapshot,
  areThemeOverridesEqual,
  createThemeOverrides,
  getUnsavedFieldLabels,
  isContinuousThemeHistoryControl,
  shouldAppendHistoryForGroup,
} from './theme-editor-lifecycle-model'

const schema = [{
  id: 'appearance',
  label: 'Görünüm',
  fields: [
    { id: 'accent', label: 'Vurgu', type: 'color', themeField: 'accentColor' },
    { id: 'accent-copy', label: 'Vurgu', type: 'color', themeField: 'accentColor' },
    { id: 'surface', label: 'Yüzey', type: 'color', themeField: 'surfaceColor' },
  ],
}] as unknown as SettingsGroup[]

function theme(values: Record<string, unknown>): GarsonlessTheme {
  return values as unknown as GarsonlessTheme
}

test('initial override projection keeps changed fields and structural editor state', () => {
  const defaults = theme({ accentColor: '#000000', surfaceColor: '#ffffff' })
  const initial = theme({
    accentColor: '#23814f',
    surfaceColor: '#ffffff',
    sections: ['promo-strip'],
    pageBlocks: [{ type: 'section', id: 'promo-strip' }],
    sectionSettings: { 'promo-strip': { text: 'Merhaba' } },
  })

  assert.deepEqual(createThemeOverrides(initial, defaults, schema), {
    accentColor: '#23814f',
    sections: ['promo-strip'],
    pageBlocks: [{ type: 'section', id: 'promo-strip' }],
    sectionSettings: { 'promo-strip': { text: 'Merhaba' } },
  })
})

test('history snapshots stay bounded and preserve chronological order', () => {
  const history = Array.from({ length: 25 }, (_, index) => index)
  assert.deepEqual(appendHistorySnapshot(history, 25), Array.from({ length: 25 }, (_, index) => index + 1))
  assert.deepEqual(appendHistorySnapshot(history, 25, 0), [])
})

test('one continuous control edit creates one undo checkpoint', () => {
  assert.equal(shouldAppendHistoryForGroup(null, 'home-background:1'), true)
  assert.equal(shouldAppendHistoryForGroup('home-background:1', 'home-background:1'), false)
  assert.equal(shouldAppendHistoryForGroup('home-background:1', 'home-background:2'), true)
  assert.equal(shouldAppendHistoryForGroup('home-background:2', null), true)
})

test('text, color, range and slider controls group changes while discrete selectors do not', () => {
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'input', inputType: 'text' }), true)
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'input', inputType: 'color' }), true)
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'input', inputType: 'range' }), true)
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'textarea' }), true)
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'div', role: 'slider' }), true)
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'select' }), false)
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'input', inputType: 'checkbox' }), false)
  assert.equal(isContinuousThemeHistoryControl({ tagName: 'button' }), false)
})

test('undo can distinguish the exact saved override snapshot from a dirty one', () => {
  const saved = { accentColor: '#23814f', surfaces: { home: { enabled: false } } } as unknown as Partial<GarsonlessTheme>
  const unchanged = { accentColor: '#23814f', surfaces: { home: { enabled: false } } } as unknown as Partial<GarsonlessTheme>
  const dirty = { accentColor: '#23814f', surfaces: { home: { enabled: true } } } as unknown as Partial<GarsonlessTheme>

  assert.equal(areThemeOverridesEqual(saved, unchanged), true)
  assert.equal(areThemeOverridesEqual(saved, dirty), false)
})

test('dirty field labels compare against the saved baseline and stay unique', () => {
  const baseline = theme({ accentColor: '#000000', surfaceColor: '#ffffff' })
  const current = theme({ accentColor: '#23814f', surfaceColor: '#ffffff' })

  assert.deepEqual(getUnsavedFieldLabels(false, schema, current, baseline), [])
  assert.deepEqual(getUnsavedFieldLabels(true, schema, current, baseline), ['Vurgu'])
})
