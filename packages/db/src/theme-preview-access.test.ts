import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createThemePreviewAccessToken,
  resolveThemePreviewSigningSecret,
  verifyThemePreviewAccessToken,
} from './theme-preview-access'

const secret = 'theme-preview-test-secret-with-at-least-32-bytes'

test('theme preview access is restaurant- and slug-scoped', () => {
  const token = createThemePreviewAccessToken({
    restaurantId: 'restaurant-a',
    slug: 'test-cafe',
    nowSeconds: 1_000,
  }, secret)
  assert.equal(verifyThemePreviewAccessToken(token, {
    restaurantId: 'restaurant-a',
    slug: 'test-cafe',
    nowSeconds: 1_001,
  }, secret), true)
  assert.equal(verifyThemePreviewAccessToken(token, {
    restaurantId: 'restaurant-b',
    slug: 'test-cafe',
    nowSeconds: 1_001,
  }, secret), false)
  assert.equal(verifyThemePreviewAccessToken(token, {
    restaurantId: 'restaurant-a',
    slug: 'another-cafe',
    nowSeconds: 1_001,
  }, secret), false)
})

test('theme preview access fails closed for tampering, expiry and missing secrets', () => {
  const token = createThemePreviewAccessToken({
    restaurantId: 'restaurant-a',
    slug: 'test-cafe',
    ttlSeconds: 60,
    nowSeconds: 1_000,
  }, secret)
  const expected = { restaurantId: 'restaurant-a', slug: 'test-cafe', nowSeconds: 1_061 }
  assert.equal(verifyThemePreviewAccessToken(token, expected, secret), false)
  assert.equal(verifyThemePreviewAccessToken(`${token}x`, { ...expected, nowSeconds: 1_001 }, secret), false)
  assert.equal(verifyThemePreviewAccessToken(token, { ...expected, nowSeconds: 1_001 }, null), false)
})

test('preview signing secret prefers a dedicated key and safely falls back for existing deployments', () => {
  assert.equal(resolveThemePreviewSigningSecret({
    THEME_PREVIEW_SIGNING_SECRET: 'd'.repeat(32),
    SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(32),
  }), 'd'.repeat(32))
  assert.equal(resolveThemePreviewSigningSecret({ SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(32) }), 's'.repeat(32))
  assert.equal(resolveThemePreviewSigningSecret({}), null)
})
