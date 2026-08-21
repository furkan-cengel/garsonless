import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const route = (path: string) => new URL(path, root)

test('customer auth public surface is server-owned and closed', () => {
  for (const path of [
    'app/api/customer-auth/email/start/route.ts',
    'app/api/customer-auth/email/verify/route.ts',
    'app/api/customer-auth/phone/start/route.ts',
    'app/api/customer-auth/phone/verify/route.ts',
    'app/api/customer-auth/oauth/start/route.ts',
    'app/auth/callback/route.ts',
    'app/api/account/session/route.ts',
    'app/api/account/logout/route.ts',
  ]) assert.equal(existsSync(route(path)), true, `${path} must exist`)

  assert.equal(existsSync(route('app/api/auth/whoami/route.ts')), false)
  assert.equal(existsSync(route('app/api/auth/ensure-customer/route.ts')), false)
  assert.equal(existsSync(route('lib/supabase-browser.ts')), false)

  const memberSheet = readFileSync(route('app/[slug]/components/MemberSheet.tsx'), 'utf8')
  assert.doesNotMatch(memberSheet, /createBrowserClient|createMenuAuthBrowserClient|signInWithOtp|verifyOtp|signInWithOAuth/)
  assert.match(memberSheet, /\/api\/customer-auth\/email\/start/)
  assert.match(memberSheet, /\/api\/customer-auth\/email\/verify/)
  assert.match(memberSheet, /\/api\/customer-auth\/phone\/start/)
  assert.match(memberSheet, /\/api\/customer-auth\/phone\/verify/)
  assert.match(memberSheet, /\/api\/customer-auth\/oauth\/start/)
})

test('Google OAuth always asks the guest to choose an account', () => {
  const oauthStart = readFileSync(route('app/api/customer-auth/oauth/start/route.ts'), 'utf8')
  assert.match(oauthStart, /parsed\.data\.provider === 'google'/)
  assert.match(oauthStart, /prompt: 'select_account'/)
})
