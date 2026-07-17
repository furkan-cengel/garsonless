import test from 'node:test'
import assert from 'node:assert/strict'
import { err, ok } from '@garsonless/domain'
import {
  createMenuItem,
  reorderMenuCategories,
  updateMenuItem,
  type MenuCommandPort,
} from './menu'

const context = {
  actor: 'dashboard-member' as const,
  restaurantId: 'restaurant-a',
  userId: 'staff-a',
  permissions: ['menu'],
}

function port(): MenuCommandPort<{ id: string; reviewedAt?: string | null }> {
  return {
    createCategory: async () => ok({ id: 'category' }),
    updateCategory: async () => ok(null),
    deleteCategory: async () => ok(null),
    reorderCategories: async () => ok(null),
    createItem: async () => ok({ id: 'item' }),
    readItemPolicyState: async () => ok({
      is_vegetarian: true,
      is_vegan: false,
      is_halal: false,
      contains_alcohol: false,
      contains_pork: false,
      contains_allergens: ['milk'],
      may_contain_allergens: ['sesame'],
    }),
    updateItem: async (input) => ok({
      id: input.id,
      ...(input.food_info_reviewed_at !== undefined
        ? { reviewedAt: input.food_info_reviewed_at }
        : {}),
    }),
    deleteItem: async () => ok(null),
    setItemsAvailability: async () => ok(null),
  }
}

test('rejects cross-tenant and missing-menu permission commands', async () => {
  const base = port()
  assert.deepEqual(await createMenuItem(
    context,
    { restaurantId: 'restaurant-b', categoryId: 'category', name: 'Latte', price: 10, is_available: true },
    base,
  ), err('Not authorized'))
  assert.deepEqual(await createMenuItem(
    { ...context, permissions: ['orders'] },
    { restaurantId: 'restaurant-a', categoryId: 'category', name: 'Latte', price: 10, is_available: true },
    base,
  ), err('Not authorized'))
})

test('enforces dietary policy before persistence', async () => {
  const result = await createMenuItem(context, {
    restaurantId: 'restaurant-a',
    categoryId: 'category',
    name: 'Contradictory item',
    price: 10,
    is_available: true,
    is_vegan: true,
    is_vegetarian: false,
  }, port())
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /Vegan/)
})

test('normalizes allergens and review state in the application command', async () => {
  let patch: Parameters<MenuCommandPort<{ id: string }>['updateItem']>[0] | null = null
  const base = port()
  const recording: MenuCommandPort<{ id: string }> = {
    ...base,
    updateItem: async (input) => {
      patch = input
      return ok({ id: input.id })
    },
  }
  const result = await updateMenuItem(context, {
    id: 'item',
    restaurantId: 'restaurant-a',
    contains_allergens: ['milk'],
    may_contain_allergens: ['milk', 'sesame'],
    food_info_reviewed: true,
  }, recording, new Date('2026-07-15T09:00:00.000Z'))
  assert.equal(result.ok, true)
  const recorded = patch as Parameters<MenuCommandPort<{ id: string }>['updateItem']>[0] | null
  assert.deepEqual(recorded?.contains_allergens, ['milk'])
  assert.deepEqual(recorded?.may_contain_allergens, ['sesame'])
  assert.equal(recorded?.food_info_reviewed_by, 'staff-a')
  assert.equal(recorded?.food_info_reviewed_at, '2026-07-15T09:00:00.000Z')
})

test('rejects duplicate reorder ids without touching infrastructure', async () => {
  const base = port()
  let called = false
  base.reorderCategories = async () => {
    called = true
    return ok(null)
  }
  const result = await reorderMenuCategories(context, {
    restaurantId: 'restaurant-a',
    orderedIds: ['one', 'one'],
  }, base)
  assert.equal(result.ok, false)
  assert.equal(called, false)
})
