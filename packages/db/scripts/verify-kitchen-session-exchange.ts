import { randomBytes, randomUUID } from 'node:crypto'
import { createClient, createServiceClient } from '../src/client'
import {
  createKitchenLaunchTicket,
  exchangeKitchenLaunchTicket,
  verifyKitchenSession,
} from '../src/kitchen-session'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  let primaryError: unknown = null
  try {
    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug: `kitchen-session-${suffix}`,
      name: `Kitchen session ${suffix}`,
      plan: 'pro',
      settings: { runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant unavailable')
    restaurantId = restaurant.id

    const firstCredential = randomBytes(32).toString('base64url')
    const { error: credentialError } = await service.from('kitchen_credentials').insert({
      restaurant_id: restaurantId,
      token: firstCredential,
    })
    if (credentialError) throw credentialError

    const launchResult = await createKitchenLaunchTicket(restaurantId)
    assert(launchResult.kind === 'created', 'Launch ticket was not created')
    const launch = launchResult.ticket
    const session = await exchangeKitchenLaunchTicket(restaurantId, launch)
    assert(session, 'Launch ticket was not exchanged')
    const replayedSession = await exchangeKitchenLaunchTicket(restaurantId, launch)
    assert(replayedSession === null, 'Launch ticket was accepted twice')

    const validBeforeRotation = await verifyKitchenSession(restaurantId, session)
    const crossTenantReplay = await verifyKitchenSession(randomUUID(), session)
    const launchAsSession = await verifyKitchenSession(restaurantId, launch)
    assert(validBeforeRotation, 'Kitchen session was not accepted')
    assert(!crossTenantReplay, 'Kitchen session crossed tenant boundary')
    assert(!launchAsSession, 'Launch artifact was accepted as a session')

    const { error: downgradeError } = await service.from('restaurants')
      .update({ plan: 'starter' })
      .eq('id', restaurantId)
    if (downgradeError) throw downgradeError
    const blockedLaunch = await createKitchenLaunchTicket(restaurantId)
    const oldSessionAfterDowngrade = await verifyKitchenSession(restaurantId, session)
    assert(blockedLaunch.kind === 'plan_required', 'Starter plan created a kitchen launch ticket')
    assert(!oldSessionAfterDowngrade, 'Starter downgrade left the KDS session valid')

    const { error: upgradeError } = await service.from('restaurants')
      .update({ plan: 'pro' })
      .eq('id', restaurantId)
    if (upgradeError) throw upgradeError

    const { error: rotationError } = await service.from('kitchen_credentials').update({
      token: randomBytes(32).toString('base64url'),
      updated_at: new Date().toISOString(),
    }).eq('restaurant_id', restaurantId)
    if (rotationError) throw rotationError

    const oldSessionAfterRotation = await verifyKitchenSession(restaurantId, session)
    const oldTicketAfterRotation = await exchangeKitchenLaunchTicket(restaurantId, launch)
    assert(!oldSessionAfterRotation, 'Credential rotation left the old session valid')
    assert(oldTicketAfterRotation === null, 'Credential rotation left the old launch ticket valid')

    const rotatedLaunchResult = await createKitchenLaunchTicket(restaurantId)
    assert(rotatedLaunchResult.kind === 'created', 'Rotated launch ticket was not created')
    const rotatedLaunch = rotatedLaunchResult.ticket
    const concurrentExchange = await Promise.all([
      exchangeKitchenLaunchTicket(restaurantId, rotatedLaunch),
      exchangeKitchenLaunchTicket(restaurantId, rotatedLaunch),
    ])
    const rotatedSession = concurrentExchange.find((value): value is string => value !== null) ?? null
    assert(concurrentExchange.filter((value) => value !== null).length === 1, 'Parallel exchange had more than one winner')
    assert(rotatedSession, 'Rotated launch ticket was not exchanged')
    assert(await verifyKitchenSession(restaurantId, rotatedSession), 'Rotated session was not accepted')

    const anon = createClient()
    const anonReceiptRead = await anon.from('kitchen_session_launches')
      .select('id').eq('restaurant_id', restaurantId)
    assert(anonReceiptRead.error?.code === '42501', 'Anon could read kitchen launch receipts')
    const anonReceiptConsume = await anon.rpc('consume_kitchen_launch_ticket', {
      p_restaurant_id: restaurantId,
      p_ticket_hash: '0'.repeat(64),
    })
    assert(anonReceiptConsume.error?.code === '42501', 'Anon could consume kitchen launch receipts')

    console.log(JSON.stringify({
      launch: {
        created: true,
        exchanged: true,
        replayAccepted: replayedSession !== null,
        parallelWinners: concurrentExchange.filter((value) => value !== null).length,
        rawCredentialExposed: launch.includes(firstCredential),
        anonReceiptRead: anonReceiptRead.error.code,
        anonReceiptConsume: anonReceiptConsume.error.code,
      },
      session: { validBeforeRotation, crossTenantReplay, launchAsSession },
      planGate: {
        starterLaunch: blockedLaunch.kind,
        oldSessionAfterDowngrade,
      },
      rotation: {
        oldSessionValid: oldSessionAfterRotation,
        oldTicketExchange: oldTicketAfterRotation !== null,
        newSessionValid: true,
      },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }
  const marker = restaurantId || randomUUID()
  const [restaurants, credentials, launches] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('kitchen_credentials').select('restaurant_id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('kitchen_session_launches').select('restaurant_id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  const cleanup = { restaurants: restaurants.count, credentials: credentials.count, launches: launches.count }
  console.log(JSON.stringify({ cleanup }))
  assert(Object.values(cleanup).every((count) => count === 0), 'Runtime cleanup left orphan rows')
  if (primaryError) throw primaryError
}

void main()
