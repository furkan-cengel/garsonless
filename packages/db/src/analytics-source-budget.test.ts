import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANALYTICS_SOURCE_ROW_LIMIT,
  ANALYTICS_SOURCE_SENTINEL,
  analyticsSourceSizeWithinBudget,
  boundedAnalyticsRows,
} from './analytics-source-budget'

test('analytics source budget accepts pilot, 1k and 10k but rejects a sentinel and 100k', () => {
  assert.equal(analyticsSourceSizeWithinBudget(25), true)
  assert.equal(analyticsSourceSizeWithinBudget(1_000), true)
  assert.equal(analyticsSourceSizeWithinBudget(10_000), true)
  assert.equal(analyticsSourceSizeWithinBudget(ANALYTICS_SOURCE_SENTINEL), false)
  assert.equal(analyticsSourceSizeWithinBudget(100_000), false)
  assert.equal(ANALYTICS_SOURCE_ROW_LIMIT, 10_000)
})
test('overflow is explicit instead of returning a silently truncated report', () => {
  assert.equal(boundedAnalyticsRows(Array.from({ length: 10_000 }, (_, index) => index))?.length, 10_000)
  assert.equal(boundedAnalyticsRows(Array.from({ length: 10_001 }, (_, index) => index)), null)
})
