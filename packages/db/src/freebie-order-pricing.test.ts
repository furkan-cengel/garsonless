import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFreebiePriceOverrides } from './freebie-order-pricing'

const tokens = {
  pageBlocks: [{ type: 'section', id: 'slider-home', sectionId: 'promo-slider' }],
  sectionSettings: { 'slider-home': { sourceMode: 'manual', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake' } },
}
const catalog = [
  { id: 'latte', category_id: 'coffee', price: 120, is_available: true },
  { id: 'cake', category_id: 'dessert', price: 195, is_available: true },
  { id: 'burger', category_id: 'food', price: 300, is_available: true },
]
const pair = (quantity = 1) => [
  { itemId: 'latte', quantity, promotion: { sectionInstanceId: 'slider-home', kind: 'promo-slider' as const, offer: 'freebie' as const, instanceId: 'pair-1', role: 'qualifier' as const } },
  { itemId: 'cake', quantity, promotion: { sectionInstanceId: 'slider-home', kind: 'promo-slider' as const, offer: 'freebie' as const, instanceId: 'pair-1', role: 'reward' as const } },
]

test('server prices only the configured reward base at zero', () => {
  const result = resolveFreebiePriceOverrides({ lines: pair(2), tokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.pricesByLine.get(0), 120)
  assert.equal(result.pricesByLine.get(1), 0)
  assert.deepEqual([...result.rewardLineIndexes], [1])
})

test('server rejects forged rewards, mismatched quantities and incomplete groups', () => {
  assert.equal(resolveFreebiePriceOverrides({ lines: [{ ...pair()[0]!, itemId: 'burger' }, pair()[1]!], tokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveFreebiePriceOverrides({ lines: [pair(2)[0]!, pair(1)[1]!], tokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveFreebiePriceOverrides({ lines: [pair()[1]!], tokens, catalogItems: catalog }).ok, false)
})

test('server rejects a reward that also belongs to the qualifier category', () => {
  const invalidTokens = {
    ...tokens,
    sectionSettings: {
      'slider-home': {
        ...tokens.sectionSettings['slider-home'],
      },
    },
  }
  const result = resolveFreebiePriceOverrides({
    lines: pair(),
    tokens: invalidTokens,
    catalogItems: [
      { id: 'latte', category_id: 'coffee', price: 120, is_available: true },
      { id: 'cake', category_id: 'coffee', price: 90, is_available: true },
    ],
  })
  assert.equal(result.ok, false)
})
