import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./published-theme.ts', import.meta.url), 'utf8')

test('published QR themes bypass cross-application caches', () => {
  assert.match(source, /cache\(async function getPublishedTheme/)
  assert.match(source, /readPublishedTheme\(\{ restaurantId \}/)
  assert.doesNotMatch(source, /unstable_cache|revalidate:\s*60|public-menu-theme/)
})

test('published coupon cards are enriched only from live coupon records', () => {
  assert.match(source, /listActivePublicCoupons/)
  assert.match(source, /couponId/)
  assert.match(source, /couponEnabled:\s*'false'/)
  assert.match(source, /couponCode:\s*coupon\.code/)
})
