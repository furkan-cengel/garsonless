import assert from 'node:assert/strict'
import test from 'node:test'
import { isIyzicoEnvironmentAllowed } from './iyzico-environment.ts'

test('production accepts only the exact live Iyzico API origin', () => {
  assert.equal(isIyzicoEnvironmentAllowed('https://api.iyzipay.com', 'production'), true)
  assert.equal(isIyzicoEnvironmentAllowed('https://sandbox-api.iyzipay.com', 'production'), false)
  assert.equal(isIyzicoEnvironmentAllowed('https://api.iyzipay.com.evil.example', 'production'), false)
  assert.equal(isIyzicoEnvironmentAllowed('https://api.iyzipay.com/path', 'production'), false)
  assert.equal(isIyzicoEnvironmentAllowed('not-a-url', 'production'), false)
})

test('non-production can use tenant sandbox credentials', () => {
  assert.equal(isIyzicoEnvironmentAllowed('https://sandbox-api.iyzipay.com', 'development'), true)
  assert.equal(isIyzicoEnvironmentAllowed('https://sandbox-api.iyzipay.com', 'test'), true)
})
