import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePlatformAdminAuthCookieName } from './auth-cookie'

test('platform admin uses a project-scoped cookie distinct from the dashboard default', () => {
  const projectRef = 'yxsegwkzyiscrxiwdeuf'
  const cookieName = resolvePlatformAdminAuthCookieName(`https://${projectRef}.supabase.co`)

  assert.equal(cookieName, `sb-${projectRef}-platform-admin-auth-token`)
  assert.notEqual(cookieName, `sb-${projectRef}-auth-token`)
})

test('different Supabase projects receive different platform admin cookies', () => {
  assert.notEqual(
    resolvePlatformAdminAuthCookieName('https://yxsegwkzyiscrxiwdeuf.supabase.co'),
    resolvePlatformAdminAuthCookieName('https://production-project.supabase.co'),
  )
})

test('invalid Supabase URLs cannot become cookie names', () => {
  assert.throws(() => resolvePlatformAdminAuthCookieName('not-a-url'))
})
