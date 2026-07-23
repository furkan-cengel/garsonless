import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPlatformErrorApp,
  isPlatformErrorSeverity,
  isPlatformErrorSource,
  isPlatformErrorWindow,
} from './platform-observability'

test('platform error dimensions are closed and reject invented values', () => {
  assert.equal(isPlatformErrorApp('dashboard'), true)
  assert.equal(isPlatformErrorApp('public-api'), false)
  assert.equal(isPlatformErrorSeverity('critical'), true)
  assert.equal(isPlatformErrorSeverity('debug'), false)
  assert.equal(isPlatformErrorWindow('30d'), true)
  assert.equal(isPlatformErrorWindow('forever'), false)
})

test('fingerprint sources are bounded machine labels, never free-form errors', () => {
  assert.equal(isPlatformErrorSource('dashboard-query.order-volume'), true)
  assert.equal(isPlatformErrorSource('SQL failed: customer@example.com'), false)
  assert.equal(isPlatformErrorSource('x'.repeat(81)), false)
})
