import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dashboardRouteFamily,
  isDashboardWebVitalName,
  normalizeWebVitalsSampleRate,
} from './web-vitals-model'

test('normalizes dashboard paths without exposing restaurant or customer identifiers', () => {
  assert.equal(dashboardRouteFamily('/dashboard/restaurant-secret/orders'), 'dashboard/orders')
  assert.equal(dashboardRouteFamily('/dashboard/restaurant-secret/customers/customer-secret'), 'dashboard/customers')
  assert.equal(dashboardRouteFamily('/dashboard/onboarding'), 'dashboard/onboarding')
  assert.equal(dashboardRouteFamily('/auth/login'), 'dashboard/other')
})

test('allowlists metrics and bounds the sampling rate', () => {
  assert.equal(isDashboardWebVitalName('INP'), true)
  assert.equal(isDashboardWebVitalName('FID'), false)
  assert.equal(normalizeWebVitalsSampleRate(undefined), 0.1)
  assert.equal(normalizeWebVitalsSampleRate('2'), 1)
  assert.equal(normalizeWebVitalsSampleRate('-1'), 0)
})
