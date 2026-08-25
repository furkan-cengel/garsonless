import assert from 'node:assert/strict'
import test from 'node:test'
import { isWebVitalName, normalizeWebVitalsSampleRate } from './web-vitals'

test('public Web Vitals sampling is bounded and accepts only the release metric set', () => {
  assert.equal(normalizeWebVitalsSampleRate(undefined), 0.05)
  assert.equal(normalizeWebVitalsSampleRate('3'), 1)
  assert.equal(normalizeWebVitalsSampleRate('-1'), 0)
  assert.equal(isWebVitalName('INP'), true)
  assert.equal(isWebVitalName('FID'), false)
})
