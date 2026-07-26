import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveComboPriceOverrides, type ComboCatalogItem } from './combo-order-pricing'

const catalog: ComboCatalogItem[] = [
  { id: 'coffee', price: 120, position: 1, is_available: true },
  { id: 'cake', price: 180, position: 2, is_available: true },
  { id: 'tea', price: 80, position: 3, is_available: true },
]

const tokens = {
  pageBlocks: [{ type: 'section', id: 'combo-home', sectionId: 'combo-ribbon' }],
  sectionSettings: {
    'combo-home': {
      selectionMode: 'manual',
      comboCount: '1',
      itemsPerCombo: '2',
      combo1Item1Id: 'coffee',
      combo1Item2Id: 'cake',
      combo1Price: '200',
    },
  },
}

function comboLine(itemId: string, instanceId = 'bundle-click-1') {
  return {
    itemId,
    quantity: 1,
    combo: { instanceId, sectionInstanceId: 'combo-home', comboIndex: 1 },
  }
}

test('published special price is allocated exactly across verified combo lines', () => {
  const result = resolveComboPriceOverrides({ lines: [comboLine('coffee'), comboLine('cake')], tokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal([...result.pricesByLine.values()].reduce((sum, price) => sum + price, 0), 200)
  assert.deepEqual([...result.pricesByLine.values()], [80, 120])
  assert.equal(result.loyaltyStackingAllowed, true)
})

test('catalog total remains authoritative when no special price is published', () => {
  const plainTokens = structuredClone(tokens)
  delete (plainTokens.sectionSettings['combo-home'] as { combo1Price?: string }).combo1Price
  const result = resolveComboPriceOverrides({ lines: [comboLine('coffee'), comboLine('cake')], tokens: plainTokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal([...result.pricesByLine.values()].reduce((sum, price) => sum + price, 0), 300)
  assert.equal(result.loyaltyStackingAllowed, true)
})

test('published non-stackable promotional combo suppresses loyalty for the order', () => {
  const exclusiveTokens = structuredClone(tokens)
  ;(exclusiveTokens.sectionSettings['combo-home'] as Record<string, unknown>).combo1DiscountPolicy = 'combo-only'
  const result = resolveComboPriceOverrides({ lines: [comboLine('coffee'), comboLine('cake')], tokens: exclusiveTokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.loyaltyStackingAllowed, false)
})

test('non-stackable policy does not suppress loyalty without a promotional price', () => {
  const fullPriceTokens = structuredClone(tokens)
  const settings = fullPriceTokens.sectionSettings['combo-home'] as Record<string, unknown>
  settings.combo1Price = '300'
  settings.combo1DiscountPolicy = 'combo-only'
  const result = resolveComboPriceOverrides({ lines: [comboLine('coffee'), comboLine('cake')], tokens: fullPriceTokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.loyaltyStackingAllowed, true)
})

test('invented membership and unpublished section instances fail closed', () => {
  const altered = resolveComboPriceOverrides({ lines: [comboLine('coffee'), comboLine('tea')], tokens, catalogItems: catalog })
  assert.equal(altered.ok, false)

  const unpublishedLines = [comboLine('coffee'), comboLine('cake')].map((line) => ({
    ...line,
    combo: { ...line.combo, sectionInstanceId: 'not-published' },
  }))
  const unpublished = resolveComboPriceOverrides({ lines: unpublishedLines, tokens, catalogItems: catalog })
  assert.equal(unpublished.ok, false)
})

test('all combo lines must share quantity and one click instance', () => {
  const result = resolveComboPriceOverrides({
    lines: [comboLine('coffee'), { ...comboLine('cake'), quantity: 2 }],
    tokens,
    catalogItems: catalog,
  })
  assert.equal(result.ok, false)
})
