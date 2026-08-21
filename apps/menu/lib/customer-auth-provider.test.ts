import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { availableCustomerAuthCapabilities, availableCustomerAuthProviders } from './customer-auth-provider.ts'

const previous = {
  nodeEnv: process.env.NODE_ENV,
  enabled: process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS'],
  email: process.env['CUSTOMER_AUTH_EMAIL_OTP_ENABLED'],
  phone: process.env['CUSTOMER_AUTH_PHONE_OTP_ENABLED'],
  url: process.env['NEXT_PUBLIC_SUPABASE_URL'],
  key: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
}
const mutableEnv = process.env as Record<string, string | undefined>

test.after(() => {
  if (previous.nodeEnv === undefined) delete mutableEnv['NODE_ENV']
  else mutableEnv['NODE_ENV'] = previous.nodeEnv
  if (previous.enabled === undefined) delete process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS']
  else process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS'] = previous.enabled
  if (previous.email === undefined) delete process.env['CUSTOMER_AUTH_EMAIL_OTP_ENABLED']
  else process.env['CUSTOMER_AUTH_EMAIL_OTP_ENABLED'] = previous.email
  if (previous.phone === undefined) delete process.env['CUSTOMER_AUTH_PHONE_OTP_ENABLED']
  else process.env['CUSTOMER_AUTH_PHONE_OTP_ENABLED'] = previous.phone
  if (previous.url === undefined) delete process.env['NEXT_PUBLIC_SUPABASE_URL']
  else process.env['NEXT_PUBLIC_SUPABASE_URL'] = previous.url
  if (previous.key === undefined) delete process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  else process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = previous.key
})

test('provider visibility intersects the explicit allowlist with hosted settings', async () => {
  mutableEnv['NODE_ENV'] = 'production'
  process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS'] = 'facebook, google,unsupported,apple,google'
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://project.supabase.co'
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'public-test-key'

  let requestUrl = ''
  let requestKey = ''
  const providers = await availableCustomerAuthProviders(async (input, init) => {
    requestUrl = input.toString()
    requestKey = new Headers(init?.headers).get('apikey') ?? ''
    return Response.json({
      external: { google: true, apple: true, facebook: false },
    })
  })

  assert.deepEqual(providers, ['google', 'apple'])
  assert.equal(requestUrl, 'https://project.supabase.co/auth/v1/settings')
  assert.equal(requestKey, 'public-test-key')
})

test('production provider visibility fails closed without an explicit allowlist', async () => {
  mutableEnv['NODE_ENV'] = 'production'
  delete process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS']
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://project.supabase.co'
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'public-test-key'

  let called = false
  const providers = await availableCustomerAuthProviders(async () => {
    called = true
    return Response.json({ external: { google: true } })
  })

  assert.deepEqual(providers, [])
  assert.equal(called, false)
})

test('provider availability failure hides social options', async () => {
  mutableEnv['NODE_ENV'] = 'production'
  process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS'] = 'google'
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://project.supabase.co'
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'public-test-key'

  const providers = await availableCustomerAuthProviders(async () => {
    throw new Error('unavailable')
  })
  assert.deepEqual(providers, [])
})

test('phone OTP is an independent fail-closed capability', async () => {
  mutableEnv['NODE_ENV'] = 'production'
  process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS'] = 'google,apple'
  process.env['CUSTOMER_AUTH_PHONE_OTP_ENABLED'] = 'true'
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://project.supabase.co'
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'public-test-key'
  const capabilities = await availableCustomerAuthCapabilities(async () => Response.json({
    external: { google: true, apple: false },
  }))
  assert.deepEqual(capabilities, { emailOtp: true, phoneOtp: true, oauth: { google: true, apple: false } })
})

test('email OTP can be hidden independently without invalidating existing sessions', async () => {
  process.env['CUSTOMER_AUTH_EMAIL_OTP_ENABLED'] = 'false'
  const capabilities = await availableCustomerAuthCapabilities(async () => new Response(JSON.stringify({ external: {} }), { status: 200 }))
  assert.equal(capabilities.emailOtp, false)
})

test('server pages pass verified providers and the sheet renders only that list', () => {
  const route = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  const menuPage = route('../app/[slug]/page.tsx')
  const experienceRoute = route('../app/[slug]/_menu-experience.tsx')
  const tablePage = route('../app/[slug]/table/[tableId]/page.tsx')
  const client = route('../app/[slug]/MenuPageClient.tsx')
  const sheet = route('../app/[slug]/components/MemberSheet.tsx')
  const oauthRoute = route('../app/api/customer-auth/oauth/start/route.ts')

  assert.match(menuPage, /renderMenuExperience/)
  assert.match(experienceRoute, /availableCustomerAuthCapabilities\(\)/)
  assert.match(tablePage, /availableCustomerAuthCapabilities\(\)/)
  assert.match(client, /oauthProviders=\{customerAuthProviders\}/)
  assert.match(client, /emailOtpEnabled=\{emailOtpEnabled\}/)
  assert.match(client, /phoneOtpEnabled=\{phoneOtpEnabled\}/)
  assert.match(sheet, /oauthProviders\.map\(\(provider\)/)
  assert.match(sheet, /PROVIDER_LABELS\[provider\]/)
  assert.doesNotMatch(sheet, /> Google ile devam et</)
  assert.match(oauthRoute, /await availableCustomerAuthProviders\(\)/)
  assert.match(oauthRoute, /availableProviders\.includes\(parsed\.data\.provider\)/)
})
