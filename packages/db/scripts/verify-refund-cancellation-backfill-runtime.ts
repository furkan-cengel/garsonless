import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && serviceRoleKey, 'DEV Supabase runtime environment is required')
assert.equal(new URL(url).host, 'yxsegwkzyiscrxiwdeuf.supabase.co', 'Backfill verification must target DEV')

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const refundResult = await admin.from('subscription_refunds')
    .select('id,restaurant_id,subscription_id,status,kind,scope,access_action,cancellation_request_id')
    .eq('kind', 'same_day_cancel')
    .eq('status', 'succeeded')
  assert.ifError(refundResult.error)
  const refunds = refundResult.data ?? []
  assert.ok(refunds.length > 0, 'DEV must contain at least one successful same-day cancellation')

  const subscriptionIds = [...new Set(refunds.map((refund) => refund.subscription_id))]
  const restaurantIds = [...new Set(refunds.map((refund) => refund.restaurant_id))]
  const [subscriptionResult, requestResult, targetResult, providerRefResult, restaurantResult, outboxResult] = await Promise.all([
    admin.from('billing_subscriptions')
      .select('id,restaurant_id,status,provider_subscription_ref')
      .in('id', subscriptionIds),
    admin.from('subscription_cancellation_requests')
      .select('id,restaurant_id,subscription_id,status,mode,source_refund_id')
      .in('source_refund_id', refunds.map((refund) => refund.id)),
    admin.from('subscription_cancellation_provider_targets')
      .select('id,cancellation_request_id,subscription_id,provider_subscription_ref,status')
      .in('subscription_id', subscriptionIds),
    admin.from('billing_subscription_provider_refs')
      .select('subscription_id,provider_subscription_ref,ref_role,retired_at')
      .in('subscription_id', subscriptionIds)
      .in('ref_role', ['current', 'scheduled'])
      .is('retired_at', null),
    admin.from('restaurants').select('id,name').in('id', restaurantIds),
    admin.from('domain_outbox')
      .select('id,aggregate_id,event_type,idempotency_key')
      .eq('event_type', 'subscription.cancelled'),
  ])
  for (const result of [subscriptionResult, requestResult, targetResult, providerRefResult, restaurantResult, outboxResult]) {
    assert.ifError(result.error)
  }

  const subscriptions = new Map((subscriptionResult.data ?? []).map((row) => [row.id, row]))
  const requestsByRefund = new Map((requestResult.data ?? []).map((row) => [row.source_refund_id, row]))
  const restaurants = new Map((restaurantResult.data ?? []).map((row) => [row.id, row.name]))

  for (const refund of refunds) {
    assert.equal(refund.scope, 'full', `Same-day refund ${refund.id} must be full`)
    assert.equal(refund.access_action, 'cancel_immediately', `Same-day refund ${refund.id} must close access`)
    assert.ok(refund.cancellation_request_id, `Same-day refund ${refund.id} must link cancellation request`)
    const subscription = subscriptions.get(refund.subscription_id)
    assert.ok(subscription, `Subscription ${refund.subscription_id} must exist`)
    assert.ok(
      ['refund_cancel_pending', 'cancelled'].includes(subscription.status),
      `Subscription ${refund.subscription_id} must fail closed while provider cancellation is verified`,
    )
    const request = requestsByRefund.get(refund.id)
    assert.ok(request, `Refund ${refund.id} must own one cancellation request`)
    assert.equal(request.id, refund.cancellation_request_id)
    assert.equal(request.mode, 'immediate_refund')
    assert.ok(
      ['scheduled', 'processing', 'applied', 'requires_reconciliation'].includes(request.status),
      `Unexpected cancellation request status ${request.status}`,
    )

    const targets = (targetResult.data ?? []).filter((target) => target.cancellation_request_id === request.id)
    assert.ok(targets.length > 0, `Cancellation request ${request.id} must have provider targets`)
    assert.equal(new Set(targets.map((target) => target.provider_subscription_ref)).size, targets.length)
    const expectedRefs = new Set((providerRefResult.data ?? [])
      .filter((providerRef) => providerRef.subscription_id === refund.subscription_id)
      .map((providerRef) => providerRef.provider_subscription_ref))
    expectedRefs.add(subscription.provider_subscription_ref)
    for (const providerRef of expectedRefs) {
      assert.ok(
        targets.some((target) => target.provider_subscription_ref === providerRef),
        `Cancellation request ${request.id} must include provider ref ${providerRef}`,
      )
    }
    if (subscription.status === 'cancelled') {
      assert.equal(request.status, 'applied')
      assert.ok(targets.every((target) => target.status === 'applied'))
      const cancellationEvents = (outboxResult.data ?? []).filter((event) => (
        event.aggregate_id === request.id
          && event.idempotency_key === `billing:subscription-cancelled:v2:${request.id}`
      ))
      assert.equal(cancellationEvents.length, 1, `Cancellation request ${request.id} must emit once`)
    }

    console.log(JSON.stringify({
      restaurant: restaurants.get(refund.restaurant_id) ?? refund.restaurant_id,
      subscriptionStatus: subscription.status,
      cancellationStatus: request.status,
      targetStatuses: targets.map((target) => target.status),
    }))
  }

  console.log(`PASS refund cancellation backfill (${refunds.length} successful same-day record${refunds.length === 1 ? '' : 's'})`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
