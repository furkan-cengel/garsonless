import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_ANALYTICS_RESPONSE_BYTES,
  serializeAnalyticsResponse,
} from '../../lib/analytics-payload-budget'

test('analytics JSON response has an explicit UTF-8 byte budget', () => {
  const small = serializeAnalyticsResponse({ rows: Array.from({ length: 1_000 }, (_, index) => ({ index })) })
  assert.equal(small.withinBudget, true)
  assert.ok(small.bytes < MAX_ANALYTICS_RESPONSE_BYTES)

  const oversized = serializeAnalyticsResponse({ value: 'ü'.repeat(MAX_ANALYTICS_RESPONSE_BYTES) })
  assert.equal(oversized.withinBudget, false)
  assert.ok(oversized.bytes > MAX_ANALYTICS_RESPONSE_BYTES)
})
