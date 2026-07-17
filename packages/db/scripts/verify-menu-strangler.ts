import { randomUUID } from 'node:crypto'
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  reorderMenuCategories,
  setMenuItemsAvailability,
  updateMenuItem,
} from '@garsonless/application/menu'
import { createClient, createServiceClient } from '../src/client'
import { createMenuCommandPort } from '../src/menu-command-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const anon = createClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  try {
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
        slug: `menu-strangler-${suffix}`,
        name: `Menu strangler ${suffix}`,
        settings: {},
      })
      .select('id')
      .single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const context = {
      actor: 'dashboard-member' as const,
      restaurantId,
      userId: fixture.owner_id,
      permissions: ['menu'],
    }
    const port = createMenuCommandPort()

    const firstCategory = await createMenuCategory(context, {
      restaurantId,
      name: 'Kahve',
      vat_rate: 10,
    }, port)
    assert(firstCategory.ok, firstCategory.ok ? '' : firstCategory.error)
    const secondCategory = await createMenuCategory(context, {
      restaurantId,
      name: 'Tatlı',
      vat_rate: 10,
    }, port)
    assert(secondCategory.ok, secondCategory.ok ? '' : secondCategory.error)

    const created = await createMenuItem(context, {
      restaurantId,
      categoryId: firstCategory.value.id,
      name: 'Runtime Latte',
      price: 65,
      is_available: true,
      is_vegetarian: true,
      contains_allergens: ['milk'],
      may_contain_allergens: ['milk', 'sesame'],
      food_info_reviewed: false,
    }, port)
    assert(created.ok, created.ok ? '' : created.error)

    const updated = await updateMenuItem(context, {
      id: created.value.id,
      restaurantId,
      energy_kcal: 120,
      food_info_reviewed: true,
    }, port, new Date('2026-07-15T09:00:00.000Z'))
    assert(updated.ok, updated.ok ? '' : updated.error)

    const availability = await setMenuItemsAvailability(context, {
      restaurantId,
      itemIds: [created.value.id],
      isAvailable: false,
    }, port)
    assert(availability.ok, availability.ok ? '' : availability.error)

    const reordered = await reorderMenuCategories(context, {
      restaurantId,
      orderedIds: [secondCategory.value.id, firstCategory.value.id],
    }, port)
    assert(reordered.ok, reordered.ok ? '' : reordered.error)

    const { data: persisted, error: persistedError } = await service
      .from('menu_items')
      .select('id, is_available, contains_allergens, may_contain_allergens, energy_kcal, food_info_reviewed_at, food_info_reviewed_by')
      .eq('id', created.value.id)
      .single()
    if (persistedError) throw persistedError
    assert(persisted.is_available === false, 'Availability command did not persist')
    assert(JSON.stringify(persisted.contains_allergens) === JSON.stringify(['milk']), 'Contains allergens mismatch')
    assert(JSON.stringify(persisted.may_contain_allergens) === JSON.stringify(['sesame']), 'Trace allergens were not de-duplicated')
    assert(persisted.energy_kcal === 120, 'Partial update did not persist nutrition')
    assert(persisted.food_info_reviewed_by === fixture.owner_id, 'Review actor mismatch')

    const crossTenant = await createMenuCategory({ ...context, restaurantId: randomUUID() }, {
      restaurantId,
      name: 'Blocked',
    }, port)
    assert(!crossTenant.ok && crossTenant.error === 'Not authorized', 'Cross-tenant replay was not rejected')

    const anonRpc = await anon.rpc('set_menu_items_availability', {
      p_restaurant_id: restaurantId,
      p_item_ids: [created.value.id],
      p_is_available: true,
    })
    assert(anonRpc.error?.code === '42501', `Anon RPC was not denied: ${anonRpc.error?.code ?? 'none'}`)

    const deletedItem = await deleteMenuItem(context, {
      restaurantId,
      itemId: created.value.id,
    }, port)
    assert(deletedItem.ok, deletedItem.ok ? '' : deletedItem.error)
    const deletedCategory = await deleteMenuCategory(context, {
      restaurantId,
      categoryId: secondCategory.value.id,
    }, port)
    assert(deletedCategory.ok, deletedCategory.ok ? '' : deletedCategory.error)

    console.log(JSON.stringify({
      restaurantId,
      categoryIds: [firstCategory.value.id, secondCategory.value.id],
      itemId: created.value.id,
      persisted: {
        isAvailable: persisted.is_available,
        contains: persisted.contains_allergens,
        traces: persisted.may_contain_allergens,
        energyKcal: persisted.energy_kcal,
        reviewedAt: persisted.food_info_reviewed_at,
        reviewedBy: persisted.food_info_reviewed_by,
      },
      crossTenantRejected: !crossTenant.ok,
      anonRpcCode: anonRpc.error?.code,
      softDeleteAndCategoryDelete: true,
    }, null, 2))
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    const { count } = await service
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('id', restaurantId || randomUUID())
    console.log(JSON.stringify({ cleanup: { restaurantOrphans: count } }))
  }
}

void main()
