import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../lib/billing/iyzico-subscription-provider'
import { createIyzicoCheckoutDocument } from '../lib/billing/iyzico-checkout-document'
import {
  billingPeriod,
  billingProfileSchema,
  requestFingerprint,
  type PaidBillingPlan,
} from '../lib/billing/subscription-billing-request'

const DEV_SUPABASE_HOST = 'yxsegwkzyiscrxiwdeuf.supabase.co'

function option(name: string): string | null {
  const prefix = `${name}=`
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`sandbox_smoke_missing_${name.toLowerCase()}`)
  return value
}

function assertHostedDocument(checkoutContent: string): void {
  const document = createIyzicoCheckoutDocument(checkoutContent, randomUUID())
  const mountIndex = document.indexOf('id="iyzipay-checkout-form"')
  const providerIndex = document.indexOf(checkoutContent)
  if (mountIndex < 0 || providerIndex <= mountIndex
    || !document.includes('Content-Security-Policy')
    || !document.includes('masabu:iyzico-mounted')) {
    throw new Error('sandbox_checkout_smoke_document_invalid')
  }
}

async function providerOnlySmoke() {
  const config = readIyzicoSubscriptionProviderConfig()
  if (config.baseUrl !== 'https://sandbox-api.iyzipay.com') {
    throw new Error('sandbox_checkout_smoke_refuses_non_sandbox_origin')
  }
  const selectedPlan = option('--plan') ?? 'starter'
  const selectedInterval = option('--interval') ?? 'monthly'
  if (!['starter', 'plus', 'pro'].includes(selectedPlan)) throw new Error('sandbox_checkout_smoke_plan_invalid')
  if (!['monthly', 'annual'].includes(selectedInterval)) throw new Error('sandbox_checkout_smoke_interval_invalid')
  const billingPlan = selectedPlan as PaidBillingPlan
  const interval = selectedInterval as 'monthly' | 'annual'
  const requestId = randomUUID()
  const plan = config.plans[billingPlan][interval]
  const address = {
    contactName: 'Masabu Sandbox',
    city: 'Istanbul',
    district: 'Kadikoy',
    country: 'Turkey',
    address: 'Sandbox test address',
    zipCode: '34710',
  }
  const result = await createIyzicoSubscriptionBillingProvider(config).createCheckout({
    invoiceId: `sandbox-invoice-${requestId}`,
    plan: billingPlan,
    addOns: [],
    interval,
    amount: { minor: plan.amountMinor, currency: 'TRY' },
    callbackUrl: 'http://localhost:3000/api/billing/iyzico/checkout/callback',
    idempotencyKey: `sandbox-checkout-smoke:${requestId}`,
    customer: {
      name: 'Masabu',
      surname: 'Sandbox',
      identityNumber: '11111111111',
      email: `sandbox-checkout+${Date.now()}@masabu.co`,
      // Exercise the local format that iyzico rejects unless the adapter adds +90.
      gsmNumber: '0555 555 55 55',
      billingAddress: address,
      shippingAddress: address,
    },
  })
  if (!result.ok) throw new Error(result.error)
  if (!result.value.providerCheckoutRef || !result.value.checkoutContent) {
    throw new Error('sandbox_checkout_smoke_incomplete')
  }
  if (!result.value.expiresAt || Date.parse(result.value.expiresAt) <= Date.now()) {
    throw new Error('sandbox_checkout_smoke_expiry_invalid')
  }
  assertHostedDocument(result.value.checkoutContent)
  console.log(`PASS iyzico sandbox checkout initialize (${billingPlan}/${interval}, hosted form bytes: ${Buffer.byteLength(result.value.checkoutContent, 'utf8')})`)
}

async function devDatabaseSmoke() {
  const config = readIyzicoSubscriptionProviderConfig()
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  if (new URL(supabaseUrl).host !== DEV_SUPABASE_HOST) {
    throw new Error('sandbox_checkout_smoke_refuses_non_dev_database')
  }
  if (config.baseUrl !== 'https://sandbox-api.iyzipay.com') {
    throw new Error('sandbox_checkout_smoke_refuses_non_sandbox_origin')
  }

  const selectedPlan = option('--plan') ?? 'plus'
  const selectedInterval = option('--interval') ?? 'monthly'
  if (!['starter', 'plus', 'pro'].includes(selectedPlan)) throw new Error('sandbox_checkout_smoke_plan_invalid')
  if (!['monthly', 'annual'].includes(selectedInterval)) throw new Error('sandbox_checkout_smoke_interval_invalid')
  const plan = selectedPlan as PaidBillingPlan
  const interval = selectedInterval as 'monthly' | 'annual'
  const providerPlan = config.plans[plan][interval]

  const service = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: profileCandidates, error: customerError } = await service
    .from('billing_customers')
    .select('restaurant_id,legal_name,contact_name,contact_surname,identity_number,contact_email,gsm_number,billing_address,shipping_address')
    .not('profile_completed_at', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (customerError || !profileCandidates?.length) {
    throw new Error('sandbox_checkout_smoke_profile_unavailable')
  }

  const selected = profileCandidates.flatMap((candidate) => {
    const billingAddress = record(candidate.billing_address)
    const profile = billingProfileSchema.safeParse({
      legalName: candidate.legal_name,
      taxOffice: billingAddress?.taxOffice,
      name: candidate.contact_name,
      surname: candidate.contact_surname,
      identityNumber: candidate.identity_number,
      email: candidate.contact_email,
      gsmNumber: candidate.gsm_number,
      billingAddress: candidate.billing_address,
      shippingAddress: candidate.shipping_address,
    })
    return profile.success ? [{ customer: candidate, profile }] : []
  })[0]
  if (!selected) throw new Error('sandbox_checkout_smoke_profile_invalid')
  const { customer, profile: parsedProfile } = selected

  const requestId = randomUUID()
  const idempotencyKey = `billing:checkout-runtime-smoke:${customer.restaurant_id}:${requestId}`
  const period = billingPeriod(new Date(), interval)
  const intent = {
    operation: 'checkout.initialize',
    restaurantId: customer.restaurant_id,
    plan,
    interval,
    profile: parsedProfile.data,
    addOns: [],
    providerPlanRef: providerPlan.referenceCode,
  }
  const prepareArgs = {
    p_restaurant_id: customer.restaurant_id,
    p_legal_name: parsedProfile.data.legalName,
    p_contact_name: parsedProfile.data.name,
    p_contact_surname: parsedProfile.data.surname,
    p_identity_number: parsedProfile.data.identityNumber,
    p_contact_email: parsedProfile.data.email,
    p_gsm_number: parsedProfile.data.gsmNumber,
    p_billing_address: { ...parsedProfile.data.billingAddress, taxOffice: parsedProfile.data.taxOffice },
    p_shipping_address: parsedProfile.data.shippingAddress,
    p_plan: plan,
    p_billing_interval: interval,
    p_amount_minor: providerPlan.amountMinor,
    p_period_start: period.periodStart,
    p_period_end: period.periodEnd,
    p_due_at: period.dueAt,
    p_idempotency_key: idempotencyKey,
    p_request_fingerprint: requestFingerprint(intent),
  }

  let operationId: string | null = null
  try {
    const { data: preparedValue, error: prepareError } = await service
      .rpc('prepare_subscription_checkout_operation', prepareArgs)
    const prepared = record(preparedValue)
    operationId = typeof prepared?.operationId === 'string' ? prepared.operationId : null
    if (prepareError || !operationId || prepared?.dispatchable !== true || prepared?.duplicate !== false
      || prepared?.amountMinor !== providerPlan.amountMinor || prepared?.plan !== plan
      || prepared?.interval !== interval || prepared?.currency !== 'TRY') {
      throw new Error('sandbox_checkout_smoke_prepare_failed')
    }

    const { data: bound, error: bindError } = await service.rpc('bind_subscription_checkout_provider_plan', {
      p_operation_id: operationId,
      p_expected_provider_plan_ref: providerPlan.referenceCode,
    })
    if (bindError || bound !== true) throw new Error('sandbox_checkout_smoke_plan_bind_failed')

    const checkout = await createIyzicoSubscriptionBillingProvider(config).createCheckout({
      customer: parsedProfile.data,
      invoiceId: operationId,
      plan,
      addOns: [],
      interval,
      amount: { minor: providerPlan.amountMinor, currency: 'TRY' },
      callbackUrl: 'http://localhost:3004/api/billing/iyzico/checkout/callback',
      idempotencyKey,
    })
    if (!checkout.ok || checkout.value.providerPlanRef !== providerPlan.referenceCode
      || !checkout.value.checkoutContent) {
      throw new Error('sandbox_checkout_smoke_provider_initialize_failed')
    }
    assertHostedDocument(checkout.value.checkoutContent)

    const { data: marked, error: markError } = await service.rpc('mark_subscription_checkout_initialized', {
      p_operation_id: operationId,
      p_provider_checkout_ref: checkout.value.providerCheckoutRef,
      p_provider_checkout_expires_at: checkout.value.expiresAt,
    })
    if (markError || marked !== true) throw new Error('sandbox_checkout_smoke_mark_failed')

    const { data: replayValue, error: replayError } = await service
      .rpc('prepare_subscription_checkout_operation', prepareArgs)
    const replay = record(replayValue)
    if (replayError || replay?.operationId !== operationId || replay?.dispatchable !== false
      || replay?.duplicate !== true || typeof replay?.providerCheckoutRef !== 'string') {
      throw new Error('sandbox_checkout_smoke_replay_failed')
    }

    const { data: persisted, error: persistedError } = await service
      .from('billing_provider_operations')
      .select('status,requested_plan,billing_interval,amount_minor,currency,provider_checkout_ref,provider_checkout_expires_at')
      .eq('id', operationId)
      .single()
    if (persistedError || persisted.status !== 'awaiting_callback' || persisted.requested_plan !== plan
      || persisted.billing_interval !== interval || persisted.amount_minor !== providerPlan.amountMinor
      || persisted.currency !== 'TRY' || !persisted.provider_checkout_ref
      || !persisted.provider_checkout_expires_at
      || Date.parse(persisted.provider_checkout_expires_at) <= Date.now()) {
      throw new Error('sandbox_checkout_smoke_persistence_failed')
    }

    console.log(`PASS DEV + iyzico sandbox checkout (${plan}/${interval}, amountMinor=${providerPlan.amountMinor}, status=awaiting_callback, duplicateReplay=true, hostedFormBytes=${Buffer.byteLength(checkout.value.checkoutContent, 'utf8')})`)
  } catch (cause) {
    if (operationId) {
      await service.rpc('mark_subscription_billing_operation_reconciliation', {
        p_operation_id: operationId,
        p_reason: 'sandbox_runtime_smoke_failed',
      })
    }
    throw cause
  }
}

async function main() {
  if (process.argv.includes('--with-dev-db')) await devDatabaseSmoke()
  else await providerOnlySmoke()
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : 'unknown_failure'
  console.error(`FAIL iyzico sandbox checkout initialize: ${message}`)
  process.exitCode = 1
})
