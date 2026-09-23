import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { safeCallbackPath } from './callback-path'

const callback = readFileSync(new URL('./callback-path.ts', import.meta.url), 'utf8')
const callbackRoute = readFileSync(new URL('../../app/auth/callback/route.ts', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../actions/auth.ts', import.meta.url), 'utf8')
const signup = readFileSync(new URL('../../components/auth/AuthEntry.tsx', import.meta.url), 'utf8')

test('auth callback accepts only same-origin relative next paths', () => {
  assert.match(callback, /from '@garsonless\/domain\/navigation'/)
  assert.match(callback, /return safeReturnPath\(value, fallback\)/)
  assert.match(callbackRoute, /safeCallbackPath\(searchParams\.get\('next'\)\)/)
  assert.match(callbackRoute, /recordSignupLegalEvidence/)
})

test('auth redirect parsing rejects browser-normalized external paths', () => {
  assert.equal(safeCallbackPath('/dashboard/settings'), '/dashboard/settings')
  assert.equal(safeCallbackPath('/\\evil.example/path'), '/dashboard')
  assert.equal(safeCallbackPath('https://evil.example/path'), '/dashboard')
  assert.equal(safeCallbackPath('/.//evil.example/path'), '/dashboard')
  assert.equal(safeCallbackPath('/dashboard/..//evil.example/path'), '/dashboard')

  const encodedBackslash = new URL(
    'https://app.masabu.co/auth/login?next=%2F%5Cevil.example%2Fpath',
  ).searchParams.get('next')
  assert.equal(safeCallbackPath(encodedBackslash), '/dashboard')
  assert.equal(safeCallbackPath(null, '/dashboard/onboarding'), '/dashboard/onboarding')
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
