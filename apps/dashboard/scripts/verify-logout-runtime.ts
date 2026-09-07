import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
const require = createRequire(import.meta.url)
const { encodeReply } = require('next/dist/compiled/react-server-dom-webpack/client.node') as { encodeReply: (v: unknown) => Promise<FormData | string> }
const api = process.env['NEXT_PUBLIC_SUPABASE_URL']!
assert.equal(api, 'http://127.0.0.1:55321', 'Isolated local database only')
const app = 'http://localhost:3002'
const admin = createClient(api, process.env['SUPABASE_SERVICE_ROLE_KEY']!, { auth: { persistSession: false, autoRefreshToken: false } })
const email = 'logout-' + randomUUID() + '@example.test'
const made = await admin.auth.admin.createUser({ email, password: 'Aa1!test-password', email_confirm: true })
assert.ifError(made.error)
const user = made.data.user!
const jar = new Map<string, string>()
const client = createServerClient(api, process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!, { cookies: {
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  setAll: (values: Array<{ name: string; value: string }>) => { for (const v of values) jar.set(v.name, v.value) },
} })
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(app + path, { ...options, redirect: 'manual', headers: { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '), 'User-Agent': 'Masabu logout runtime', ...options.headers } })
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]!, index = pair.indexOf('=')
    jar.set(pair.slice(0, index), pair.slice(index + 1))
  }
  return response
}
function actionId(name: string) {
  const manifest = JSON.parse(readFileSync('.next-auth-audit/server/server-reference-manifest.json', 'utf8'))
  const id = Object.keys(manifest.node).find(k => manifest.node[k].exportedName === name)
  assert.ok(id, 'Compiled action: ' + name)
  return id
}
const renderAudit = process.argv.includes('--render-after-logout')
const auditDirectory = 'app/dashboard/[restaurantId]/logout-render-audit'
if (renderAudit) {
  assert.equal(existsSync(auditDirectory), false, 'Never overwrite an existing route')
  mkdirSync(auditDirectory)
  writeFileSync(auditDirectory + '/actions.ts', `
'use server'
import { signOut } from '../../../../lib/actions/auth'
export async function logoutForRuntime() { await signOut(null) }
`)
  writeFileSync(auditDirectory + '/page.tsx', `
import { logoutForRuntime } from './actions'
export default function LogoutRenderAudit() {
  return <form action={logoutForRuntime}><button>Logout runtime</button></form>
}
`)
}
try {
  const restaurant = await admin.from('restaurants').insert({ name: 'Logout runtime', slug: 'logout-' + randomUUID(), owner_id: user.id, plan: 'pro' }).select('id').single()
  assert.ifError(restaurant.error)
  const path = '/dashboard/' + restaurant.data!.id + (renderAudit ? '/logout-render-audit' : '')
  await request('/auth/confirm?flow=magiclink')
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  assert.ifError(link.error)
  const form = new FormData()
  form.set('token_hash', link.data.properties!.hashed_token)
  form.set('flow', 'magiclink')
  form.set('next', path)
  const verified = await request('/auth/confirm?flow=magiclink', { method: 'POST', headers: { Origin: app, 'Next-Action': actionId('verifyEmailToken') }, body: await encodeReply([null, form]) })
  assert.ok(verified.headers.get('x-action-redirect'), 'Native verification succeeds')
  const page = await request(path)
  assert.equal(page.status, 200)
  await page.text()
  const { data: { session } } = await client.auth.getSession()
  assert.ok(session)
  if (process.argv.includes('--baseline') || process.argv.includes('--render-after-logout')) {
    const response = await request(path, { method: 'POST', headers: { Origin: app, 'Next-Action': actionId(renderAudit ? 'logoutForRuntime' : 'signOut') }, body: await encodeReply(renderAudit ? [] : [null]) })
    const body = await response.text()
    assert.notEqual(response.status, 404, 'Test action must execute on the current deployment')
    if (process.argv.includes('--render-after-logout')) {
      assert.ok(!body.includes('NEXT_HTTP_ERROR_FALLBACK;404'), 'Re-render after session mutation must not return a 404')
      assert.match(body, /NEXT_REDIRECT.*auth\/login/, 'Unauthenticated re-render redirects to login')
      console.log('PASS: protected server re-render after session deletion redirects to login without a 404')
    }
    console.log(JSON.stringify({ status: response.status, contentType: response.headers.get('content-type'), notFoundRerender: body.includes('NEXT_HTTP_ERROR_FALLBACK;404'), errorRerender: /:E\{/.test(body), success: body.includes('"success":true'), actionRedirect: response.headers.get('x-action-redirect') }))
  } else {
    const rejected = await request('/auth/logout', { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: null }) })
    assert.equal(rejected.status, 403)
    assert.equal((await request(path)).status, 200, 'Rejected cross-origin request keeps session')
    const get = await request('/auth/logout')
    assert.equal(get.status, 405, 'GET never logs out')
    const malformed = await request('/auth/logout', { method: 'POST', headers: { Origin: app, 'Content-Type': 'application/json' }, body: '{' })
    assert.equal(malformed.status, 400)
    const response = await request('/auth/logout', { method: 'POST', headers: { Origin: app, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: null }) })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type')!, /application\/json/)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await response.json(), { success: true }, 'No protected RSC tree returned during logout')
    const protectedPage = await request(path)
    assert.equal(protectedPage.status, 307)
    assert.match(protectedPage.headers.get('location')!, /\/auth\/login/)
    const refresh = await fetch(api + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) })
    assert.equal(refresh.status, 400, 'Session really revoked')
    const repeated = await request('/auth/logout', { method: 'POST', headers: { Origin: app, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: null }) })
    assert.equal(repeated.status, 200, 'Already logged-out request is safe')
    console.log('PASS: protected page logout returns JSON without an error tree, clears cookies, revokes session, redirects subsequent access, rejects foreign origins/GET/malformed JSON, supports repeat logout')
  }
} finally {
  if (renderAudit) rmSync(auditDirectory, { recursive: true })
  await admin.from('restaurants').delete().eq('owner_id', user.id)
  await admin.auth.admin.deleteUser(user.id)
}
