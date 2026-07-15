import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isServiceRequestType,
  normalizeAbnormalCloseReason,
  serviceRequestLabel,
} from './tables'

test('service request vocabulary is closed and has a safe legacy label fallback', () => {
  assert.equal(isServiceRequestType('bill'), true)
  assert.equal(isServiceRequestType('custom_untrusted_value'), false)
  assert.equal(serviceRequestLabel('water'), 'Su isteği')
  assert.equal(serviceRequestLabel('custom_untrusted_value'), 'Garson çağrısı')
})

test('abnormal close reason is trimmed and bounded', () => {
  assert.deepEqual(normalizeAbnormalCloseReason('  müşteri ayrıldı  '), { ok: true, value: 'müşteri ayrıldı' })
  assert.deepEqual(normalizeAbnormalCloseReason('   '), { ok: true, value: null })
  assert.deepEqual(normalizeAbnormalCloseReason('x'.repeat(201)), { ok: false, error: 'Abnormal close reason is too long' })
})
