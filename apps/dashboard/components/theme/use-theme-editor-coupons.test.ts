import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./use-theme-editor-coupons.ts', import.meta.url), 'utf8')

test('theme coupon choices refresh after returning from coupon management', () => {
  assert.match(source, /initialCoupons: PublicCouponChoice\[\]/)
  assert.match(source, /useState<PublicCouponChoice\[\]>\(initialCoupons\)/)
  assert.match(source, /getActiveCouponChoices\(restaurantId\)/)
  assert.match(source, /window\.addEventListener\('focus', reload\)/)
  assert.match(source, /document\.addEventListener\('visibilitychange', onVisible\)/)
  assert.match(source, /window\.removeEventListener\('focus', reload\)/)
})

test('server-projected coupons are not overwritten by an eager client reload', () => {
  assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*void reload\(\)/)
})
