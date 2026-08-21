import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, normalizeTurkishMobile } from './phone'

const CANON = '+905321234567'

test('TR messy variants all canonicalize to the same E.164', () => {
  const variants = [
    '0532 123 45 67',
    '0532-123-45-67',
    '05321234567',
    '532 123 45 67',
    '5321234567',
    '+90 532 123 45 67',
    '+905321234567',
    '90 532 123 45 67',
    '905321234567',
    '0090 532 123 45 67',
    '00905321234567',
    '  +90 (532) 123 4567  ',
  ]
  for (const v of variants) {
    assert.equal(normalizePhone(v), CANON, `failed for input: ${JSON.stringify(v)}`)
  }
})

test('invalid / garbage inputs return null', () => {
  for (const bad of ['', '   ', 'abc', '123', '532', '0532123', '+90 444 12 34', null, undefined]) {
    assert.equal(normalizePhone(bad as string), null, `should be null for: ${JSON.stringify(bad)}`)
  }
})

test('TR landline (non-5 leading) rejected as mobile', () => {
  // 0312 = Ankara landline; not a 5XX mobile → null
  assert.equal(normalizePhone('0312 123 45 67'), null)
})

test('non-TR explicit country code passes through as generic E.164', () => {
  assert.equal(normalizePhone('+1 555 123 4567'), '+15551234567')
  assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958')
})

test('auth normalization accepts only Turkish mobile numbers', () => {
  assert.equal(normalizeTurkishMobile('0532 123 45 67'), CANON)
  assert.equal(normalizeTurkishMobile('+90 212 123 45 67'), null)
  assert.equal(normalizeTurkishMobile('+44 20 7946 0958'), null)
})

test('double-prefix +90 0532 tolerated (leading national 0 stripped)', () => {
  assert.equal(normalizePhone('+90 0532 123 45 67'), CANON)
})
