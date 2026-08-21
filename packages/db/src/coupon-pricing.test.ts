import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCouponToDiscount, calculateCouponDiscountAmount, couponAppliesToLine } from './coupons'
import type { DiscountResult } from './loyalty'

const loyalty: DiscountResult = {
  subtotal: 400,
  stampDiscountAmount: 50,
  stampsConsumed: 9,
  rewardItemName: 'Kahve',
  rewardItemId: 'reward',
  catalogDiscountAmount: 0,
  catalogPointsCost: 0,
  catalogItemName: null,
  catalogItemId: null,
  memberDiscountAmount: 35,
  memberDiscountPct: 10,
  memberTierName: 'Altın',
  pointsDiscountAmount: 20,
  pointsRedeemed: 2000,
  finalTotal: 295,
  pointsRate: 100,
  scopeKey: 'scope',
  customerTierSnapshot: null,
}

function coupon(stackingPolicy: 'exclusive' | 'combine_loyalty') {
  return {
    coupon: {
      id: 'coupon', restaurantId: 'restaurant', name: 'Test', code: 'TEST25', enabled: true,
      discountType: 'percentage' as const, discountValue: 25, scope: 'order' as const, minimumAmount: 0,
      maximumDiscountAmount: null, startsAt: null, endsAt: null, totalUsageLimit: null,
      perCustomerLimit: null, audience: 'everyone' as const, stackingPolicy, marketingLabel: null,
      marketingDescription: null, categoryIds: [], itemIds: [], redemptionCount: 0, archivedAt: null,
      createdAt: '', updatedAt: '',
    },
    eligibleSubtotal: 400,
    stampEligibleDiscount: stackingPolicy === 'combine_loyalty' ? 50 : 0,
    catalogEligibleDiscount: 0,
    discountAmount: stackingPolicy === 'combine_loyalty' ? 87.5 : 100,
  }
}

test('exclusive coupon suppresses loyalty redemptions and member discount', () => {
  const result = applyCouponToDiscount(loyalty, coupon('exclusive'))
  assert.equal(result.couponDiscountAmount, 100)
  assert.equal(result.stampDiscountAmount, 0)
  assert.equal(result.memberDiscountAmount, 0)
  assert.equal(result.pointsDiscountAmount, 0)
  assert.equal(result.finalTotal, 300)
})

test('combinable coupon is inserted after free rewards and before member/points', () => {
  const result = applyCouponToDiscount(loyalty, coupon('combine_loyalty'))
  assert.equal(result.stampDiscountAmount, 50)
  assert.equal(result.couponDiscountAmount, 87.5)
  assert.equal(result.memberDiscountAmount, 26)
  assert.equal(result.pointsDiscountAmount, 20)
  assert.equal(result.finalTotal, 216.5)
})

test('percentage and fixed discounts are bounded by cap and eligible amount', () => {
  const percentage = coupon('exclusive').coupon
  assert.equal(calculateCouponDiscountAmount({ ...percentage, discountValue: 25, maximumDiscountAmount: 40 }, 200), 40)
  assert.equal(calculateCouponDiscountAmount({ ...percentage, discountType: 'fixed', discountValue: 250, maximumDiscountAmount: null }, 80), 80)
})

test('order, category and product scopes match only their eligible lines', () => {
  const base = coupon('exclusive').coupon
  const line = { itemId: 'latte', categoryId: 'coffee' }
  assert.equal(couponAppliesToLine({ ...base, scope: 'order' }, line), true)
  assert.equal(couponAppliesToLine({ ...base, scope: 'category', categoryIds: ['coffee'] }, line), true)
  assert.equal(couponAppliesToLine({ ...base, scope: 'category', categoryIds: ['dessert'] }, line), false)
  assert.equal(couponAppliesToLine({ ...base, scope: 'product', itemIds: ['latte'] }, line), true)
  assert.equal(couponAppliesToLine({ ...base, scope: 'product', itemIds: ['tea'] }, line), false)
})
