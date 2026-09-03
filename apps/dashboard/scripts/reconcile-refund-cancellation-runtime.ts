import { createClient } from '@supabase/supabase-js'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../lib/billing/iyzico-subscription-provider'
import {
  billingReconciliationOperatorSummary,
  buildBillingReconciliationOperatorPlan,
} from '../lib/billing/subscription-reconciliation-operator'

const TERMINAL_WITHOUT_FURTHER_CHARGE = new Set(['cancelled', 'upgraded', 'expired'])

async function main() {
  const operator = buildBillingReconciliationOperatorPlan({
    subject: 'refund_cancellation',
    argv: process.argv.slice(2),
    env: process.env,
  })
  const admin = createClient(operator.supabaseUrl, operator.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const provider = createIyzicoSubscriptionBillingProvider(readIyzicoSubscriptionProviderConfig())
  console.log(JSON.stringify(billingReconciliationOperatorSummary(operator)))
  const probeSubscriptionStatus = provider.probeSubscriptionStatus
  if (!probeSubscriptionStatus) throw new Error('Iyzico provider status probe is required')
  let targetQuery = admin.from('subscription_cancellation_provider_targets')
    .select('id,cancellation_request_id,provider_subscription_ref,provider_operation_id,status')
    .eq('status', 'requires_reconciliation')
  if (operator.scope.kind === 'one') targetQuery = targetQuery.eq('id', operator.scope.id)
  const targetResult = await targetQuery
  if (targetResult.error) throw new Error('cancellation_target_lookup_failed')
  const candidateTargets = targetResult.data ?? []
  if (candidateTargets.length === 0) {
    console.log('PASS no immediate-refund cancellation reconciliation is pending')
    return
  }
  const requestIds = [...new Set(candidateTargets.map((target) => target.cancellation_request_id))]
  const requestResult = await admin.from('subscription_cancellation_requests')
    .select('id,subscription_id,status')
    .in('id', requestIds)
    .eq('mode', 'immediate_refund')
    .in('status', ['processing', 'requires_reconciliation'])
  if (requestResult.error) throw new Error('cancellation_request_lookup_failed')
  const eligibleRequestIds = new Set((requestResult.data ?? []).map((request) => request.id))
  const targets = candidateTargets.filter((target) => eligibleRequestIds.has(target.cancellation_request_id))

  let resolved = 0
  let unresolved = 0
  let verified = 0
  for (const target of targets) {
    if (!target.provider_operation_id) throw new Error('cancellation_provider_operation_missing')
    const probe = await probeSubscriptionStatus({
      providerSubscriptionRef: target.provider_subscription_ref,
      idempotencyKey: `refund-cancellation-reconcile-${target.id}`,
    })
    const providerStatus = probe.ok ? probe.value.status : null
    if (!probe.ok || !providerStatus || !TERMINAL_WITHOUT_FURTHER_CHARGE.has(providerStatus)) {
      unresolved += 1
      console.log(JSON.stringify({
        result: 'manual_check_required',
        cancellationTargetId: target.id,
        providerStatus,
      }))
      continue
    }
    const occurredAt = probe.value.observedAt
    verified += 1
    if (!operator.apply) {
      console.log(JSON.stringify({
        result: 'would_resolve',
        cancellationTargetId: target.id,
        providerStatus,
        providerObservedAt: occurredAt,
      }))
      continue
    }
    const result = await admin.rpc('resolve_subscription_cancellation_target_terminal', {
      p_cancellation_request_id: target.cancellation_request_id,
      p_cancellation_target_id: target.id,
      p_operation_id: target.provider_operation_id,
      p_worker: operator.worker,
      p_provider_terminal_status: providerStatus,
      p_provider_observed_at: occurredAt,
      p_verification_note: `iyzico_subscription_search:${providerStatus}`,
      p_occurred_at: occurredAt,
    })
    if (result.error) throw new Error('cancellation_target_resolution_failed')
    resolved += 1
    console.log(JSON.stringify({
      result: 'resolved',
      cancellationTargetId: target.id,
      providerStatus,
      localStatus: result.data?.status ?? null,
    }))
  }
  console.log(`PASS refund cancellation reconciliation (${operator.apply ? 'apply' : 'dry-run'}, verified=${verified}, resolved=${resolved}, manual=${unresolved})`)
}

void main().catch((cause: unknown) => {
  const message = cause instanceof Error ? messageWithCode(cause) : 'unknown_failure'
  console.error(`FAIL refund cancellation reconciliation: ${message}`)
  process.exitCode = 1
})

function messageWithCode(error: Error): string {
  const code = (error as Error & { code?: unknown }).code
  return typeof code === 'string' ? `${code}:${error.message}` : error.message
}
