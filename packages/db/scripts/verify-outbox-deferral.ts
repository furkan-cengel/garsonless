import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createServiceClient } from '../src/client'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  try {
    const { data: fixture, error: fixtureError } = await service
      .from('restaurants')
      .select('owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (fixtureError || !fixture?.owner_id) {
      throw fixtureError ?? new Error('Fixture owner unavailable')
    }

    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .insert({
        owner_id: fixture.owner_id,
        slug: `outbox-defer-${suffix}`,
        name: `Outbox defer ${suffix}`,
      })
      .select('id')
      .single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const aggregateId = randomUUID()
    const idempotencyKey = `runtime:defer:${suffix}`
    const queued = await service.rpc('enqueue_domain_outbox_event', {
      p_restaurant_id: restaurantId,
      p_aggregate_type: 'customer',
      p_aggregate_id: aggregateId,
      p_event_type: 'customer.welcome_bonus_requested',
      p_payload: { customerId: aggregateId, restaurantId },
      p_idempotency_key: idempotencyKey,
    })
    if (queued.error) throw queued.error

    const { data: event, error: eventError } = await service
      .from('domain_outbox')
      .select('id, attempts, available_at, locked_by, processed_at, last_error')
      .eq('idempotency_key', idempotencyKey)
      .single()
    if (eventError) throw eventError

    const deadline = Date.now() + 95_000
    let observed = event
    while (Date.now() < deadline) {
      const { data, error } = await service
        .from('domain_outbox')
        .select('id, attempts, available_at, locked_by, processed_at, last_error')
        .eq('id', event.id)
        .single()
      if (error) throw error
      observed = data
      if (data.last_error?.includes('OUTBOX_CONSUMER_URL is not configured')) break
      await delay(5_000)
    }

    assert(
      observed.last_error?.includes('OUTBOX_CONSUMER_URL is not configured'),
      'Worker did not defer the event before the deadline',
    )
    assert(observed.attempts === 0, `Deferral consumed retry budget: ${observed.attempts}`)
    assert(observed.processed_at === null, 'Deferred event was incorrectly acknowledged')
    assert(observed.locked_by === null, 'Deferred event lease was not released')
    assert(new Date(observed.available_at).getTime() > Date.now(), 'Deferred event was not delayed')

    console.log(
      JSON.stringify(
        {
          eventId: event.id,
          attempts: observed.attempts,
          processedAt: observed.processed_at,
          lockedBy: observed.locked_by,
          availableAt: observed.available_at,
          lastError: observed.last_error,
        },
        null,
        2,
      ),
    )
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    const { count } = await service
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('id', restaurantId || randomUUID())
    console.log(JSON.stringify({ cleanup: { restaurants: count ?? 0 } }))
  }
}

void main()
