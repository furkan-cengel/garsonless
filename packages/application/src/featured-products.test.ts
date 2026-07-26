import assert from 'node:assert/strict'
import test from 'node:test'

import {
  rankFeaturedProducts,
  readFeaturedProductRanking,
  selectFeaturedProductRanking,
} from './featured-products'

const order = (items: unknown, status = 'new') => ({ status, items })

test('featured products rank by ordered quantity and ignore cancelled or malformed lines', () => {
  const result = rankFeaturedProducts([
    order([{ itemId: 'coffee', quantity: 2, price: 100 }, { item_id: 'cake', qty: 1, price: 250 }]),
    order([{ itemId: 'coffee', quantity: 1, price: 100 }]),
    order([{ itemId: 'cake', quantity: 10, price: 250 }], 'cancelled'),
    order([{ quantity: 20 }, null]),
  ])

  assert.equal(result.source, 'today')
  assert.deepEqual(result.productIds, ['coffee', 'cake'])
  assert.deepEqual(result.quantities, { coffee: 3, cake: 1 })
})

test('featured products use the previous restaurant day only when today has no sales', () => {
  const previousFallback = selectFeaturedProductRanking({
    today: [],
    previousDay: [order([{ itemId: 'yesterday-winner', quantity: 4, price: 80 }])],
  })
  assert.equal(previousFallback.source, 'previous-day')
  assert.deepEqual(previousFallback.productIds, ['yesterday-winner'])

  const todayWins = selectFeaturedProductRanking({
    today: [order([{ itemId: 'today-winner', quantity: 1, price: 50 }])],
    previousDay: [order([{ itemId: 'yesterday-winner', quantity: 99, price: 80 }])],
  })
  assert.equal(todayWins.source, 'today')
  assert.deepEqual(todayWins.productIds, ['today-winner'])
})

test('featured products return catalog fallback when neither day has usable sales', async () => {
  const result = await readFeaturedProductRanking({
    restaurantId: 'restaurant-1',
    timeZone: 'Europe/Istanbul',
    now: new Date('2026-07-25T10:00:00.000Z'),
  }, {
    async readSalesWindows(input) {
      assert.equal(input.restaurantId, 'restaurant-1')
      assert.equal(input.timeZone, 'Europe/Istanbul')
      return { ok: true, value: { today: [], previousDay: [] } }
    },
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.source, 'catalog')
    assert.deepEqual(result.value.productIds, [])
  }
})
