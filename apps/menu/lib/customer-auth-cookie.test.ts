import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CUSTOMER_AUTH_INTENT_COOKIE,
  MENU_AUTH_COOKIE_PREFIX,
  readMenuAuthCookies,
  writeMenuAuthCookie,
} from './customer-auth-cookie.ts'

test('menu auth cookies are isolated, host-only and hardened', () => {
  const mapped = writeMenuAuthCookie({
    name: 'sb-project-auth-token.0',
    value: 'secret',
    options: { domain: '.example.com', sameSite: 'none', httpOnly: false, path: '/old' },
  })
  assert.equal(mapped.name, `${MENU_AUTH_COOKIE_PREFIX}sb-project-auth-token.0`)
  assert.equal(mapped.options?.['httpOnly'], true)
  assert.equal(mapped.options?.['sameSite'], 'lax')
  assert.equal(mapped.options?.['path'], '/')
  assert.equal(Object.hasOwn(mapped.options ?? {}, 'domain'), false)
})

test('only isolated Supabase cookies are exposed to the menu auth client', () => {
  assert.deepEqual(readMenuAuthCookies([
    { name: 'sb-dashboard-auth-token', value: 'dashboard' },
    { name: CUSTOMER_AUTH_INTENT_COOKIE, value: 'intent' },
    { name: `${MENU_AUTH_COOKIE_PREFIX}sb-menu-auth-token`, value: 'menu' },
  ]), [{ name: 'sb-menu-auth-token', value: 'menu' }])
})
