import assert from 'node:assert/strict'
import test from 'node:test'

import type { CartItem } from '@garsonless/ui/menu'
import {
  buildCatalogCartQuantityByItemId,
  participatesInAutomaticProductCampaign,
} from './cart-quantity-projection.ts'

function line(overrides: Partial<CartItem>): CartItem {
  return {
    cartId: 'cart-line',
    itemId: 'campaign-product',
    name: 'Ürün',
    price: 100,
    quantity: 1,
    modifiers: [],
    modifiersPriceDelta: 0,
    modifierNames: [],
    removedIngredientIds: [],
    removedIngredientNames: [],
    energyKcal: null,
    imageUrl: null,
    ...overrides,
  }
}

test('recommendation lines do not activate the ordinary product card quantity', () => {
  const quantities = buildCatalogCartQuantityByItemId([
    line({ cartId: 'recommendation', quantity: 1, recommendationSourceItemId: 'source-product' }),
    line({ cartId: 'ordinary', quantity: 2 }),
    line({ cartId: 'combo', quantity: 3, combo: { instanceId: 'combo', sectionInstanceId: 'section', comboIndex: 0 } }),
  ])

  assert.equal(quantities.get('campaign-product'), 2)
})

test('a recommendation-only product remains absent from catalogue card quantities', () => {
  const quantities = buildCatalogCartQuantityByItemId([
    line({ recommendationSourceItemId: 'source-product' }),
  ])

  assert.equal(quantities.has('campaign-product'), false)
})

test('recommendations and combos are outside automatic product campaigns', () => {
  assert.equal(participatesInAutomaticProductCampaign({}), true)
  assert.equal(participatesInAutomaticProductCampaign({ recommendationSourceItemId: 'source-product' }), false)
  assert.equal(participatesInAutomaticProductCampaign({ combo: { instanceId: 'combo', sectionInstanceId: 'section', comboIndex: 0 } }), false)
})
