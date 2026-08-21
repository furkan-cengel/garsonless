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

test('manual promo slider combo is verified from published products and fixed price', () => {
  const sliderTokens = {
    pageBlocks: [{ type: 'section', id: 'slider-home', sectionId: 'promo-slider' }],
    sectionSettings: {
      'slider-home': {
        sourceMode: 'manual',
        comboEnabled: 'true',
        comboTargetType: 'cart',
        comboItem1Id: 'coffee',
        comboItem2Id: 'cake',
        comboPrice: '210',
        comboDiscountPolicy: 'combo-only',
      },
    },
  }
  const sliderLine = (itemId: string) => ({
    itemId,
    quantity: 1,
    combo: { instanceId: 'slider-click', sectionInstanceId: 'slider-home', comboIndex: 1 },
  })
  const result = resolveComboPriceOverrides({ lines: [sliderLine('coffee'), sliderLine('cake')], tokens: sliderTokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal([...result.pricesByLine.values()].reduce((sum, price) => sum + price, 0), 210)
  assert.equal(result.loyaltyStackingAllowed, false)
})

test('promo slider combo rejects display-only and client-altered bundles', () => {
  const sliderTokens = {
    pageBlocks: [{ type: 'section', id: 'slider-home', sectionId: 'promo-slider' }],
    sectionSettings: {
      'slider-home': {
        sourceMode: 'manual',
        comboTargetType: 'product',
        comboItem1Id: 'coffee',
        comboItem2Id: 'cake',
        comboPrice: '210',
      },
    },
  }
  const lines = ['coffee', 'cake'].map((itemId) => ({ itemId, quantity: 1, combo: { instanceId: 'slider-click', sectionInstanceId: 'slider-home', comboIndex: 1 } }))
  assert.equal(resolveComboPriceOverrides({ lines, tokens: sliderTokens, catalogItems: catalog }).ok, false)
  ;(sliderTokens.sectionSettings['slider-home'] as Record<string, string>).comboTargetType = 'cart'
  lines[1] = { ...lines[1]!, itemId: 'tea' }
  assert.equal(resolveComboPriceOverrides({ lines, tokens: sliderTokens, catalogItems: catalog }).ok, false)
})

test('modern combo verifies all four products and rejects incomplete client membership', () => {
  const fourCatalog = [...catalog, { id: 'cookie', price: 100, position: 4, is_available: true }]
  const fourTokens = structuredClone(tokens)
  ;(fourTokens.sectionSettings as Record<string, Record<string, unknown>>)['combo-home'] = {
    editorialVersion: '2', selectionMode: 'manual', comboCount: '1', itemsPerCombo: '4',
    combo1Item1Id: 'coffee', combo1Item2Id: 'cake', combo1Item3Id: 'tea', combo1Item4Id: 'cookie', combo1Price: '400',
  }
  const result = resolveComboPriceOverrides({
    lines: ['coffee', 'cake', 'tea', 'cookie'].map((itemId) => comboLine(itemId)),
    tokens: fourTokens,
    catalogItems: fourCatalog,
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal([...result.pricesByLine.values()].reduce((sum, price) => sum + price, 0), 400)

  const incomplete = resolveComboPriceOverrides({
    lines: ['coffee', 'cake', 'tea'].map((itemId) => comboLine(itemId)),
    tokens: fourTokens,
    catalogItems: fourCatalog,
  })
  assert.equal(incomplete.ok, false)
})

test('modern combo rejects campaign prices at or above catalog total while legacy remains compatible', () => {
  const modernTokens = structuredClone(tokens)
  const modernSettings = modernTokens.sectionSettings['combo-home'] as Record<string, unknown>
  modernSettings.editorialVersion = '2'
  modernSettings.combo1Price = '300'
  assert.equal(resolveComboPriceOverrides({ lines: [comboLine('coffee'), comboLine('cake')], tokens: modernTokens, catalogItems: catalog }).ok, false)

  const legacyTokens = structuredClone(tokens)
  ;(legacyTokens.sectionSettings['combo-home'] as Record<string, unknown>).combo1Price = '350'
  const legacy = resolveComboPriceOverrides({ lines: [comboLine('coffee'), comboLine('cake')], tokens: legacyTokens, catalogItems: catalog })
  assert.equal(legacy.ok, true)
  if (legacy.ok) assert.equal([...legacy.pricesByLine.values()].reduce((sum, price) => sum + price, 0), 350)
})
