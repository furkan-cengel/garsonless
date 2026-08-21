import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const callback = readFileSync(new URL('./callback-path.ts', import.meta.url), 'utf8')
const callbackRoute = readFileSync(new URL('../../app/auth/callback/route.ts', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../actions/auth.ts', import.meta.url), 'utf8')
const signup = readFileSync(new URL('../../app/auth/signup/page.tsx', import.meta.url), 'utf8')

test('auth callback accepts only same-origin relative next paths', () => {
  assert.match(callback, /!value\.startsWith\('\/'\)/)
  assert.match(callback, /value\.startsWith\('\/\/'\)/)
  assert.match(callback, /parsed\.origin === 'https:\/\/app\.masabu\.co'/)
  assert.match(callbackRoute, /safeCallbackPath\(searchParams\.get\('next'\)\)/)
  assert.match(callbackRoute, /recordSignupLegalEvidence/)
})

test('signup records versioned terms evidence and presents notice separately', () => {
  assert.match(actions, /recordSignupLegalEvidence/)
  assert.match(actions, /b2b_terms_accepted_at/)
  assert.match(actions, /privacy_notice_version/)
  assert.match(signup, /name="termsAccepted"/)
  assert.match(signup, /termsVersion/)
  assert.match(signup, /KVKK Aydınlatma Metni/)
  assert.doesNotMatch(actions, /deleteUser/)
})

test('password reset request is enumeration-safe and has a real recovery redirect', () => {
  assert.match(actions, /resetPasswordForEmail/)
  assert.match(actions, /passwordRecoveryRedirect\(\)/)
  assert.match(actions, /Account enumeration is intentionally avoided/)
})
