import assert from 'node:assert/strict'
import test from 'node:test'
import { ANALYTICS_CONSENT_VERSION, analyticsCampaign, analyticsLocation, analyticsPath, analyticsReferrer, isFreshSignup, parseAnalyticsConsent, validMeasurementId } from './marketing-analytics'

test('analytics requires a valid current explicit choice', () => {
  for (const value of [undefined, 'true', '2020:granted', 'granted']) assert.equal(parseAnalyticsConsent(value), 'unknown')
  assert.equal(parseAnalyticsConsent(`${ANALYTICS_CONSENT_VERSION}:granted`), 'granted')
  assert.equal(parseAnalyticsConsent(`${ANALYTICS_CONSENT_VERSION}:denied`), 'denied')
  assert.equal(validMeasurementId('G-MASABUTEST'), 'G-MASABUTEST')
  assert.equal(validMeasurementId('G-<script>'), null)
})
test('auth secrets and business identifiers are excluded from analytics URLs', () => {
  assert.equal(analyticsLocation('https://app.masabu.co/auth/confirm?email=secret@example.com&token_hash=secret#code', 'dashboard'), 'https://app.masabu.co/auth/confirm')
  for (const path of ['/dashboard/restaurant-id/orders', '/auth/google/callback', '/auth/reset-password', '/auth/login']) assert.equal(analyticsPath(path, 'dashboard'), null)
  assert.equal(analyticsReferrer('https://app.masabu.co/auth/confirm?email=secret@example.com'), 'https://app.masabu.co')
  assert.equal(analyticsReferrer('javascript:alert(1)'), '')
})
test('campaign allowlist drops email, phone and arbitrary query values', () => {
  assert.deepEqual(analyticsCampaign('?utm_source=google&utm_medium=organic&utm_campaign=launch_tr&utm_content=a%40example.com&utm_term=phone5551234567&email=secret'), { campaign_source: 'google', campaign_medium: 'organic', campaign_name: 'launch_tr' })
})
test('OAuth conversion checks first account creation within the server-started flow', () => {
  const start = Date.parse('2026-09-09T09:00:00Z')
  const first = { created_at: '2026-09-09T09:00:01Z', email_confirmed_at: '2026-09-09T09:00:02Z', last_sign_in_at: '2026-09-09T09:00:02Z' }
  assert.equal(isFreshSignup(first, start), true)
  assert.equal(isFreshSignup({ ...first, created_at: '2026-01-01T09:00:00Z' }, start), false)
  assert.equal(isFreshSignup({ ...first, last_sign_in_at: '2026-09-10T09:00:00Z' }, start), false)
})
