import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { loadTopologySpec, runCli, validateDeploymentTopology } from './deployment-topology.mjs'

const PROD_REF = 'svxvloeosiksqfadgkvo'
const SHARED_ANON = 'anon-value'
const SHARED_SERVICE = 'service-value'
const SHARED_WORKER = 'worker-value'

function validEnv() {
  const supabase = `https://${PROD_REF}.supabase.co`
  return {
    dashboard: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SHARED_ANON,
      SUPABASE_SERVICE_ROLE_KEY: SHARED_SERVICE,
      NEXT_PUBLIC_APP_URL: 'https://app.masabu.co',
      NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
      NEXT_PUBLIC_MENU_BASE_URL: 'https://menu.masabu.co',
      KITCHEN_URL: 'https://kds.masabu.co',
      NEXT_PUBLIC_KITCHEN_URL: 'https://kds.masabu.co',
      OUTBOX_WORKER_SECRET: SHARED_WORKER,
    },
    menu: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SHARED_ANON,
      SUPABASE_SERVICE_ROLE_KEY: SHARED_SERVICE,
      NEXT_PUBLIC_APP_URL: 'https://menu.masabu.co',
      NEXT_PUBLIC_MENU_URL: 'https://menu.masabu.co',
      OUTBOX_WORKER_SECRET: SHARED_WORKER,
    },
    kitchen: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SHARED_ANON,
      SUPABASE_SERVICE_ROLE_KEY: SHARED_SERVICE,
    },
    marketing: {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_DASHBOARD_URL: 'https://app.masabu.co',
      NEXT_PUBLIC_SITE_URL: 'https://masabu.co',
      SUPABASE_SERVICE_ROLE_KEY: SHARED_SERVICE,
    },
    'platform-admin': {
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SHARED_ANON,
      SUPABASE_SERVICE_ROLE_KEY: SHARED_SERVICE,
      NEXT_PUBLIC_ADMIN_URL: 'https://admin.masabu.co',
    },
    'outbox-worker': {
      SUPABASE_URL: supabase,
      SUPABASE_SERVICE_ROLE_KEY: SHARED_SERVICE,
      OUTBOX_WORKER_SECRET: SHARED_WORKER,
      OUTBOX_CONSUMER_URL: 'https://app.masabu.co/api/internal/outbox',
      OUTBOX_PUSH_CONSUMER_URL: 'https://app.masabu.co/api/internal/push',
      OUTBOX_INBOX_CONSUMER_URL: 'https://app.masabu.co/api/internal/inbox',
      OUTBOX_EMAIL_CONSUMER_URL: 'https://app.masabu.co/api/internal/notification-email',
      PAYMENT_RECONCILIATION_URL: 'https://menu.masabu.co/api/internal/payment-reconciliation',
      BILLING_MAINTENANCE_URL: 'https://app.masabu.co/api/internal/billing-maintenance',
    },
  }
}

test('production topology binds every app, shared credential and route', () => {
  const { spec, sha256 } = loadTopologySpec()
  const result = validateDeploymentTopology({ spec, envByScope: validEnv(), projectRef: PROD_REF })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.equal(result.publicEndpoints.length, 11)
  assert.match(sha256, /^[a-f0-9]{64}$/)
})

test('wrong public origin and worker endpoint fail closed', () => {
  const { spec } = loadTopologySpec()
  const env = validEnv()
  env.dashboard.NEXT_PUBLIC_MENU_URL = 'https://wrong.masabu.co'
  env['outbox-worker'].OUTBOX_CONSUMER_URL = 'https://app.masabu.co/api/internal/missing'
  const result = validateDeploymentTopology({ spec, envByScope: env, projectRef: PROD_REF })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.code === 'MAS-DEP-012'))
  assert.ok(result.errors.some((error) => error.code === 'MAS-DEP-014'))
})

test('cross-app Supabase and worker secret drift is detected without exposing values', () => {
  const { spec } = loadTopologySpec()
  const env = validEnv()
  env.menu.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'different-anon'
  env.menu.OUTBOX_WORKER_SECRET = 'different-worker'
  const result = validateDeploymentTopology({ spec, envByScope: env, projectRef: PROD_REF })
  assert.equal(result.ok, false)
  assert.equal(result.errors.filter((error) => error.code === 'MAS-DEP-013').length, 2)
  assert.doesNotMatch(JSON.stringify(result), /different-anon|different-worker/)
})

test('missing scope and DEV or mismatched project fail closed', () => {
  const { spec } = loadTopologySpec()
  const env = validEnv()
  delete env.kitchen
  const missing = validateDeploymentTopology({ spec, envByScope: env, projectRef: PROD_REF })
  assert.ok(missing.errors.some((error) => error.code === 'MAS-DEP-001' && error.subject === 'kitchen'))

  const dev = validateDeploymentTopology({ spec, envByScope: validEnv(), projectRef: 'yxsegwkzyiscrxiwdeuf' })
  assert.ok(dev.errors.some((error) => error.code === 'MAS-DEP-004'))

  const mismatch = validateDeploymentTopology({ spec, envByScope: validEnv(), projectRef: 'aaaaaaaaaaaaaaaaaaaa' })
  assert.ok(mismatch.errors.some((error) => error.code === 'MAS-DEP-004' && error.subject === 'supabase-url'))
})

test('a missing repository route invalidates the topology contract', () => {
  const { spec } = loadTopologySpec()
  const broken = structuredClone(spec)
  broken.endpoints[0].routeFile = 'apps/dashboard/app/api/internal/does-not-exist/route.ts'
  const result = validateDeploymentTopology({ spec: broken, envByScope: validEnv(), projectRef: PROD_REF })
  assert.ok(result.errors.some((error) => error.code === 'MAS-DEP-015'))
})

test('CLI accepts repeated scope env files without printing credential values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'masabu-topology-'))
  const envFiles = validEnv()
  const args = ['--project-ref', PROD_REF, '--json']
  for (const [scope, env] of Object.entries(envFiles)) {
    const file = join(directory, `${scope}.env`)
    writeFileSync(file, `${Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n')}\n`)
    args.push('--env', `${scope}=${file}`)
  }

  const output = []
  const originalLog = console.log
  console.log = (value) => output.push(String(value))
  try {
    assert.equal(runCli(args), 0)
  } finally {
    console.log = originalLog
    rmSync(directory, { recursive: true, force: true })
  }
  const serialized = output.join('\n')
  assert.match(serialized, /"ok": true/)
  assert.doesNotMatch(serialized, /anon-value|service-value|worker-value/)
})
