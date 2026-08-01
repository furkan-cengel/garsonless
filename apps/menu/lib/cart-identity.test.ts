import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_CART_ITEM_QUANTITY,
  canonicalModifierSignature,
  canonicalRemovalSignature,
  clampCartQuantity,
} from './store/cartIdentity.ts'

test('cart modifier identity is independent from selection order', () => {
  const first = [
    { group_id: 'size', option_id: 'large' },
    { group_id: 'extras', option_id: 'cheese', quantity: 2 },
  ]
  assert.equal(canonicalModifierSignature(first), canonicalModifierSignature([...first].reverse()))
})

test('removal identity is sorted and duplicate-safe', () => {
  assert.equal(canonicalRemovalSignature(['b', 'a', 'a']), canonicalRemovalSignature(['a', 'b']))
})

test('cart quantities share the server limit', () => {
  assert.equal(clampCartQuantity(120), MAX_CART_ITEM_QUANTITY)
  assert.equal(clampCartQuantity(-1), 0)
  assert.equal(clampCartQuantity(4.6), 5)
})
