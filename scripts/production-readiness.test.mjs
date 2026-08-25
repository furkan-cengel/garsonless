import assert from 'node:assert/strict'
import test from 'node:test'
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
    SAAS_BILLING_ENABLED: 'false',
    ...overrides,
  }
}

function billing(overrides = {}) {
  return {
    SAAS_BILLING_ENABLED: 'true',
    IYZICO_BILLING_MERCHANT_ID: 'merchant-live',
    IYZICO_BILLING_API_KEY: LONG,
    IYZICO_BILLING_SECRET_KEY: LONG,
    IYZICO_BILLING_BASE_URL: 'https://api.iyzipay.com',
    IYZICO_BILLING_STARTER_PLAN_REF: 'starter-live',
    IYZICO_BILLING_STARTER_AMOUNT_MINOR: '14990',
    IYZICO_BILLING_PRO_PLAN_REF: 'pro-live',
    IYZICO_BILLING_PRO_AMOUNT_MINOR: '29990',
    IYZICO_BILLING_ENTERPRISE_PLAN_REF: 'enterprise-live',
    IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR: '59990',
    ...overrides,
  }
}

test('env parser handles export, quotes, comments and equals characters', () => {
  assert.deepEqual(parseEnv(`\n# comment\nexport A="one=two"\nB=value # note\nC='space value'\n`), {
    A: 'one=two', B: 'value', C: 'space value',
  })
})

test('core dashboard production contract passes without deferred capabilities', () => {
  const result = validateProductionConfig({ env: baseDashboard(), scopes: ['dashboard'], projectRef: PROD_REF })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((warning) => warning.key === 'saas-billing'))
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
  assert.deepEqual(new Set(result.errors.map((error) => error.code)), new Set(['MAS-DEP-001', 'MAS-DEP-002', 'MAS-DEP-003', 'MAS-DEP-005']))
})

test('DEV Supabase project and mismatched production project are rejected', () => {
  const dev = validateProductionConfig({
    env: baseDashboard({ NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_PROJECT_REF}.supabase.co` }),
    scopes: ['dashboard'], projectRef: DEV_PROJECT_REF,
  })
  assert.ok(dev.errors.some((error) => error.code === 'MAS-DEP-004'))

  const mismatch = validateProductionConfig({ env: baseDashboard(), scopes: ['dashboard'], projectRef: 'aaaaaaaaaaaaaaaaaaaa' })
  assert.ok(mismatch.errors.some((error) => error.key === 'NEXT_PUBLIC_SUPABASE_URL' && error.code === 'MAS-DEP-004'))
})

test('paid capabilities require live provider origins and complete contracts', () => {
  const result = validateProductionConfig({
    env: {
      ...baseDashboard(),
      ...billing({ IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com' }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.key === 'IYZICO_BILLING_BASE_URL'))
})

test('SaaS billing capability passes only a complete live callback contract', () => {
  const result = validateProductionConfig({
    env: { ...baseDashboard(), ...billing() },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('SaaS billing rejects ambiguous plan refs, unsafe amounts and non-origin callback bases', () => {
  const result = validateProductionConfig({
    env: {
      ...baseDashboard({ NEXT_PUBLIC_APP_URL: 'https://app.masabu.co/dashboard?source=deploy' }),
      ...billing({
        IYZICO_BILLING_PRO_PLAN_REF: 'starter-live',
        IYZICO_BILLING_PRO_AMOUNT_MINOR: '29.99',
        IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR: '9007199254740992',
      }),
    },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.key === 'IYZICO_BILLING_*_PLAN_REF'))
  assert.ok(result.errors.some((error) => error.key === 'IYZICO_BILLING_PRO_AMOUNT_MINOR'))
  assert.ok(result.errors.some((error) => error.key === 'IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR'))
  assert.ok(result.errors.some((error) => error.key === 'NEXT_PUBLIC_APP_URL'))
})

test('dashboard deployment must explicitly align the billing switch with capability selection', () => {
  const omittedCapability = validateProductionConfig({
    env: { ...baseDashboard(), ...billing() },
    scopes: ['dashboard'], projectRef: PROD_REF,
  })
  assert.ok(omittedCapability.errors.some((error) => error.key === 'SAAS_BILLING_ENABLED'))

  const disabledCapability = validateProductionConfig({
    env: { ...baseDashboard(), ...billing(), SAAS_BILLING_ENABLED: 'false' },
    scopes: ['dashboard'], capabilities: ['saas-billing'], projectRef: PROD_REF,
  })
  assert.ok(disabledCapability.errors.some((error) => error.key === 'SAAS_BILLING_ENABLED'))
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
  const result = validateProductionConfig({
    env,
    scopes: ['outbox-worker'],
    projectRef: PROD_REF,
  })
  assert.equal(result.ok, true)
  assert.equal(result.errors.some((error) => error.key === 'NEXT_PUBLIC_SUPABASE_URL'), false)

  const mismatch = validateProductionConfig({
    env: { ...env, SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co' },
    scopes: ['outbox-worker'],
    projectRef: PROD_REF,
  })
  assert.ok(mismatch.errors.some((error) => error.code === 'MAS-DEP-004'))
})
