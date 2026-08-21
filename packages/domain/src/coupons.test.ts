import assert from 'node:assert/strict'
import test from 'node:test'
import { couponErrorMessage, couponStatus, isCouponCode, normalizeCouponCode } from './coupons'

test('coupon codes are normalized and constrained to safe ASCII tokens', () => {
  assert.equal(normalizeCouponCode('  hosgeldin25 '), 'HOSGELDIN25')
  assert.equal(isCouponCode('hosgeldin25'), true)
  assert.equal(isCouponCode('iki kelime'), false)
  assert.equal(isCouponCode('ab'), false)
})

test('coupon lifecycle derives scheduled, expired and exhausted states', () => {
  const base = { enabled: true, startsAt: null, endsAt: null, totalUsageLimit: null, redemptionCount: 0, archivedAt: null }
  const now = Date.parse('2026-08-18T12:00:00Z')
  assert.equal(couponStatus(base, now), 'active')
  assert.equal(couponStatus({ ...base, startsAt: '2026-08-19T12:00:00Z' }, now), 'scheduled')
  assert.equal(couponStatus({ ...base, endsAt: '2026-08-18T11:59:59Z' }, now), 'expired')
  assert.equal(couponStatus({ ...base, totalUsageLimit: 3, redemptionCount: 3 }, now), 'exhausted')
  assert.match(couponErrorMessage('COUPON_AUTH_REQUIRED'), /üyeliğinizi doğrulayın/)
})
