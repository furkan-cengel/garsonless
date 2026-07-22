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
  legalName: 'Masabu Test AŞ', name: 'Masabu', surname: 'Test',
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
    restaurantId: 'restaurant-1', profile, plan: 'pro',
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
