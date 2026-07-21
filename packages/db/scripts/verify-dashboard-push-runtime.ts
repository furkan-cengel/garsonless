import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const restaurantSlug = process.env.PUSH_TEST_RESTAURANT_SLUG ?? 'test-cafe-b'

assert(url, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
assert(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required')

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
} as const

const admin = createClient<Database>(url, serviceRoleKey, clientOptions)

async function authenticatedClient(userId: string): Promise<SupabaseClient<Database>> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  assert.ifError(userError)
  const email = userData.user?.email
  assert(email, `Auth user ${userId} has no email`)

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  assert.ifError(linkError)

  const tokenHash = linkData.properties.hashed_token
  assert(tokenHash, `Magic-link token was not generated for ${userId}`)

  const authClient = createClient<Database>(url, anonKey, clientOptions)
  const { data: verified, error: verifyError } = await authClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  })
  assert.ifError(verifyError)
  assert(verified.session, `No session returned for ${userId}`)

  const session: Session = verified.session
  const client = createClient<Database>(url, anonKey, clientOptions)
  const { error: sessionError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  assert.ifError(sessionError)
  return client
}

async function main() {
  const marker = randomUUID()
  const endpoint = `https://push.invalid/${marker}`
  const endpointHash = createHash('sha256').update(endpoint).digest('hex')
  let subscriptionId: string
  let outboxId: string | null = null

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .select('id, owner_id, slug')
    .eq('slug', restaurantSlug)
    .is('deleted_at', null)
    .single()
  assert.ifError(restaurantError)
  assert(restaurant, `Restaurant ${restaurantSlug} was not found`)

  const { data: targetMembers, error: targetMembersError } = await admin
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'active')
  assert.ifError(targetMembersError)
  const targetAccessUsers = new Set([
    restaurant.owner_id,
    ...(targetMembers ?? []).flatMap((member) => (member.user_id ? [member.user_id] : [])),
  ])

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  assert.ifError(usersError)
  const unrelatedUser = usersData.users.find(
    (user) => user.email && !targetAccessUsers.has(user.id),
  )
  assert(unrelatedUser, 'An unrelated auth user is required for the RLS contrast test')

  const { data: ownerMemberships, error: ownerMembershipsError } = await admin
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', restaurant.owner_id)
    .eq('status', 'active')
  assert.ifError(ownerMembershipsError)
  const ownerRestaurantIds = new Set([
    restaurant.id,
    ...(ownerMemberships ?? []).map((membership) => membership.restaurant_id),
  ])

  const { data: restaurants, error: restaurantsError } = await admin
    .from('restaurants')
    .select('id, owner_id')
    .is('deleted_at', null)
  assert.ifError(restaurantsError)
  const foreignRestaurant = (restaurants ?? []).find(
    (candidate) =>
      candidate.owner_id !== restaurant.owner_id && !ownerRestaurantIds.has(candidate.id),
  )
  assert(foreignRestaurant, 'A foreign restaurant is required for the RLS replay test')

  const ownerClient = await authenticatedClient(restaurant.owner_id)
  const unrelatedClient = await authenticatedClient(unrelatedUser.id)
  const anonClient = createClient<Database>(url, anonKey, clientOptions)

  try {
    const subscription = {
      restaurant_id: restaurant.id,
      user_id: restaurant.owner_id,
      endpoint,
      endpoint_hash: endpointHash,
      p256dh: 'runtime-test-p256dh',
      auth: 'runtime-test-auth',
      user_agent: 'masabu-dashboard-push-runtime',
    }

    const { data: inserted, error: insertError } = await ownerClient
      .from('dashboard_push_subscriptions')
      .insert(subscription)
      .select('id')
      .single()
    assert.ifError(insertError)
    assert(inserted)
    subscriptionId = inserted.id

    const { error: upsertError } = await ownerClient
      .from('dashboard_push_subscriptions')
      .upsert(subscription, { onConflict: 'restaurant_id,user_id,endpoint_hash' })
    assert.ifError(upsertError)

    const { count: ownerCount, error: ownerReadError } = await ownerClient
      .from('dashboard_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint_hash', endpointHash)
    assert.ifError(ownerReadError)
    assert.equal(ownerCount, 1, 'Owner retry must preserve one subscription row')

    const { count: unrelatedCount, error: unrelatedReadError } = await unrelatedClient
      .from('dashboard_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint_hash', endpointHash)
    assert.ifError(unrelatedReadError)
    assert.equal(unrelatedCount, 0, 'Another user must not see the owner endpoint')

    const { data: anonRows, error: anonReadError } = await anonClient
      .from('dashboard_push_subscriptions')
      .select('id')
      .eq('endpoint_hash', endpointHash)
    assert(anonReadError, 'Anon subscription reads must be denied')
    assert.equal(anonRows, null)

    const foreignEndpoint = `https://push.invalid/${randomUUID()}`
    const { error: crossTenantError } = await ownerClient
      .from('dashboard_push_subscriptions')
      .insert({
        ...subscription,
        restaurant_id: foreignRestaurant.id,
        endpoint: foreignEndpoint,
        endpoint_hash: createHash('sha256').update(foreignEndpoint).digest('hex'),
      })
    assert(crossTenantError, 'Cross-tenant subscription replay must be denied')

    const { data: outbox, error: outboxError } = await admin
      .from('domain_outbox')
      .insert({
        restaurant_id: restaurant.id,
        aggregate_type: 'order',
        aggregate_id: marker,
        event_type: 'order.created',
        idempotency_key: `runtime-push:${marker}`,
        payload: { runtimeTest: true },
      })
      .select('id')
      .single()
    assert.ifError(outboxError)
    assert(outbox)
    outboxId = outbox.id

    const delivery = {
      outbox_id: outbox.id,
      subscription_id: subscriptionId,
      status: 'pending' as const,
      attempts: 1,
    }
    const { error: firstDeliveryError } = await admin
      .from('dashboard_push_deliveries')
      .insert(delivery)
    assert.ifError(firstDeliveryError)
    const { error: duplicateDeliveryError } = await admin
      .from('dashboard_push_deliveries')
      .insert(delivery)
    assert.equal(duplicateDeliveryError?.code, '23505', 'Delivery replay must be unique')

    const { data: privateDeliveries, error: privateDeliveryError } = await ownerClient
      .from('dashboard_push_deliveries')
      .select('outbox_id')
      .eq('outbox_id', outbox.id)
    assert(privateDeliveryError, 'Delivery diagnostics must remain service-role only')
    assert.equal(privateDeliveries, null)

    console.log(
      JSON.stringify(
        {
          restaurant: restaurant.slug,
          subscription: { ownerVisible: ownerCount, retryRows: ownerCount },
          rls: {
            unrelatedVisible: unrelatedCount,
            anonDenied: true,
            crossTenantDenied: true,
            deliveryDiagnosticsDenied: true,
          },
          delivery: { firstInsert: 'ok', replayCode: duplicateDeliveryError.code },
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
      .eq('endpoint_hash', endpointHash)
    assert.ifError(subscriptionCleanupError)

    const [{ count: subscriptionOrphans }, { count: outboxOrphans }] = await Promise.all([
      admin
        .from('dashboard_push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('endpoint_hash', endpointHash),
      admin
        .from('domain_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('idempotency_key', `runtime-push:${marker}`),
    ])
    assert.equal(subscriptionOrphans, 0, 'Subscription fixture cleanup failed')
    assert.equal(outboxOrphans, 0, 'Outbox fixture cleanup failed')
    console.log(JSON.stringify({ cleanup: { subscriptions: 0, outbox: 0 } }))
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
