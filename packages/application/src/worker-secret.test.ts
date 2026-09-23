import assert from 'node:assert/strict'
import test from 'node:test'
import { isAuthorizedWorkerRequest } from './worker-secret'

const headers = (value?: string) => new Headers(value === undefined ? {} : { 'x-outbox-secret': value })

test('worker secret accepts only the exact configured value', () => {
  assert.equal(isAuthorizedWorkerRequest(headers('s3cret-value'), 's3cret-value'), true)
  assert.equal(isAuthorizedWorkerRequest(headers('s3cret-valuE'), 's3cret-value'), false)
  assert.equal(isAuthorizedWorkerRequest(headers('s3cret'), 's3cret-value'), false)
  assert.equal(isAuthorizedWorkerRequest(headers('s3cret-value-and-more'), 's3cret-value'), false)
})

test('worker secret fails closed when either side is missing or blank', () => {
  assert.equal(isAuthorizedWorkerRequest(headers(), 's3cret-value'), false)
  assert.equal(isAuthorizedWorkerRequest(headers(''), 's3cret-value'), false)
  assert.equal(isAuthorizedWorkerRequest(headers('anything'), undefined), false)
  assert.equal(isAuthorizedWorkerRequest(headers(''), ''), false)
  assert.equal(isAuthorizedWorkerRequest(headers('   '), '   '), false)
})
