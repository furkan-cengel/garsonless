import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { SubscriptionBillingProfile } from '@garsonless/application/billing'
import {
  createSubscriptionBillingOperationsPort,
  type SubscriptionBillingOperationsRpc,
} from './subscription-billing-operations-port'

const migration = readFileSync(
  new URL('../supabase/migrations/20260722040000_saas_billing_provider_operations.sql', import.meta.url),
  'utf8',
)

const profile: SubscriptionBillingProfile = {
  legalName: 'Masabu Test AŞ', taxOffice: 'Kartal', name: 'Masabu', surname: 'Test',
  identityNumber: '11111111111', email: 'OWNER@EXAMPLE.COM', gsmNumber: '+90 (555) 111 22 33',
  billingAddress: {
    contactName: 'Masabu Test', city: 'İstanbul', district: 'Kadıköy',
    country: 'Türkiye', address: 'Test Sokak No: 1', zipCode: '34710',
  },
  shippingAddress: {
    contactName: 'Masabu Test', city: 'İstanbul', district: null,
    country: 'Türkiye', address: 'Test Sokak No: 1', zipCode: null,
  },
}

test('billing operation migration keeps profiles and outbound calls service-role only', () => {
  assert.match(migration, /alter table public\.billing_provider_operations enable row level security/)
  assert.match(migration, /revoke all on public\.billing_provider_operations from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.prepare_subscription_checkout_operation[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.finalize_subscription_cancellation[\s\S]*to service_role/)
})

test('retry and cancellation resolve idempotency replay before mutable aggregate state', () => {
  const functionBody = migration.match(
    /create or replace function public\.claim_subscription_billing_operation[\s\S]*?\n\$\$;/,
  )?.[0] ?? ''
  const replayLookup = functionBody.indexOf('where idempotency_key = p_idempotency_key for update')
  const subscriptionLookup = functionBody.indexOf('from public.billing_subscriptions')
  const invoiceLookup = functionBody.indexOf('from public.subscription_invoices')
  assert.ok(replayLookup >= 0)
  assert.ok(replayLookup < subscriptionLookup)
  assert.ok(replayLookup < invoiceLookup)
  assert.match(functionBody, /billing_operation_idempotency_conflict/)
  assert.match(functionBody, /'dispatchable', false, 'duplicate', true/)
})

test('checkout mapping and cancellation entitlement changes are transactional', () => {
  assert.match(migration, /provider_invoice_ref = excluded\.provider_invoice_ref/)
  assert.match(migration, /status = 'succeeded', subscription_id = v_subscription\.id/)
  assert.match(migration, /update public\.restaurants set plan = 'free'/)
  assert.match(migration, /insert into public\.tenant_lifecycle_events/)
  assert.match(migration, /perform public\.enqueue_domain_outbox_event/)
})

test('operations port normalizes profile input and fail-closes malformed checkout results', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: SubscriptionBillingOperationsRpc = async (name, args) => {
    calls.push({ name, args })
    return name === 'upsert_subscription_billing_profile'
      ? { data: { customerId: 'customer-1' }, error: null }
      : { data: { operationId: 'operation-1' }, error: null }
  }
  const port = createSubscriptionBillingOperationsPort(rpc)
  assert.deepEqual(await port.saveProfile({ restaurantId: 'restaurant-1', profile }), {
    ok: true, value: { customerId: 'customer-1' },
  })
  assert.equal(calls[0]?.args.p_contact_email, 'OWNER@EXAMPLE.COM')
  assert.equal(calls[0]?.args.p_gsm_number, '+905551112233')

  const checkout = await port.prepareCheckout({
    restaurantId: 'restaurant-1', profile, plan: 'pro', interval: 'monthly',
    amount: { minor: 29_990, currency: 'TRY' },
    periodStart: '2026-07-22T10:00:00.000Z', periodEnd: '2026-08-22T10:00:00.000Z',
    dueAt: '2026-07-22T10:00:00.000Z', idempotencyKey: 'checkout-1',
    requestFingerprint: 'a'.repeat(64),
  })
  assert.deepEqual(checkout, { ok: false, error: 'Billing checkout preparation result is invalid' })
})

test('operations port maps retry and cancellation claims to their distinct provider references', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: SubscriptionBillingOperationsRpc = async (name, args) => {
    calls.push({ name, args })
    return {
      data: args.p_operation_type === 'payment.retry'
        ? {
          operationId: 'retry-1', invoiceId: 'invoice-1', providerRef: 'provider-order-1',
          status: 'processing', dispatchable: true, duplicate: false,
        }
        : {
          operationId: 'cancel-1', subscriptionId: 'subscription-1', providerRef: 'provider-subscription-1',
          status: 'succeeded', dispatchable: false, duplicate: true,
        },
      error: null,
    }
  }
  const port = createSubscriptionBillingOperationsPort(rpc)
  assert.equal((await port.prepareRetry({
    restaurantId: 'restaurant-1', invoiceId: 'invoice-1',
    idempotencyKey: 'retry-key', requestFingerprint: 'b'.repeat(64),
  })).ok, true)
  const cancelled = await port.prepareCancellation({
    restaurantId: 'restaurant-1', idempotencyKey: 'cancel-key', requestFingerprint: 'c'.repeat(64),
  })
  assert.equal(cancelled.ok && cancelled.value.providerSubscriptionRef, 'provider-subscription-1')
  assert.equal(calls[0]?.args.p_invoice_id, 'invoice-1')
  assert.equal(calls[1]?.args.p_invoice_id, null)
})

test('operations port maps exact plan change preparation and finalization contracts', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createSubscriptionBillingOperationsPort(async (name, args) => {
    calls.push({ name, args })
    if (name === 'prepare_subscription_plan_change') return { data: {
      changeRequestId: 'change-1', operationId: 'operation-1', subscriptionId: 'subscription-1',
      providerSubscriptionRef: 'provider-parent', providerTargetPlanRef: 'provider-plan-pro',
      fromPlan: 'plus', toPlan: 'pro', billingInterval: 'monthly',
      effectivePolicy: 'next_period', effectiveAt: '2026-10-01T00:00:00.000Z',
      status: 'processing', dispatchable: true, duplicate: false,
    }, error: null }
    return { data: {
      changeRequestId: 'change-1', subscriptionId: 'subscription-1', status: 'scheduled',
      effectiveAt: '2026-10-01T00:00:00.000Z', duplicate: false,
    }, error: null }
  })
  assert.equal((await port.preparePlanChange({
    restaurantId: 'restaurant-1', toPlan: 'pro', toAddOns: [],
    toBillingInterval: 'monthly', providerTargetPlanRef: 'provider-plan-pro',
    effectivePolicy: 'next_period', idempotencyKey: 'change-key',
    requestFingerprint: 'd'.repeat(64), requestedBy: 'owner-1',
  })).ok, true)
  assert.equal((await port.finalizePlanChange({
    operationId: 'operation-1', changeRequestId: 'change-1',
    occurredAt: '2026-09-01T12:00:00.000Z',
    result: {
      providerParentSubscriptionRef: 'provider-parent',
      providerTargetSubscriptionRef: 'provider-child', providerTargetPlanRef: 'provider-plan-pro',
      providerStatus: 'active', providerPeriodStart: '2026-10-01T00:00:00.000Z',
      providerPeriodEnd: '2027-10-01T00:00:00.000Z',
    },
  })).ok, true)
  assert.equal(calls[0]?.args.p_effective_policy, 'next_period')
  assert.equal(calls[1]?.args.p_provider_target_subscription_ref, 'provider-child')
})

test('operations port fail-closes a callback lookup without one claimed paid plan', async () => {
  const valid = createSubscriptionBillingOperationsPort(async () => ({
    data: {
      operationId: 'operation-1', restaurantId: 'restaurant-1',
      invoiceId: 'invoice-1', requestedPlan: 'pro', expectedProviderPlanRef: 'plan-pro',
      expectedAmountMinor: 143_880, expectedCurrency: 'TRY', expectedBillingInterval: 'monthly',
      expiresAt: '2026-09-01T12:30:00.000Z', attempts: 2,
    },
    error: null,
  }))
  assert.deepEqual(await valid.findCheckoutCallback('checkout-1'), {
    ok: true,
    value: {
      operationId: 'operation-1', restaurantId: 'restaurant-1',
      invoiceId: 'invoice-1', requestedPlan: 'pro', expectedProviderPlanRef: 'plan-pro',
      expectedAmount: { minor: 143_880, currency: 'TRY' }, expectedBillingInterval: 'monthly',
      expiresAt: '2026-09-01T12:30:00.000Z', attempts: 2,
    },
  })

  const invalid = createSubscriptionBillingOperationsPort(async () => ({
    data: {
      operationId: 'operation-1', restaurantId: 'restaurant-1',
      invoiceId: 'invoice-1', requestedPlan: 'free', expectedProviderPlanRef: 'plan-free',
      expectedAmountMinor: 143_880, expectedCurrency: 'TRY', expectedBillingInterval: 'monthly',
      expiresAt: '2026-09-01T12:30:00.000Z', attempts: 1,
    },
    error: null,
  }))
  assert.deepEqual(await invalid.findCheckoutCallback('checkout-1'), {
    ok: false, error: 'Billing checkout callback result is invalid',
  })
})

test('operations port never exposes provider checkout recovery without tenant-scoped claim data', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createSubscriptionBillingOperationsPort(async (name, args) => {
    calls.push({ name, args })
    return {
      data: {
        operationId: 'operation-1', restaurantId: 'restaurant-1',
        providerCheckoutRef: 'provider-token', expectedProviderPlanRef: 'plan-pro',
        expectedAmountMinor: 143_880, expectedCurrency: 'TRY', expectedBillingInterval: 'monthly',
        expiresAt: '2026-09-01T12:30:00.000Z', attempts: 1,
      },
      error: null,
    }
  })
  assert.equal((await port.claimCheckoutRecoveryOperation({
    restaurantId: 'restaurant-1', operationId: 'operation-1',
    workerId: 'dashboard-1', leaseSeconds: 10,
  })).ok, true)
  assert.equal(calls[0]?.name, 'claim_subscription_checkout_recovery_operation')
  assert.equal(calls[0]?.args.p_restaurant_id, 'restaurant-1')
})

test('operations port binds the exact provider plan before hosted checkout dispatch', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createSubscriptionBillingOperationsPort(async (name, args) => {
    calls.push({ name, args })
    return { data: true, error: null }
  })
  assert.deepEqual(await port.bindCheckoutProviderPlan({
    operationId: 'operation-1', expectedProviderPlanRef: 'plan-pro-live',
  }), { ok: true, value: true })
  assert.deepEqual(calls, [{
    name: 'bind_subscription_checkout_provider_plan',
    args: {
      p_operation_id: 'operation-1',
      p_expected_provider_plan_ref: 'plan-pro-live',
    },
  }])
})

test('operations port accepts checkout finalization only with explicit paid retrieve evidence', async () => {
  const input = {
    operationId: 'operation-1', providerCustomerRef: 'customer-1',
    providerSubscriptionRef: 'subscription-provider-1', providerPlanRef: 'plan-1',
    providerInvoiceRef: 'invoice-provider-1', providerPaymentId: 'payment-provider-1',
    providerOrderStatus: 'succeeded' as const,
    amount: { minor: 143_880, currency: 'TRY' as const },
    providerStatus: 'active' as const,
    periodStart: '2026-09-01T00:00:00.000Z', periodEnd: '2026-10-01T00:00:00.000Z',
  }
  const valid = createSubscriptionBillingOperationsPort(async (name) => ({
    data: name === 'bind_subscription_payment_provider_id' ? true : {
      restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
      invoiceStatus: 'paid', paymentEvidence: 'authenticated_retrieve', duplicate: false,
    },
    error: null,
  }))
  assert.deepEqual(await valid.finalizeCheckout(input), {
    ok: true,
    value: {
      restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
      invoiceStatus: 'paid', paymentEvidence: 'authenticated_retrieve', duplicate: false,
    },
  })

  const legacyOpen = createSubscriptionBillingOperationsPort(async () => ({
    data: {
      restaurantId: 'restaurant-1', subscriptionId: 'subscription-1', invoiceId: 'invoice-1',
      duplicate: false,
    },
    error: null,
  }))
  assert.deepEqual(await legacyOpen.finalizeCheckout(input), {
    ok: false, error: 'Billing checkout finalization result is invalid',
  })
})

test('checkout payment identity fault is one atomic RPC failure, never a second bind window', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createSubscriptionBillingOperationsPort(async (name, args) => {
    calls.push({ name, args })
    return { data: null, error: { message: 'billing_payment_identity_attempt_mismatch' } }
  })
  const result = await port.finalizeCheckout({
    operationId: 'operation-1', providerCustomerRef: 'customer-1',
    providerSubscriptionRef: 'subscription-provider-1', providerPlanRef: 'plan-1',
    providerInvoiceRef: 'invoice-provider-1', providerPaymentId: 'payment-provider-1',
    providerOrderStatus: 'succeeded', amount: { minor: 143_880, currency: 'TRY' },
    providerStatus: 'active', periodStart: '2026-09-01T00:00:00.000Z',
    periodEnd: '2026-10-01T00:00:00.000Z',
  })
  assert.deepEqual(result, { ok: false, error: 'billing_payment_identity_attempt_mismatch' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.name, 'finalize_subscription_checkout_with_payment_identity')
  assert.equal(calls[0]?.args.p_provider_payment_id, 'payment-provider-1')
  assert.equal(calls[0]?.args.p_provider_order_status, 'succeeded')
  assert.equal(calls[0]?.args.p_amount_minor, 143_880)
})

test('operations port maps hosted card initialization and callback completion without card fields', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createSubscriptionBillingOperationsPort(async (name, args) => {
    calls.push({ name, args })
    if (name === 'prepare_subscription_card_update') return {
      data: {
        operationId: 'card-operation-1', subscriptionId: 'subscription-1',
        providerSubscriptionRef: 'provider-subscription-1', status: 'processing',
        providerCheckoutRef: null, expiresAt: null,
        dispatchable: true, duplicate: false,
      },
      error: null,
    }
    if (name === 'mark_subscription_card_update_initialized') return { data: true, error: null }
    return {
      data: {
        operationId: 'card-operation-1', restaurantId: 'restaurant-1',
        subscriptionId: 'subscription-1', outcome: 'succeeded', duplicate: false,
      },
      error: null,
    }
  })
  assert.equal((await port.prepareCardUpdate({
    restaurantId: 'restaurant-1', idempotencyKey: 'card-1',
    requestFingerprint: 'a'.repeat(64), callbackStateHash: 'b'.repeat(64),
  })).ok, true)
  assert.equal((await port.markCardUpdateInitialized({
    operationId: 'card-operation-1', providerCheckoutRef: 'card-token-1',
    expiresAt: '2026-09-01T12:30:00.000Z',
  })).ok, true)
  assert.equal((await port.completeCardUpdate({
    providerCheckoutRef: 'card-token-1', callbackState: 'c'.repeat(32),
    occurredAt: '2026-09-01T12:05:00.000Z',
  })).ok, true)
  assert.deepEqual(calls.map((call) => call.name), [
    'prepare_subscription_card_update',
    'mark_subscription_card_update_initialized',
    'complete_subscription_card_update',
  ])
  assert.equal(calls[2]?.args.p_callback_state, 'c'.repeat(32))
  assert.equal('cardNumber' in calls[2]!.args, false)
})
