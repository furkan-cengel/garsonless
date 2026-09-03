import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const configure = readFileSync(
  new URL('../../scripts/configure-parasut-oauth.ts', import.meta.url),
  'utf8',
)
const verify = readFileSync(
  new URL('../../scripts/verify-parasut-access.ts', import.meta.url),
  'utf8',
)

test('Paraşüt authorization code exchange stores the rotating token without printing it', () => {
  assert.match(configure, /grant_type: 'authorization_code'/)
  assert.match(configure, /createParasutOAuthPort\(\)\.configure\(refreshToken\)/)
  assert.doesNotMatch(configure, /console\.log\([^\n]*refreshToken/)
  assert.doesNotMatch(configure, /console\.log\([^\n]*payload/)
})

test('Paraşüt access verification is read-only and product-bound', () => {
  assert.match(verify, /provider\.verifyAccess\(\)/)
  assert.doesNotMatch(verify, /ensureContact|createSalesInvoice|formalize/)
})
