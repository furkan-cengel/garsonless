import assert from 'node:assert/strict'
import test from 'node:test'

import {
  contrastRatio,
  deriveSoftColor,
  resolveCartTriggerPatch,
  sanitizePropertyControlId,
} from './theme-property-renderer-model'

test('contrast follows WCAG luminance and fails closed for invalid colors', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21)
  assert.equal(contrastRatio('invalid', '#ffffff'), 1)
  assert.ok(contrastRatio('#777777', '#ffffff') < 4.5)
})

test('soft color mixes a valid accent and falls back for invalid input', () => {
  assert.equal(deriveSoftColor('#000000'), '#e0e0e0')
  assert.equal(deriveSoftColor('invalid'), '#f1f2f3')
})

test('enabling header cart disables footer cart', () => {
  assert.deepEqual(resolveCartTriggerPatch({ fieldId: 'cartHeaderTriggerStyle', value: 'icon', headerStyle: 'none', footerStyle: 'pill' }), {
    cartHeaderTriggerStyle: 'icon',
    cartFooterTriggerStyle: 'none',
  })
})

test('disabling the only footer cart restores a reachable header trigger', () => {
  assert.deepEqual(resolveCartTriggerPatch({ fieldId: 'cartFooterTriggerStyle', value: 'none', headerStyle: 'none', footerStyle: 'pill' }), {
    cartFooterTriggerStyle: 'none',
    cartHeaderTriggerStyle: 'icon',
  })
})

test('unrelated fields do not produce a cart patch and ids are safe', () => {
  assert.equal(resolveCartTriggerPatch({ fieldId: 'cartIcon', value: 'bag', headerStyle: 'icon', footerStyle: 'none' }), null)
  assert.equal(sanitizePropertyControlId('Header boşluk / px'), 'Header-bo-luk---px')
})
