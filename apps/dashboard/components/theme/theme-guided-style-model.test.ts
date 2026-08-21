import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildThemeFontPairPatch,
  buildThemeTypeScalePatch,
  resolveThemeFontPairPreset,
  resolveThemeTypeScalePreset,
} from './theme-guided-style-model'

test('guided font pairs write only the existing theme font fields', () => {
  assert.deepEqual(buildThemeFontPairPatch('editorial'), { displayFont: 'Fraunces', bodyFont: 'DM Sans' })
  assert.deepEqual(buildThemeFontPairPatch('modern'), { displayFont: 'Manrope', bodyFont: 'Inter' })
  assert.equal(resolveThemeFontPairPreset({ displayFont: 'Fraunces', bodyFont: 'DM Sans' }), 'editorial')
  assert.equal(resolveThemeFontPairPreset({ displayFont: 'Caveat', bodyFont: 'Arial' }), 'custom')
})

test('guided type scales preserve the 148 percent normal value and expose custom states', () => {
  assert.deepEqual(buildThemeTypeScalePatch('normal'), { fs: 15, lh: 148 })
  assert.equal(resolveThemeTypeScalePreset({ fs: 15, lh: 148 }), 'normal')
  assert.equal(resolveThemeTypeScalePreset({ fs: 17, lh: 149 }), 'custom')
})
