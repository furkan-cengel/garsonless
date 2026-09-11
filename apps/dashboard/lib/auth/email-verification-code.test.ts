import assert from 'node:assert/strict'
import test from 'node:test'
import { emailCodeSchema, emailVerificationCodeSchema } from './password-policy'
import { normalizeEmailVerificationCode } from './email-verification-code'

test('email verification accepts complete provider codes without losing leading zeros', () => {
  for (const code of ['001234', '123456']) assert.equal(emailVerificationCodeSchema.parse(code), code)
  assert.equal(emailVerificationCodeSchema.parse(' \n001\u00a0234\t'), '001234')
})

test('pasted codes are never truncated or silently repaired into a different code', () => {
  assert.equal(normalizeEmailVerificationCode('001234567'), '001234567')
  assert.equal(normalizeEmailVerificationCode('0012x3456'), '0012x3456')
  for (const code of ['', '12345', '1234567', '00123456', '001234567', '0012x3456', null, 12345678]) {
    assert.equal(emailVerificationCodeSchema.safeParse(code).success, false)
  }
})

test('device verification and authenticator codes remain exactly six digits', () => {
  assert.equal(emailCodeSchema.safeParse('001234').success, true)
  assert.equal(emailCodeSchema.safeParse('00123456').success, false)
})
