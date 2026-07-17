import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  customerActorContext,
  previewLoyaltyDiscount,
  readMemberLoyalty,
  type LoyaltyQueryPort,
} from './loyalty'
import type { MemberBalances } from '@garsonless/domain'

const balances = { points: 80 } as MemberBalances
const port: LoyaltyQueryPort<{ customerId: string | null; points: number }> = {
  async readMemberBalances() { return balances },
  async previewDiscount(input) {
    return { customerId: input.customerId, points: input.requestedPointsRedeem ?? 0 }
  },
}

test('member balance query derives customer authority from trusted context', async () => {
  const result = await readMemberLoyalty(customerActorContext({
    authUserId: 'auth-1',
    customerId: 'customer-1',
    restaurantId: 'restaurant-1',
  }), port)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.value?.points, 80)
})

test('guest discount preview strips redemption requests', async () => {
  const result = await previewLoyaltyDiscount(null, {
    restaurantId: 'restaurant-1',
    lines: [],
    requestedPointsRedeem: 50,
    requestedStampClaim: true,
    requestedCatalogReward: { itemId: 'item-1' },
  }, port)
  assert.deepEqual(result, { ok: true, value: { customerId: null, points: 0 } })
})

test('member context cannot preview another tenant', async () => {
  const result = await previewLoyaltyDiscount(customerActorContext({
    authUserId: 'auth-1',
    customerId: 'customer-1',
    restaurantId: 'restaurant-1',
  }), { restaurantId: 'restaurant-2', lines: [] }, port)
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
})
