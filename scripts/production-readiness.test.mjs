import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { DEV_PROJECT_REF, migrationInventory, parseEnv, validateProductionConfig } from './production-readiness.mjs'

const PROD_REF = 'svxvloeosiksqfadgkvo'
const LONG = 'x'.repeat(40)

function baseDashboard(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${LONG}`,
    SUPABASE_SERVICE_ROLE_KEY: `service-${LONG}`,
    NEXT_PUBLIC_APP_URL: 'https://app.masabu.co',
    NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
    NEXT_PUBLIC_MENU_BASE_URL: 'https://menu.masabu.co',
    KITCHEN_URL: 'https://kds.masabu.co',
    NEXT_PUBLIC_KITCHEN_URL: 'https://kds.masabu.co',
    OUTBOX_WORKER_SECRET: LONG,
    RESEND_API_KEY: `re_${LONG}`,
    RESEND_FROM_EMAIL: 'Masabu <noreply@masabu.co>',
    RESEND_STANDS_TO_EMAIL: 'stands@masabu.co',
    SAAS_BILLING_SALES_ENABLED: 'false',
    ACCOUNTING_DISPATCH_ENABLED: 'false',
    ...overrides,
  }
}

function baseMenu(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${LONG}`,
    SUPABASE_SERVICE_ROLE_KEY: `service-${LONG}`,
    NEXT_PUBLIC_APP_URL: 'https://menu.masabu.co',
    NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
    OUTBOX_WORKER_SECRET: LONG,
    CUSTOMER_AUTH_PHONE_OTP_ENABLED: 'false',
    ...overrides,
  }
}

function basePlatformAdmin(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon-${LONG}`,
    SUPABASE_SERVICE_ROLE_KEY: `service-${LONG}`,
    SAAS_BILLING_FINANCIAL_OPS_ENABLED: 'false',
    ...overrides,
  }
}

function billing(overrides = {}) {
  return {
    SAAS_BILLING_SALES_ENABLED: 'true',
    IYZICO_BILLING_MERCHANT_ID: 'merchant-live',
    IYZICO_BILLING_API_KEY: LONG,
    IYZICO_BILLING_SECRET_KEY: LONG,
    IYZICO_BILLING_BASE_URL: 'https://api.iyzipay.com',
    INVOICE_VAT_RATE: '20',
    IYZICO_BILLING_STARTER_MONTHLY_PLAN_REF: 'starter-monthly-live',
    IYZICO_BILLING_STARTER_MONTHLY_AMOUNT_MINOR: '41880',
    IYZICO_BILLING_STARTER_ANNUAL_PLAN_REF: 'starter-annual-live',
    IYZICO_BILLING_STARTER_ANNUAL_AMOUNT_MINOR: '402048',
    IYZICO_BILLING_PLUS_MONTHLY_PLAN_REF: 'plus-monthly-live',
    IYZICO_BILLING_PLUS_MONTHLY_AMOUNT_MINOR: '83880',
    IYZICO_BILLING_PLUS_ANNUAL_PLAN_REF: 'plus-annual-live',
    IYZICO_BILLING_PLUS_ANNUAL_AMOUNT_MINOR: '805248',
    IYZICO_BILLING_PRO_MONTHLY_PLAN_REF: 'pro-monthly-live',
    IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR: '143880',
    IYZICO_BILLING_PRO_ANNUAL_PLAN_REF: 'pro-annual-live',
    IYZICO_BILLING_PRO_ANNUAL_AMOUNT_MINOR: '1381248',
    IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_PLAN_REF: 'pro-iyzico-monthly-live',
    IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_ADDON_NET_AMOUNT_MINOR: '30000',
    IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_AMOUNT_MINOR: '179880',
    IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_PLAN_REF: 'pro-iyzico-annual-live',
    IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_ADDON_NET_AMOUNT_MINOR: '288000',
    IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_AMOUNT_MINOR: '1726848',
    IYZICO_BILLING_STARTER_VIDEO_HERO_MONTHLY_PLAN_REF: 'starter-video-monthly-live',
    IYZICO_BILLING_STARTER_VIDEO_HERO_MONTHLY_ADDON_NET_AMOUNT_MINOR: '3900',
    IYZICO_BILLING_STARTER_VIDEO_HERO_MONTHLY_AMOUNT_MINOR: '46560',
    IYZICO_BILLING_STARTER_VIDEO_HERO_ANNUAL_PLAN_REF: 'starter-video-annual-live',
    IYZICO_BILLING_STARTER_VIDEO_HERO_ANNUAL_ADDON_NET_AMOUNT_MINOR: '37440',
    IYZICO_BILLING_STARTER_VIDEO_HERO_ANNUAL_AMOUNT_MINOR: '446976',
    IYZICO_BILLING_PLUS_VIDEO_HERO_MONTHLY_PLAN_REF: 'plus-video-monthly-live',
    IYZICO_BILLING_PLUS_VIDEO_HERO_MONTHLY_ADDON_NET_AMOUNT_MINOR: '3900',
    IYZICO_BILLING_PLUS_VIDEO_HERO_MONTHLY_AMOUNT_MINOR: '88560',
    IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_PLAN_REF: 'plus-video-annual-live',
    IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_ADDON_NET_AMOUNT_MINOR: '37440',
    IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_AMOUNT_MINOR: '850176',
    ...overrides,
  }
}

function subscriptionRefunds(overrides = {}) {
  return {
    SAAS_BILLING_FINANCIAL_OPS_ENABLED: 'true',
    IYZICO_BILLING_API_KEY: LONG,
    IYZICO_BILLING_SECRET_KEY: LONG,
    IYZICO_BILLING_BASE_URL: 'https://api.iyzipay.com',
    ...overrides,
  }
}

function accounting(overrides = {}) {
  return {
    ACCOUNTING_DISPATCH_ENABLED: 'true',
    ACCOUNTING_WORKER_SECRET: `accounting-${LONG}`,
    ACCOUNTING_WORKER_URL: 'https://app.masabu.co/api/internal/accounting-invoices',
    PARASUT_CLIENT_ID: 'parasut-client-live',
    PARASUT_CLIENT_SECRET: `parasut-${LONG}`,
    PARASUT_COMPANY_ID: 'company-live',
    PARASUT_PRODUCT_ID: 'product-live',
    PARASUT_API_BASE_URL: 'https://api.parasut.com',
    PARASUT_INTERNET_SALE_URL: 'https://masabu.co',
    INVOICE_VAT_RATE: '20',
    INVOICE_SERVICE_NAME: 'Masabu abonelik hizmeti',
    ...overrides,
  }
}

function customerPhoneMenu(overrides = {}) {
  return {
    CUSTOMER_AUTH_PHONE_OTP_ENABLED: 'true',
    CUSTOMER_AUTH_STATE_KEYS: JSON.stringify({ active: 'v1', keys: { v1: LONG } }),
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: `site-${LONG}`,
    RECAPTCHA_SECRET_KEY: `recaptcha-${LONG}`,
    ...overrides,
  }
}

function sendSmsHook(overrides = {}) {
  return {
    SEND_SMS_HOOK_SECRETS: `v1,whsec_${LONG}`,
    NETGSM_USERCODE: '8500000000',
    NETGSM_PASSWORD: LONG,
    NETGSM_MSGHEADER: 'MASABU',
    ...overrides,
  }
}

test('env parser handles export, quotes, comments and equals characters', () => {
  assert.deepEqual(parseEnv(`\n# comment\nexport A="one=two"\nB=value # note\nC='space value'\n`), {
    A: 'one=two', B: 'value', C: 'space value',
  })
})

test('core deployment scopes pass with every optional operation explicitly disabled', () => {
  for (const [scope, env] of [
    ['dashboard', baseDashboard()],
    ['menu', baseMenu()],
    ['platform-admin', basePlatformAdmin()],
  ]) {
    const result = validateProductionConfig({ env, scopes: [scope], projectRef: PROD_REF })
    assert.equal(result.ok, true, `${scope}: ${JSON.stringify(result.errors)}`)
    assert.deepEqual(result.errors, [])
  }
  const smsHook = validateProductionConfig({ env: {}, scopes: ['send-sms-hook'] })
  assert.equal(smsHook.ok, true)
  assert.ok(smsHook.warnings.some((warning) => warning.key === 'customer-phone-auth'))
})

test('split capability flags are mandatory and the legacy billing flag cannot satisfy preflight', () => {
  const legacyOnly = validateProductionConfig({
    env: baseDashboard({ SAAS_BILLING_SALES_ENABLED: undefined, SAAS_BILLING_ENABLED: 'false' }),
    scopes: ['dashboard'], projectRef: PROD_REF,
  })
  assert.ok(legacyOnly.errors.some((error) => (
    error.code === 'MAS-DEP-001' && error.key === 'SAAS_BILLING_SALES_ENABLED'
  )))

  const dashboard = validateProductionConfig({
    env: baseDashboard({ ACCOUNTING_DISPATCH_ENABLED: undefined }),
    scopes: ['dashboard'], projectRef: PROD_REF,
  })
  assert.ok(dashboard.errors.some((error) => error.key === 'ACCOUNTING_DISPATCH_ENABLED'))

  const platformAdmin = validateProductionConfig({
    env: basePlatformAdmin({ SAAS_BILLING_FINANCIAL_OPS_ENABLED: undefined }),
    scopes: ['platform-admin'], projectRef: PROD_REF,
  })
  assert.ok(platformAdmin.errors.some((error) => error.key === 'SAAS_BILLING_FINANCIAL_OPS_ENABLED'))

  const menu = validateProductionConfig({
    env: baseMenu({ CUSTOMER_AUTH_PHONE_OTP_ENABLED: undefined }),
    scopes: ['menu'], projectRef: PROD_REF,
  })
  assert.ok(menu.errors.some((error) => error.key === 'CUSTOMER_AUTH_PHONE_OTP_ENABLED'))
})

test('unselected capabilities reject true or malformed switches', () => {
  const dashboard = validateProductionConfig({
    env: baseDashboard({ SAAS_BILLING_SALES_ENABLED: 'true', ACCOUNTING_DISPATCH_ENABLED: 'yes' }),
    scopes: ['dashboard'], projectRef: PROD_REF,
  })
  assert.ok(dashboard.errors.some((error) => error.key === 'SAAS_BILLING_SALES_ENABLED'))
  assert.ok(dashboard.errors.some((error) => error.key === 'ACCOUNTING_DISPATCH_ENABLED'))

  const platformAdmin = validateProductionConfig({
    env: basePlatformAdmin({ SAAS_BILLING_FINANCIAL_OPS_ENABLED: 'true' }),
    scopes: ['platform-admin'], projectRef: PROD_REF,
  })
  assert.ok(platformAdmin.errors.some((error) => error.key === 'SAAS_BILLING_FINANCIAL_OPS_ENABLED'))

  const menu = validateProductionConfig({
    env: baseMenu({ CUSTOMER_AUTH_PHONE_OTP_ENABLED: 'true' }),
    scopes: ['menu'], projectRef: PROD_REF,
  })
  assert.ok(menu.errors.some((error) => error.key === 'CUSTOMER_AUTH_PHONE_OTP_ENABLED'))
})

test('missing, placeholder, insecure and weak values fail with public deploy codes', () => {
  const result = validateProductionConfig({
    env: baseDashboard({
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      RESEND_API_KEY: '<prod-resend-key>',
      OUTBOX_WORKER_SECRET: 'short',
      RESEND_STANDS_TO_EMAIL: '',
    }),
    scopes: ['dashboard'], projectRef: PROD_REF,
  })
  assert.equal(result.ok, false)
  assert.deepEqual(new Set(result.errors.map((error) => error.code)), new Set([
    'MAS-DEP-001', 'MAS-DEP-002', 'MAS-DEP-003', 'MAS-DEP-005',
  ]))
})

test('DEV Supabase project and mismatched production project are rejected', () => {
  const dev = validateProductionConfig({
    env: baseDashboard({ NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_PROJECT_REF}.supabase.co` }),
    scopes: ['dashboard'], projectRef: DEV_PROJECT_REF,
  })
  assert.ok(dev.errors.some((error) => error.code === 'MAS-DEP-004'))

  const mismatch = validateProductionConfig({
    env: baseDashboard(), scopes: ['dashboard'], projectRef: 'aaaaaaaaaaaaaaaaaaaa',
  })
  assert.ok(mismatch.errors.some((error) => (
    error.key === 'NEXT_PUBLIC_SUPABASE_URL' && error.code === 'MAS-DEP-004'
  )))
})

test('SaaS billing validates the complete set of 12 live provider products', () => {
  const result = validateProductionConfig({
    env: { ...baseDashboard(), ...billing() },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.deepEqual(result.errors, [])

  const missingExactKey = validateProductionConfig({
    env: {
      ...baseDashboard(),
      ...billing({ IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_ADDON_NET_AMOUNT_MINOR: '' }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.ok(missingExactKey.errors.some((error) => (
    error.code === 'MAS-DEP-001'
      && error.key === 'IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_ADDON_NET_AMOUNT_MINOR'
  )))
})

test('SaaS billing rejects sandbox origin only when the sales capability is enabled', () => {
  const deferred = validateProductionConfig({
    env: baseDashboard({ IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com' }),
    scopes: ['dashboard'], projectRef: PROD_REF,
  })
  assert.equal(deferred.ok, true)

  const enabled = validateProductionConfig({
    env: {
      ...baseDashboard(),
      ...billing({ IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com' }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.ok(enabled.errors.some((error) => error.key === 'IYZICO_BILLING_BASE_URL'))
})

test('SaaS billing rejects duplicate refs, unsafe amounts and non-origin callbacks', () => {
  const result = validateProductionConfig({
    env: {
      ...baseDashboard({ NEXT_PUBLIC_APP_URL: 'https://app.masabu.co/dashboard?source=deploy' }),
      ...billing({
        IYZICO_BILLING_PLUS_VIDEO_HERO_MONTHLY_PLAN_REF: 'starter-monthly-live',
        IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR: '29.99',
        IYZICO_BILLING_PRO_ANNUAL_AMOUNT_MINOR: '9007199254740992',
      }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.key === 'IYZICO_BILLING_*_PLAN_REF'))
  assert.ok(result.errors.some((error) => error.key === 'IYZICO_BILLING_PRO_MONTHLY_AMOUNT_MINOR'))
  assert.ok(result.errors.some((error) => error.key === 'IYZICO_BILLING_PRO_ANNUAL_AMOUNT_MINOR'))
  assert.ok(result.errors.some((error) => error.key === 'NEXT_PUBLIC_APP_URL'))
})

test('SaaS billing requires canonical add-on nets and combined plan/add-on gross totals', () => {
  const invalidNet = validateProductionConfig({
    env: {
      ...baseDashboard(),
      ...billing({ IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_ADDON_NET_AMOUNT_MINOR: '30001' }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.ok(invalidNet.errors.some((error) => (
    error.key === 'IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_ADDON_NET_AMOUNT_MINOR'
  )))

  const unsafeNet = validateProductionConfig({
    env: {
      ...baseDashboard(),
      ...billing({ IYZICO_BILLING_STARTER_VIDEO_HERO_MONTHLY_ADDON_NET_AMOUNT_MINOR: '3.9' }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.ok(unsafeNet.errors.some((error) => (
    error.key === 'IYZICO_BILLING_STARTER_VIDEO_HERO_MONTHLY_ADDON_NET_AMOUNT_MINOR'
  )))

  const invalidGross = validateProductionConfig({
    env: {
      ...baseDashboard(),
      ...billing({ IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_AMOUNT_MINOR: '850177' }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.ok(invalidGross.errors.some((error) => (
    error.key === 'IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_AMOUNT_MINOR'
  )))
})

test('SaaS billing capability requires its new sales flag regardless of the legacy fallback', () => {
  const disabled = validateProductionConfig({
    env: {
      ...baseDashboard(),
      ...billing({ SAAS_BILLING_SALES_ENABLED: 'false', SAAS_BILLING_ENABLED: 'true' }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.ok(disabled.errors.some((error) => error.key === 'SAAS_BILLING_SALES_ENABLED'))
})

test('subscription refunds have an independent platform-admin flag and live provider contract', () => {
  const complete = validateProductionConfig({
    env: { ...basePlatformAdmin(), ...subscriptionRefunds() },
    scopes: ['platform-admin'], capabilities: ['subscription-refunds'], projectRef: PROD_REF,
  })
  assert.equal(complete.ok, true, JSON.stringify(complete.errors))

  const disabled = validateProductionConfig({
    env: {
      ...basePlatformAdmin(),
      ...subscriptionRefunds({ SAAS_BILLING_FINANCIAL_OPS_ENABLED: 'false' }),
    },
    scopes: ['platform-admin'], capabilities: ['subscription-refunds'], projectRef: PROD_REF,
  })
  assert.ok(disabled.errors.some((error) => error.key === 'SAAS_BILLING_FINANCIAL_OPS_ENABLED'))

  const sandbox = validateProductionConfig({
    env: {
      ...basePlatformAdmin(),
      ...subscriptionRefunds({ IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com' }),
    },
    scopes: ['platform-admin'], capabilities: ['subscription-refunds'], projectRef: PROD_REF,
  })
  assert.ok(sandbox.errors.some((error) => error.key === 'IYZICO_BILLING_BASE_URL'))

  const deferred = validateProductionConfig({
    env: basePlatformAdmin({ IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com' }),
    scopes: ['platform-admin'], projectRef: PROD_REF,
  })
  assert.equal(deferred.ok, true)
})

test('accounting requires the dispatch flag, complete Paraşüt contract and live API origin', () => {
  const complete = validateProductionConfig({
    env: { ...baseDashboard(), ...accounting() },
    scopes: ['dashboard'], capabilities: ['accounting'], projectRef: PROD_REF,
  })
  assert.equal(complete.ok, true, JSON.stringify(complete.errors))

  const disabled = validateProductionConfig({
    env: { ...baseDashboard(), ...accounting({ ACCOUNTING_DISPATCH_ENABLED: 'false' }) },
    scopes: ['dashboard'], capabilities: ['accounting'], projectRef: PROD_REF,
  })
  assert.ok(disabled.errors.some((error) => error.key === 'ACCOUNTING_DISPATCH_ENABLED'))

  const incomplete = validateProductionConfig({
    env: { ...baseDashboard(), ...accounting({ PARASUT_PRODUCT_ID: '' }) },
    scopes: ['dashboard'], capabilities: ['accounting'], projectRef: PROD_REF,
  })
  assert.ok(incomplete.errors.some((error) => error.key === 'PARASUT_PRODUCT_ID'))

  const sandbox = validateProductionConfig({
    env: { ...baseDashboard(), ...accounting({ PARASUT_API_BASE_URL: 'https://sandbox.parasut.com' }) },
    scopes: ['dashboard'], capabilities: ['accounting'], projectRef: PROD_REF,
  })
  assert.ok(sandbox.errors.some((error) => error.key === 'PARASUT_API_BASE_URL'))

  const deferred = validateProductionConfig({
    env: baseDashboard({ PARASUT_API_BASE_URL: 'https://sandbox.parasut.com' }),
    scopes: ['dashboard'], projectRef: PROD_REF,
  })
  assert.equal(deferred.ok, true)
})

test('customer phone auth validates menu and send-sms-hook values in their own scopes', () => {
  const complete = validateProductionConfig({
    env: { ...baseMenu(), ...customerPhoneMenu(), ...sendSmsHook() },
    scopes: ['menu', 'send-sms-hook'], capabilities: ['customer-phone-auth'], projectRef: PROD_REF,
  })
  assert.equal(complete.ok, true, JSON.stringify(complete.errors))

  const menuDisabled = validateProductionConfig({
    env: {
      ...baseMenu(),
      ...customerPhoneMenu({ CUSTOMER_AUTH_PHONE_OTP_ENABLED: 'false' }),
    },
    scopes: ['menu'], capabilities: ['customer-phone-auth'], projectRef: PROD_REF,
  })
  assert.ok(menuDisabled.errors.some((error) => error.key === 'CUSTOMER_AUTH_PHONE_OTP_ENABLED'))

  const hookMissingSecret = validateProductionConfig({
    env: sendSmsHook({ SEND_SMS_HOOK_SECRETS: '' }),
    scopes: ['send-sms-hook'], capabilities: ['customer-phone-auth'],
  })
  assert.ok(hookMissingSecret.errors.some((error) => error.key === 'SEND_SMS_HOOK_SECRETS'))
  assert.equal(hookMissingSecret.errors.some((error) => error.key === 'CUSTOMER_AUTH_STATE_KEYS'), false)
})

test('capabilities cannot silently pass under an unrelated scope', () => {
  const result = validateProductionConfig({
    env: baseMenu(), scopes: ['menu'], capabilities: ['subscription-refunds'], projectRef: PROD_REF,
  })
  assert.ok(result.errors.some((error) => error.key === 'capability'))
})

test('production env template documents all flags and all 12 product bindings without enabling them', () => {
  const template = readFileSync(new URL('../.env.production.example', import.meta.url), 'utf8')
  assert.match(template, /^SAAS_BILLING_SALES_ENABLED=false$/m)
  assert.match(template, /^SAAS_BILLING_FINANCIAL_OPS_ENABLED=false$/m)
  assert.match(template, /^ACCOUNTING_DISPATCH_ENABLED=false$/m)
  assert.match(template, /^CUSTOMER_AUTH_PHONE_OTP_ENABLED=false$/m)
  assert.match(template, /^IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY_ADDON_NET_AMOUNT_MINOR=30000$/m)
  assert.match(template, /^IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL_ADDON_NET_AMOUNT_MINOR=288000$/m)
  assert.match(template, /^IYZICO_BILLING_STARTER_VIDEO_HERO_MONTHLY_ADDON_NET_AMOUNT_MINOR=3900$/m)
  assert.match(template, /^IYZICO_BILLING_PLUS_VIDEO_HERO_ANNUAL_ADDON_NET_AMOUNT_MINOR=37440$/m)
  assert.match(template, /^SEND_SMS_HOOK_SECRETS=/m)
  assert.equal((template.match(/^IYZICO_BILLING_.*_PLAN_REF=/gm) ?? []).length, 12)
})

test('Web Push production template and capability require a complete VAPID identity', () => {
  const template = readFileSync(new URL('../.env.production.example', import.meta.url), 'utf8')
  assert.match(template, /^NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=/m)
  assert.match(template, /^WEB_PUSH_VAPID_PRIVATE_KEY=/m)
  assert.match(template, /^WEB_PUSH_SUBJECT=mailto:/m)
  assert.match(template, /^OUTBOX_PUSH_CONSUMER_URL=https:\/\/app\.masabu\.co\/api\/internal\/push/m)

  const complete = validateProductionConfig({
    env: {
      ...baseDashboard(),
      NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: `public-${LONG}`,
      WEB_PUSH_VAPID_PRIVATE_KEY: `private-${LONG}`,
      WEB_PUSH_SUBJECT: 'mailto:ops@masabu.co',
      OUTBOX_PUSH_CONSUMER_URL: 'https://app.masabu.co/api/internal/push',
    },
    scopes: ['dashboard'], capabilities: ['web-push'], projectRef: PROD_REF,
  })
  assert.equal(complete.ok, true)

  const missingVapid = validateProductionConfig({
    env: { ...baseDashboard(), OUTBOX_PUSH_CONSUMER_URL: 'https://app.masabu.co/api/internal/push' },
    scopes: ['dashboard'], capabilities: ['web-push'], projectRef: PROD_REF,
  })
  assert.equal(missingVapid.ok, false)
  assert.ok(missingVapid.errors.some((error) => error.key === 'NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY'))
})

test('migration inventory is ordered and has no duplicate timestamps', () => {
  const inventory = migrationInventory()
  assert.ok(inventory.count > 0)
  assert.match(inventory.first, /^\d{14}_/)
  assert.match(inventory.latest, /^\d{14}_/)
  assert.deepEqual(inventory.duplicates, [])
})

test('outbox worker validates the Edge runtime SUPABASE_URL contract', () => {
  const env = {
    SUPABASE_URL: `https://${PROD_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: `service-${LONG}`,
    OUTBOX_WORKER_SECRET: LONG,
    OUTBOX_CONSUMER_URL: 'https://app.masabu.co/api/internal/outbox',
    OUTBOX_PUSH_CONSUMER_URL: 'https://app.masabu.co/api/internal/push',
    OUTBOX_INBOX_CONSUMER_URL: 'https://app.masabu.co/api/internal/inbox',
    OUTBOX_EMAIL_CONSUMER_URL: 'https://app.masabu.co/api/internal/notification-email',
    PAYMENT_RECONCILIATION_URL: 'https://menu.masabu.co/api/internal/payment-reconciliation',
    BILLING_MAINTENANCE_URL: 'https://app.masabu.co/api/internal/billing-maintenance',
  }
  const result = validateProductionConfig({ env, scopes: ['outbox-worker'], projectRef: PROD_REF })
  assert.equal(result.ok, true)
  assert.equal(result.errors.some((error) => error.key === 'NEXT_PUBLIC_SUPABASE_URL'), false)

  const mismatch = validateProductionConfig({
    env: { ...env, SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co' },
    scopes: ['outbox-worker'], projectRef: PROD_REF,
  })
  assert.ok(mismatch.errors.some((error) => error.code === 'MAS-DEP-004'))
})
