import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createSubscriptionBillingSettingsReadPort } from './subscription-billing-settings-port'

const migration = readFileSync(
  new URL('../supabase/migrations/20260722050000_saas_billing_settings_projection.sql', import.meta.url),
  'utf8',
)

const projection = {
  profile: null,
  subscription: {
    id: 'subscription-1', plan: 'pro', billingInterval: 'monthly', scheduledPlan: null, status: 'past_due',
    currentPeriodStart: '2026-07-01T00:00:00.000Z',
    currentPeriodEnd: '2026-08-01T00:00:00.000Z',
    trialEndsAt: null, graceEndsAt: '2026-08-08T00:00:00.000Z', cancelledAt: null,
    activeAddOns: [], scheduledAddOns: [],
    cancelAtPeriodEnd: false, cancellationRequestId: null,
    cancellationEffectiveAt: null, cancellationStatus: null,
  },
  invoices: [{
    id: 'invoice-1', plan: 'pro', billingInterval: 'monthly', amountDueMinor: 29990, amountPaidMinor: 0,
    currency: 'TRY', status: 'past_due', periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-08-01T00:00:00.000Z', dueAt: '2026-07-01T00:00:00.000Z',
    paidAt: null, failedAt: '2026-07-01T10:00:00.000Z', canRetry: true, addOns: [],
  }],
  refunds: [{
    id: 'refund-1', invoiceId: 'invoice-1', kind: 'refund', scope: 'partial',
    accessAction: 'keep', cancellationRequestId: null, cancellationStatus: null,
    amountMinor: 5000, currency: 'TRY', status: 'succeeded',
    requestedAt: '2026-07-02T10:00:00.000Z', completedAt: '2026-07-02T10:00:01.000Z',
  }],
  attention: { reconciliationCount: 1, hasPendingCheckout: false, nextDunningActionAt: '2026-07-23T00:00:00.000Z' },
}

test('billing settings RPC remains service-role-only and omits provider diagnostics', () => {
  assert.match(migration, /security definer/)
  assert.match(migration, /revoke all on function public\.read_subscription_billing_settings\(uuid\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.read_subscription_billing_settings\(uuid\)[\s\S]*to service_role/)
  const returnedProjection = migration.slice(migration.indexOf("return jsonb_build_object("))
  assert.doesNotMatch(returnedProjection, /provider_subscription_ref|provider_invoice_ref|last_error|payload_sanitized/)
})

test('billing settings projection is tenant filtered and bounded', () => {
  assert.match(migration, /where restaurant_id = p_restaurant_id/g)
  assert.match(migration, /limit 12/)
  assert.match(migration, /status = 'past_due' and provider_invoice_ref is not null/)
})

test('billing settings port parses a safe projection and rejects malformed money', async () => {
  const port = createSubscriptionBillingSettingsReadPort(async (name, args) => {
    assert.equal(name, 'read_subscription_billing_settings')
    assert.deepEqual(args, { p_restaurant_id: 'restaurant-1' })
    return { data: projection, error: null }
  })
  assert.deepEqual(await port.readSettings({ restaurantId: 'restaurant-1' }), { ok: true, value: projection })

  const malformed = createSubscriptionBillingSettingsReadPort(async () => ({
    data: { ...projection, invoices: [{ ...projection.invoices[0], amountDueMinor: 29.99 }] },
    error: null,
  }))
  assert.deepEqual(await malformed.readSettings({ restaurantId: 'restaurant-1' }), {
    ok: false, error: 'Billing settings projection is invalid',
  })
})

test('billing settings port hides database errors behind a stable boundary message', async () => {
  const port = createSubscriptionBillingSettingsReadPort(async () => ({
    data: null, error: { message: 'provider_subscription_ref leaked' },
  }))
  assert.deepEqual(await port.readSettings({ restaurantId: 'restaurant-1' }), {
    ok: false, error: 'Billing settings could not be loaded',
  })
})
