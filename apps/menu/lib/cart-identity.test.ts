import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_CART_ITEM_QUANTITY,
  canonicalModifierSignature,
  canonicalRemovalSignature,
  clampCartQuantity,
  normalizeCartQuantityForStep,
  restoreCartItemAfterPromotion,
} from './store/cartIdentity.ts'
import type { CartItem } from '@garsonless/ui/menu'

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

test('multi-buy quantities are always complete packs', () => {
  assert.equal(normalizeCartQuantityForStep(0, 2), 0)
  assert.equal(normalizeCartQuantityForStep(1, 2), 2)
  assert.equal(normalizeCartQuantityForStep(2, 2), 2)
  assert.equal(normalizeCartQuantityForStep(3, 2), 4)
  assert.equal(normalizeCartQuantityForStep(5, 2), 6)
  assert.equal(normalizeCartQuantityForStep(99, 2), 98)
})

test('a removed campaign restores the ordinary catalogue line', () => {
  const promotedLine: CartItem = {
    cartId: 'line-1',
    itemId: 'tiramisu',
    name: 'Tiramisu',
    price: 97.5,
    originalPrice: 195,
    quantity: 2,
    modifiers: [],
    modifiersPriceDelta: 0,
    modifierNames: [],
    removedIngredientIds: [],
    removedIngredientNames: [],
    energyKcal: null,
    imageUrl: null,
    promotion: { sectionInstanceId: 'slider-home', kind: 'promo-slider', quantityStep: 2 },
  }

  const restored = restoreCartItemAfterPromotion(promotedLine, 195)
  assert.equal(restored.price, 195)
  assert.equal(restored.quantity, 2)
  assert.equal(restored.promotion, undefined)
  assert.equal(restored.originalPrice, undefined)
})
