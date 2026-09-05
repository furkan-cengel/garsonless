import Iyzipay from 'iyzipay'
import { createClient } from '@supabase/supabase-js'
import { verifyIyzicoFullRefundReportingEvidence } from '../lib/billing/iyzico-refund-reconciliation'
import {
  billingReconciliationOperatorSummary,
  buildBillingReconciliationOperatorPlan,
} from '../lib/billing/subscription-reconciliation-operator'

type ReportingClient = { reportingTransactionDetails: {
  _config: { body: Record<string, unknown> }
  _preparePath(method: string): void
  _getHttpHeaders(method: string): Record<string, string>
} }

async function reportingDetails(
  iyzico: ReportingClient,
  baseUrl: string,
  paymentId: string,
  conversationId: string,
): Promise<unknown> {
  const resource = iyzico.reportingTransactionDetails
  resource._config.body = {}
  resource._preparePath('retrieve')
  const requestUrl = new URL(`${baseUrl}/v2/reporting/payment/details`)
  requestUrl.searchParams.set('locale', 'tr')
  requestUrl.searchParams.set('conversationId', conversationId)
  requestUrl.searchParams.set('paymentId', paymentId)
  const response = await fetch(requestUrl, { headers: resource._getHttpHeaders('retrieve') })
  if (!response.ok) throw new Error('Iyzico reporting transport failed')
  return response.json()
}

async function main() {
  const operator = buildBillingReconciliationOperatorPlan({
    subject: 'subscription_refund',
    argv: process.argv.slice(2),
    env: process.env,
  })
  const admin = createClient(operator.supabaseUrl, operator.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const iyzico = new Iyzipay({
    apiKey: operator.providerApiKey,
    secretKey: operator.providerSecretKey,
    uri: operator.providerBaseUrl,
  }) as unknown as ReportingClient
  console.log(JSON.stringify(billingReconciliationOperatorSummary(operator)))
  let pendingQuery = admin.from('subscription_refunds')
    .select('id,provider_operation_id,provider_payment_id,amount_minor,requested_at')
    .eq('status', 'requires_reconciliation')
    .eq('failure_code', 'local_completion_failed_after_provider_success')
  if (operator.scope.kind === 'one') pendingQuery = pendingQuery.eq('id', operator.scope.id)
  const pending = await pendingQuery
  if (pending.error) throw new Error('subscription_refund_lookup_failed')
  let resolved = 0
  let manual = 0
  let verified = 0
  for (const refund of pending.data ?? []) {
    const report = await reportingDetails(
      iyzico,
      operator.providerBaseUrl,
      refund.provider_payment_id,
      `refund-reconcile-${refund.id}`,
    )
    const evidence = verifyIyzicoFullRefundReportingEvidence(report, {
      providerPaymentId: refund.provider_payment_id,
      amountMinor: refund.amount_minor,
      requestedAt: refund.requested_at,
    })
    if (!evidence.ok) {
      manual += 1
      console.log(JSON.stringify({ result: 'manual_check_required', refundId: refund.id }))
      continue
    }
    verified += 1
    if (!operator.apply) {
      console.log(JSON.stringify({
        result: 'would_resolve',
        refundId: refund.id,
        providerRefundedAt: evidence.value.providerRefundedAt,
      }))
      continue
    }
    const occurredAt = new Date().toISOString()
    const result = await admin.rpc('resolve_platform_subscription_refund_reconciliation', {
      p_refund_id: refund.id,
      p_operation_id: refund.provider_operation_id,
      p_provider_payment_id: refund.provider_payment_id,
      p_provider_refund_ref: evidence.value.providerRefundRef,
      p_amount_minor: refund.amount_minor,
      p_worker: operator.worker,
      p_provider_refunded_at: evidence.value.providerRefundedAt,
      p_verification_note: evidence.value.verificationNote,
      p_occurred_at: occurredAt,
    })
    if (result.error) throw new Error('subscription_refund_resolution_failed')
    resolved += 1
    console.log(JSON.stringify({ result: 'resolved', refundId: refund.id,
      localStatus: result.data?.status ?? null,
      cancellationStatus: result.data?.cancellationStatus ?? null }))
  }
  console.log(`PASS subscription refund reconciliation (${operator.apply ? 'apply' : 'dry-run'}, verified=${verified}, resolved=${resolved}, manual=${manual})`)
}

void main().catch((cause: unknown) => {
  const message = cause instanceof Error ? messageWithCode(cause) : 'unknown_failure'
  console.error(`FAIL subscription refund reconciliation: ${message}`)
  process.exitCode = 1
})

function messageWithCode(error: Error): string {
  const code = (error as Error & { code?: unknown }).code
  return typeof code === 'string' ? `${code}:${error.message}` : error.message
}
