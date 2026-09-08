import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const start = read('../app/api/customer-auth/phone/start/route.ts')
const verify = read('../app/api/customer-auth/phone/verify/route.ts')
const authServer = read('./customer-auth-server.ts')
const hook = read('../../../packages/db/supabase/functions/send-sms-hook/index.ts')

test('phone OTP routes are server-owned, Turkish-mobile-only and replay protected', () => {
  assert.match(start, /normalizeTurkishMobile/)
  assert.match(start, /availableCustomerAuthCapabilities/)
  assert.match(start, /signInWithOtp/)
  assert.match(start, /shouldCreateUser: true/)
  assert.match(start, /CHALLENGE_REQUIRED/)
  assert.match(start, /customerAuthAttemptSubject/)
  assert.match(start, /limit: 5, windowSeconds: 900/)
  assert.match(start, /limit: 10, windowSeconds: 86_400/)
  assert.match(verify, /type: 'sms'/)
  assert.match(verify, /consumeStoredCustomerAuthIntent/)
  assert.match(verify, /limit: 5, windowSeconds: 600/)
  assert.match(verify, /profileCompletionRequired/)
  assert.match(authServer, /CUSTOMER_PHONE_OTP_TTL_SECONDS = 5 \* 60/)
  assert.match(authServer, /masabu_customer_auth_attempt/)
  assert.match(authServer, /httpOnly: true/)
  assert.match(authServer, /auth-attempt:/)
})

test('Supabase SMS hook verifies signatures and sends only bounded Netgsm OTP messages', () => {
  assert.match(hook, /new Webhook/)
  assert.match(hook, /webhook-signature/)
  assert.match(hook, /https:\/\/api\.netgsm\.com\.tr\/sms\/rest\/v2\/otp/)
  assert.match(hook, /\^\\\+905\\d\{9\}\$/)
  assert.match(hook, /masabu kodunuz:/)
  assert.doesNotMatch(hook, /console\.(?:info|error)\([^\n]*(?:phone|otp)/i)
})
