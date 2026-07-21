import { randomUUID } from 'node:crypto'
import { createDashboardTable } from '@garsonless/application/tables'
import { createServiceClient } from '../src/client'
import { createDashboardTablePort } from '../src/table-command-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId: string | null = null

async function main() {
  let primaryError: unknown = null
  try {
    // Test Cafe B is read only: only its existing owner is used for the
    // disposable tenant below. No Test Cafe B or maf-lounge rows are mutated.
    const { data: fixture, error: fixtureError } = await service
      .from('restaurants')
      .select('owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .insert({
        owner_id: fixture.owner_id,
        slug: `plan-cap-${suffix}`,
        name: `Plan cap ${suffix}`,
        plan: 'free',
        settings: { runtimeMarker: suffix },
      })
      .select('id')
      .single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Temporary restaurant unavailable')
    restaurantId = restaurant.id

    const context = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['tables'],
    }
    const port = createDashboardTablePort()
    const freeAttempts = await Promise.all(
      ['Masa 1', 'Masa 2', 'Masa 3', 'Masa 4'].map((label) => createDashboardTable(
        context,
        { restaurantId: restaurant.id, label },
        port,
      )),
    )
    const createdAtFree = freeAttempts.filter(
      (result) => result.ok && result.value.kind === 'created',
    )
    const cappedAtFree = freeAttempts.filter(
      (result) => result.ok && result.value.kind === 'plan_limit',
    )
    assert(createdAtFree.length === 3, `Free plan created ${createdAtFree.length}, expected 3`)
    assert(cappedAtFree.length === 1, `Free plan limit results ${cappedAtFree.length}, expected 1`)
    assert(cappedAtFree[0]?.ok && cappedAtFree[0].value.limit === 3, 'Free table cap did not return 3')

    const [{ count: activeTables }, { count: activeTokens }] = await Promise.all([
      service.from('tables').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id).is('deleted_at', null),
      service.from('table_qr_tokens').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id).is('revoked_at', null),
    ])
    assert(activeTables === 3, `Expected 3 persisted tables, received ${activeTables}`)
    assert(activeTokens === 3, `Expected one active QR token per table, received ${activeTokens}`)

    const { error: planUpdateError } = await service
      .from('restaurants')
      .update({ plan: 'starter' })
      .eq('id', restaurant.id)
    if (planUpdateError) throw planUpdateError

    const afterUpgrade = await createDashboardTable(
      context,
      { restaurantId: restaurant.id, label: 'Masa 5' },
      port,
    )
    assert(afterUpgrade.ok && afterUpgrade.value.kind === 'created', 'Starter upgrade did not reopen table creation')

    console.log(JSON.stringify({
      freePlan: {
        attempts: freeAttempts.map((result) => result.ok ? result.value.kind : result.error),
        activeTables,
        activeTokens,
      },
      starterUpgrade: afterUpgrade.ok ? afterUpgrade.value.kind : afterUpgrade.error,
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
    const { count } = await service.from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('id', restaurantId)
    assert(count === 0, 'Temporary plan-limit restaurant was not deleted')
    console.log(JSON.stringify({ cleanup: { restaurant: count } }))
  }
  if (primaryError) throw primaryError
}

void main()
