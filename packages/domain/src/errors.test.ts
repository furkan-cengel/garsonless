import assert from 'node:assert/strict'
import test from 'node:test'
import { createActionFailure, ERROR_DEFINITIONS } from './errors'

test('error definitions expose unique, stable public support codes', () => {
  const publicCodes = Object.values(ERROR_DEFINITIONS).map((definition) => definition.publicCode)
  assert.equal(new Set(publicCodes).size, publicCodes.length)
  for (const publicCode of publicCodes) {
    assert.match(publicCode, /^MAS-[A-Z]+-\d{3}$/)
  }
})

test('action failures keep infrastructure details out of the client envelope', () => {
  const failure = createActionFailure('SERVICE_UNAVAILABLE', {
    referenceId: 'DASH-EXAMPLE-1234',
  })

  assert.deepEqual(failure, {
    error: 'İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.',
    errorCode: 'SERVICE_UNAVAILABLE',
    publicCode: 'MAS-SVC-503',
    retryable: true,
    referenceId: 'DASH-EXAMPLE-1234',
  })
})
