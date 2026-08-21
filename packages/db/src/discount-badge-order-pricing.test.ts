import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveDiscountBadgePriceOverrides,
  type DiscountBadgeThemeTokens,
} from './discount-badge-order-pricing'

const catalog = [
  { id: 'coffee', price: 200, is_available: true },
  { id: 'cake', price: 300, is_available: true },
]

const tokens: DiscountBadgeThemeTokens = {
  pageBlocks: [{ type: 'section', id: 'discount-home', sectionId: 'discount-badge' }],
  sectionSettings: {
    'discount-home': {
      productId: 'coffee',
      discountMode: 'percentage',
      discountPercent: '25',
      discountPolicy: 'combine-loyalty',
    },
  },
}

function line(itemId = 'coffee', quantity = 1) {
  return {
    itemId,
    quantity,
    promotion: { sectionInstanceId: 'discount-home', kind: 'discount-badge' as const },
  }
}

test('published percentage discount is resolved from catalogue price', () => {
  const result = resolveDiscountBadgePriceOverrides({ lines: [line()], tokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.pricesByLine.get(0), 150)
  assert.equal(result.loyaltyStackingAllowed, true)
})

test('published fixed campaign price is accepted and can suppress loyalty', () => {
  const fixedTokens = structuredClone(tokens)
  fixedTokens.sectionSettings!['discount-home'] = {
    productId: 'coffee',
    discountMode: 'fixed-price',
    campaignPrice: '129,90',
    discountPolicy: 'promotion-only',
  }
  const result = resolveDiscountBadgePriceOverrides({ lines: [line()], tokens: fixedTokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.pricesByLine.get(0), 129.9)
  assert.equal(result.loyaltyStackingAllowed, false)
})

test('tampered product and unpublished instances fail closed', () => {
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line('cake')], tokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveDiscountBadgePriceOverrides({
    lines: [{ ...line(), promotion: { sectionInstanceId: 'invented', kind: 'discount-badge' } }],
    tokens,
    catalogItems: catalog,
  }).ok, false)
})

test('invalid or non-discounted campaign price fails closed', () => {
  const invalidTokens = structuredClone(tokens)
  invalidTokens.sectionSettings!['discount-home'] = {
    productId: 'coffee',
    discountMode: 'fixed-price',
    campaignPrice: '250',
  }
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line()], tokens: invalidTokens, catalogItems: catalog }).ok, false)
})

test('2 al 1 öde resolves a pair price and rejects non-pair quantities', () => {
  const pairTokens = structuredClone(tokens)
  pairTokens.sectionSettings!['discount-home'] = {
    productId: 'coffee',
    discountMode: 'buy-2-pay-1',
  }

  const result = resolveDiscountBadgePriceOverrides({ lines: [line('coffee', 2)], tokens: pairTokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.pricesByLine.get(0), 100)

  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line('coffee', 1)], tokens: pairTokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line('coffee', 3)], tokens: pairTokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line('coffee', 4)], tokens: pairTokens, catalogItems: catalog }).ok, true)
})

test('expired and malformed timed promotions fail closed', () => {
  const timedTokens = structuredClone(tokens)
  timedTokens.sectionSettings!['discount-home'] = {
    productId: 'coffee',
    discountMode: 'percentage',
    discountPercent: '25',
    countdownEnabled: 'true',
    campaignEndsAt: '2026-07-25T13:00:00.000Z',
  }
  const beforeDeadline = Date.parse('2026-07-25T12:00:00.000Z')
  const afterDeadline = Date.parse('2026-07-25T14:00:00.000Z')
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line()], tokens: timedTokens, catalogItems: catalog, now: beforeDeadline }).ok, true)
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line()], tokens: timedTokens, catalogItems: catalog, now: afterDeadline }).ok, false)

  timedTokens.sectionSettings!['discount-home'] = {
    ...timedTokens.sectionSettings!['discount-home'] as Record<string, unknown>,
    campaignEndsAt: 'not-a-date',
  }
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [line()], tokens: timedTokens, catalogItems: catalog, now: beforeDeadline }).ok, false)
})

test('published daily special fixed price is resolved from the same server-authoritative contract', () => {
  const dailyTokens: DiscountBadgeThemeTokens = {
    pageBlocks: [{ type: 'section', id: 'daily-home', sectionId: 'daily-special' }],
    sectionSettings: {
      'daily-home': {
        productId: 'coffee',
        discountMode: 'fixed-price',
        campaignPrice: '120',
        discountPolicy: 'promotion-only',
      },
    },
  }
  const result = resolveDiscountBadgePriceOverrides({
    lines: [{
      itemId: 'coffee',
      quantity: 1,
      promotion: { sectionInstanceId: 'daily-home', kind: 'daily-special' },
    }],
    tokens: dailyTokens,
    catalogItems: catalog,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.pricesByLine.get(0), 120)
  assert.equal(result.loyaltyStackingAllowed, false)
})

test('daily special rejects section-kind mismatch, removed pricing and an expired deadline', () => {
  const dailyTokens: DiscountBadgeThemeTokens = {
    pageBlocks: [{ type: 'section', id: 'daily-home', sectionId: 'daily-special' }],
    sectionSettings: {
      'daily-home': {
        productId: 'coffee',
        discountMode: 'fixed-price',
        campaignPrice: '120',
      },
    },
  }
  const dailyLine = {
    itemId: 'coffee',
    quantity: 1,
    promotion: { sectionInstanceId: 'daily-home', kind: 'daily-special' as const },
  }

  assert.equal(resolveDiscountBadgePriceOverrides({
    lines: [{ ...dailyLine, promotion: { ...dailyLine.promotion, kind: 'discount-badge' as const } }],
    tokens: dailyTokens,
    catalogItems: catalog,
  }).ok, false)

  const noPriceTokens = structuredClone(dailyTokens)
  noPriceTokens.sectionSettings!['daily-home'] = { productId: 'coffee', discountMode: 'none' }
  assert.equal(resolveDiscountBadgePriceOverrides({
    lines: [dailyLine],
    tokens: noPriceTokens,
    catalogItems: catalog,
  }).ok, false)

  const expiredTokens = structuredClone(dailyTokens)
  expiredTokens.sectionSettings!['daily-home'] = {
    ...expiredTokens.sectionSettings!['daily-home'] as Record<string, unknown>,
    countdownEnabled: 'true',
    campaignEndsAt: '2026-07-25T12:00:00.000Z',
  }
  assert.equal(resolveDiscountBadgePriceOverrides({
    lines: [dailyLine],
    tokens: expiredTokens,
    catalogItems: catalog,
    now: Date.parse('2026-07-25T12:00:01.000Z'),
  }).ok, false)
})

test('published promo slider flash verifies selected 2 al 1 öde products and exact pair quantities', () => {
  const sliderTokens: DiscountBadgeThemeTokens = {
    pageBlocks: [{ type: 'section', id: 'slider-home', sectionId: 'promo-slider' }],
    sectionSettings: {
      'slider-home': {
        sourceMode: 'manual',
        flashEnabled: 'true',
        flashOfferType: 'buy-2-pay-1',
        flashItem1Id: 'coffee',
        flashItem2Id: 'cake',
        flashDiscountPolicy: 'promotion-only',
      },
    },
  }
  const sliderLine = (itemId: string, quantity: number) => ({
    itemId,
    quantity,
    promotion: { sectionInstanceId: 'slider-home', kind: 'promo-slider' as const },
  })
  const result = resolveDiscountBadgePriceOverrides({ lines: [sliderLine('cake', 2)], tokens: sliderTokens, catalogItems: catalog })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.pricesByLine.get(0), 150)
    assert.equal(result.loyaltyStackingAllowed, false)
  }
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [sliderLine('cake', 1)], tokens: sliderTokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [sliderLine('cake', 3)], tokens: sliderTokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [sliderLine('cake', 5)], tokens: sliderTokens, catalogItems: catalog }).ok, false)
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [sliderLine('cake', 4)], tokens: sliderTokens, catalogItems: catalog }).ok, true)
  assert.equal(resolveDiscountBadgePriceOverrides({ lines: [sliderLine('missing', 2)], tokens: sliderTokens, catalogItems: catalog }).ok, false)
})

test('enabled Home promo slider campaigns are server-verifiable without a duplicate menu block', () => {
  const homeTokens: DiscountBadgeThemeTokens = {
    surfaces: { home: { enabled: true, blocks: [{ id: 'home-slider', sectionId: 'promo-slider', enabled: true }] } },
    sectionSettings: {
      'home-slider': {
        sourceMode: 'manual',
        flashOfferType: 'buy-2-pay-1',
        flashItem1Id: 'coffee',
      },
    },
  }
  const result = resolveDiscountBadgePriceOverrides({
    lines: [{ itemId: 'coffee', quantity: 2, promotion: { sectionInstanceId: 'home-slider', kind: 'promo-slider' } }],
    tokens: homeTokens,
    catalogItems: catalog,
  })
  assert.equal(result.ok, true)
})

test('Home promo slider pricing remains server-verifiable when the Home landing page is disabled', () => {
  const homeTokens: DiscountBadgeThemeTokens = {
    surfaces: { home: { enabled: false, blocks: [{ id: 'home-slider', sectionId: 'promo-slider', enabled: true }] } },
    sectionSettings: {
      'home-slider': {
        sourceMode: 'mixed',
        flashOfferType: 'buy-2-pay-1',
        flashItem1Id: 'cake',
      },
    },
  }
  const result = resolveDiscountBadgePriceOverrides({
    lines: [{ itemId: 'cake', quantity: 2, promotion: { sectionInstanceId: 'home-slider', kind: 'promo-slider' } }],
    tokens: homeTokens,
    catalogItems: catalog,
  })

  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.pricesByLine.get(0), 150)
})
