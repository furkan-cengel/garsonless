import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  BILLING_RECONCILIATION_PROJECT_REFS,
  billingReconciliationOperatorSummary,
  buildBillingReconciliationOperatorPlan,
} from './subscription-reconciliation-operator'

const refundId = '9F74E9B8-A88F-4BCE-AB38-5B544E1FAF7B'
const cancellationTargetId = '4427a36f-27ad-4d2e-b683-d2c10bef4d27'
const refundRuntime = readFileSync(
  new URL('../../scripts/reconcile-subscription-refund-runtime.ts', import.meta.url),
  'utf8',
)
const cancellationRuntime = readFileSync(
  new URL('../../scripts/reconcile-refund-cancellation-runtime.ts', import.meta.url),
  'utf8',
)
const dashboardPackage = JSON.parse(readFileSync(
  new URL('../../package.json', import.meta.url),
  'utf8',
)) as { scripts: Record<string, string> }

function packageScript(name: string): string {
  const value = dashboardPackage.scripts[name]
  assert.ok(value, `Missing package script: ${name}`)
  return value
}

const devEnv = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${BILLING_RECONCILIATION_PROJECT_REFS.dev}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: 'dev-service-role',
  IYZICO_BILLING_BASE_URL: 'https://sandbox-api.iyzipay.com',
  IYZICO_BILLING_API_KEY: 'dev-api-key',
  IYZICO_BILLING_SECRET_KEY: 'dev-secret-key',
}

const prodEnv = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${BILLING_RECONCILIATION_PROJECT_REFS.prod}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role',
  IYZICO_BILLING_BASE_URL: 'https://api.iyzipay.com',
  IYZICO_BILLING_API_KEY: 'prod-api-key',
  IYZICO_BILLING_SECRET_KEY: 'prod-secret-key',
}

test('DEV reconciliation is explicitly scoped and dry-run by default', () => {
  const plan = buildBillingReconciliationOperatorPlan({
    subject: 'subscription_refund',
    argv: ['--target=dev', '--all'],
    env: devEnv,
  })
  assert.equal(plan.apply, false)
  assert.deepEqual(plan.scope, { kind: 'all' })
  assert.equal(plan.projectRef, BILLING_RECONCILIATION_PROJECT_REFS.dev)
  assert.deepEqual(billingReconciliationOperatorSummary(plan), {
    result: 'operator_plan',
    subject: 'subscription_refund',
    target: 'dev',
    projectRef: BILLING_RECONCILIATION_PROJECT_REFS.dev,
    apply: false,
    scope: { kind: 'all' },
  })
})

test('production reconciliation requires an exact UUID and exact project-ref confirmation', () => {
  for (const argv of [
    ['--target=prod', '--all', `--confirm-prod=${BILLING_RECONCILIATION_PROJECT_REFS.prod}`],
    ['--target=prod', `--refund-id=${refundId}`],
    ['--target=prod', '--refund-id=not-a-uuid', `--confirm-prod=${BILLING_RECONCILIATION_PROJECT_REFS.prod}`],
    ['--target=prod', `--refund-id=${refundId}`, '--confirm-prod=aaaaaaaaaaaaaaaaaaaa'],
  ]) {
    assert.throws(() => buildBillingReconciliationOperatorPlan({
      subject: 'subscription_refund', argv, env: prodEnv,
    }))
  }

  const plan = buildBillingReconciliationOperatorPlan({
    subject: 'subscription_refund',
    argv: [
      '--target=prod',
      `--refund-id=${refundId}`,
      `--confirm-prod=${BILLING_RECONCILIATION_PROJECT_REFS.prod}`,
    ],
    env: prodEnv,
  })
  assert.equal(plan.apply, false)
  assert.deepEqual(plan.scope, { kind: 'one', id: refundId.toLowerCase() })
})

test('production apply remains exact-target scoped and opt-in', () => {
  const plan = buildBillingReconciliationOperatorPlan({
    subject: 'refund_cancellation',
    argv: [
      '--target=prod',
      `--cancellation-target-id=${cancellationTargetId}`,
      `--confirm-prod=${BILLING_RECONCILIATION_PROJECT_REFS.prod}`,
      '--apply',
    ],
    env: prodEnv,
  })
  assert.equal(plan.apply, true)
  assert.deepEqual(plan.scope, { kind: 'one', id: cancellationTargetId })
  assert.equal(plan.worker, 'prod-refund-cancellation-operator')
})

test('operator rejects crossed Supabase/provider targets and non-canonical URLs', () => {
  for (const env of [
    { ...prodEnv, NEXT_PUBLIC_SUPABASE_URL: devEnv.NEXT_PUBLIC_SUPABASE_URL },
    { ...prodEnv, NEXT_PUBLIC_SUPABASE_URL: `${prodEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1` },
    { ...prodEnv, IYZICO_BILLING_BASE_URL: devEnv.IYZICO_BILLING_BASE_URL },
  ]) {
    assert.throws(() => buildBillingReconciliationOperatorPlan({
      subject: 'subscription_refund',
      argv: [
        '--target=prod',
        `--refund-id=${refundId}`,
        `--confirm-prod=${BILLING_RECONCILIATION_PROJECT_REFS.prod}`,
      ],
      env,
    }))
  }
})

test('operator rejects implicit scope, mixed scope, duplicate switches and unknown arguments', () => {
  for (const argv of [
    ['--target=dev'],
    ['--target=dev', '--all', `--refund-id=${refundId}`],
    ['--target=dev', '--all', '--all'],
    ['--target=dev', '--all', '--force'],
    ['--target=dev', '--all', `--confirm-prod=${BILLING_RECONCILIATION_PROJECT_REFS.prod}`],
  ]) {
    assert.throws(() => buildBillingReconciliationOperatorPlan({
      subject: 'subscription_refund', argv, env: devEnv,
    }))
  }

  assert.throws(
    () => buildBillingReconciliationOperatorPlan({
      subject: 'subscription_refund',
      argv: ['--target=dev', '--all', '--accidental-secret=must-not-leak'],
      env: devEnv,
    }),
    (cause: unknown) => cause instanceof Error
      && cause.message === 'unknown_argument'
      && !cause.message.includes('must-not-leak'),
  )
})

test('runtime mutations remain behind the common apply guard and exact-id filter', () => {
  for (const runtime of [refundRuntime, cancellationRuntime]) {
    const applyGuard = runtime.indexOf('if (!operator.apply)')
    const rpc = runtime.indexOf('admin.rpc(')
    assert.ok(applyGuard >= 0 && rpc > applyGuard)
    assert.doesNotMatch(runtime.slice(0, applyGuard), /admin\.rpc\(/)
    assert.equal([...runtime.matchAll(/admin\.rpc\(/g)].length, 1)
    assert.match(runtime, /operator\.scope\.kind === 'one'[\s\S]*\.eq\('id', operator\.scope\.id\)/)
  }
})

test('package entrypoints are dry-run by default and production never opts into bulk scope', () => {
  for (const subject of ['refund-cancellation', 'subscription-refund']) {
    const dev = packageScript(`billing:reconcile-${subject}:dev`)
    const devApply = packageScript(`billing:reconcile-${subject}:dev:apply`)
    const prod = packageScript(`billing:reconcile-${subject}:prod`)
    const prodApply = packageScript(`billing:reconcile-${subject}:prod:apply`)
    assert.match(dev, /--target=dev --all$/)
    assert.doesNotMatch(dev, /--apply/)
    assert.match(devApply, /--target=dev --all --apply$/)
    assert.match(prod, /--target=prod$/)
    assert.doesNotMatch(prod, /--all|--apply/)
    assert.match(prodApply, /--target=prod --apply$/)
    assert.doesNotMatch(prodApply, /--all/)
  }
})
