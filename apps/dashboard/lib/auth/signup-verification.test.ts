import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const auth = readFileSync(new URL('../actions/auth.ts', import.meta.url), 'utf8')
const middleware = readFileSync(new URL('../../middleware.ts', import.meta.url), 'utf8')
const onboarding = readFileSync(new URL('../actions/onboarding.ts', import.meta.url), 'utf8')
const verifyForm = readFileSync(new URL('../../components/auth/VerifyEmailForm.tsx', import.meta.url), 'utf8')

test('password signup requires inbox possession before onboarding', () => {
  assert.match(auth, /requireDashboardSignupEmailVerification/)
  assert.match(auth, /signInWithOtp/)
  assert.match(auth, /verifyOtp/)
  assert.match(auth, /completeDashboardSignupEmailVerification/)
  assert.match(auth, /data\.user\.identities\?\.length === 0/)
  assert.match(auth, /refreshSession/)
  assert.match(auth, /type: 'email'/)
  assert.match(verifyForm, /autoComplete="one-time-code"/)
  assert.match(verifyForm, /pattern="\[0-9\]\{6\}"/)
})

test('pending signup verification is fail-closed at routing and onboarding command boundaries', () => {
  assert.match(middleware, /dashboard_signup_email_verification_required/)
  assert.match(middleware, /\/auth\/verify-email/)
  assert.match(onboarding, /signupEmailVerificationRequired\(user\)/)
  assert.match(onboarding, /İşletme oluşturmadan önce e-posta adresini doğrula/)
})
