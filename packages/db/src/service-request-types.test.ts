import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isServiceRequestType,
  serviceRequestLabel,
} from './service-request-types'

test('accepts only supported service request types', () => {
  assert.equal(isServiceRequestType('water'), true)
  assert.equal(isServiceRequestType('bill'), true)
  assert.equal(isServiceRequestType('custom text'), false)
})

test('maps request types to staff-facing labels without trusting free text', () => {
  assert.equal(serviceRequestLabel('clean_table'), 'Masa temizliği')
  assert.equal(serviceRequestLabel('change_ashtray'), 'Küllük değişimi')
  assert.equal(serviceRequestLabel('unknown'), 'Garson çağrısı')
})
