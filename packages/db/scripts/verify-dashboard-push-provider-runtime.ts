import assert from 'node:assert/strict'
import { createECDH, createHash, randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const consumerUrl = process.env.PUSH_TEST_CONSUMER_URL ?? 'http://localhost:3000/api/internal/push'
const consumerSecret = process.env.PUSH_TEST_CONSUMER_SECRET
const restaurantSlug = process.env.PUSH_TEST_RESTAURANT_SLUG ?? 'test-cafe-b'

assert(url, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required')
assert(consumerSecret, 'PUSH_TEST_CONSUMER_SECRET is required')

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const marker = randomUUID()
  const endpoint = `https://push.invalid/${marker}`
  const endpointHash = createHash('sha256').update(endpoint).digest('hex')
  let outboxId: string | null = null

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .select('id, owner_id, slug, plan')
    .eq('slug', restaurantSlug)
    .is('deleted_at', null)
    .single()
  assert.ifError(restaurantError)
  assert(restaurant)

  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()

  const { data: subscription, error: subscriptionError } = await admin
    .from('dashboard_push_subscriptions')
    .insert({
      restaurant_id: restaurant.id,
      user_id: restaurant.owner_id,
      endpoint,
      endpoint_hash: endpointHash,
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
      user_agent: 'masabu-dashboard-push-provider-runtime',
    })
    .select('id')
    .single()
  assert.ifError(subscriptionError)
  assert(subscription)

  try {
    const { data: outbox, error: outboxError } = await admin
      .from('domain_outbox')
      .insert({
        restaurant_id: restaurant.id,
        aggregate_type: 'order',
        aggregate_id: marker,
        event_type: 'order.created',
        idempotency_key: `runtime-push-provider:${marker}`,
        payload: { total: 42, runtimeTest: true },
      })
      .select('id')
      .single()
    assert.ifError(outboxError)
    assert(outbox)
    outboxId = outbox.id

    const unauthorized = await fetch(consumerUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-outbox-secret': 'wrong-secret' },
      body: JSON.stringify({ eventId: outbox.id }),
    })
    assert.equal(unauthorized.status, 401)

    const statuses: number[] = []
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(consumerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-outbox-secret': consumerSecret },
        body: JSON.stringify({ eventId: outbox.id }),
      })
      statuses.push(response.status)
    }
    assert.deepEqual(statuses, [503, 503], 'Transient provider failures must remain retryable')

    const [{ data: delivery, error: deliveryError }, { count: receiptCount }, { data: currentSubscription }] =
      await Promise.all([
        admin
          .from('dashboard_push_deliveries')
          .select('status, attempts')
          .eq('outbox_id', outbox.id)
          .eq('subscription_id', subscription.id)
          .single(),
        admin
          .from('domain_outbox_receipts')
          .select('outbox_id', { count: 'exact', head: true })
          .eq('outbox_id', outbox.id)
          .eq('consumer', 'dashboard-push'),
        admin
          .from('dashboard_push_subscriptions')
          .select('failure_count, disabled_at')
          .eq('id', subscription.id)
          .single(),
      ])
    assert.ifError(deliveryError)
    assert.deepEqual(delivery, { status: 'failed', attempts: 2 })
    assert.equal(receiptCount, 0, 'Transient failure must not acknowledge the outbox event')
    assert.equal(currentSubscription?.failure_count, 2)
    assert.equal(currentSubscription?.disabled_at, null)

    console.log(
      JSON.stringify(
        {
          restaurant: restaurant.slug,
          plan: restaurant.plan,
          auth: { wrongSecretStatus: unauthorized.status },
          provider: { statuses, delivery, receiptCount, failureCount: 2, disabled: false },
        },
        null,
        2,
      ),
    )
  } finally {
    if (outboxId) {
      const { error } = await admin.from('domain_outbox').delete().eq('id', outboxId)
      assert.ifError(error)
    }
    const { error: subscriptionCleanupError } = await admin
      .from('dashboard_push_subscriptions')
      .delete()
      .eq('id', subscription.id)
    assert.ifError(subscriptionCleanupError)

    const [{ count: subscriptionOrphans }, { count: outboxOrphans }] = await Promise.all([
      admin
        .from('dashboard_push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('endpoint_hash', endpointHash),
      admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('idempotency_key', `runtime-push-provider:${marker}`),
    ])
    assert.equal(subscriptionOrphans, 0)
    assert.equal(outboxOrphans, 0)
    console.log(JSON.stringify({ cleanup: { subscriptions: 0, outbox: 0 } }))
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
