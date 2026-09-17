import assert from 'node:assert/strict'
import test from 'node:test'
import { executeMenuBulk, type MenuBulkPort, type MenuBulkRequest } from './menu-bulk'
import type { DashboardActorContext } from '@garsonless/domain/context'
const actor: DashboardActorContext = { actor: 'dashboard-member', userId: 'owner', restaurantId: 'one', permissions: ['menu'] }
const request: MenuBulkRequest = { restaurantId: 'one', mode: 'apply', requestId: 'request', patches: [{ id: 'product', expectedUpdatedAt: 'version', changes: { price: 100 } }] }
test('bulk authorization precedes persistence for every operation', async () => {
  let calls = 0
  const port: MenuBulkPort = { execute: async () => { calls++; return { ok: true, changes: [] } } }
  for (const mode of ['preview','apply','undo','history','detail','snapshot'] as const) {
    assert.equal((await executeMenuBulk({ ...actor, restaurantId: 'other' }, { ...request, mode }, port)).ok, false)
    assert.equal((await executeMenuBulk({ ...actor, permissions: [] }, { ...request, mode }, port)).ok, false)
  }
  assert.equal(calls, 0)
})
test('authorized team actor is sourced from context; invalid requests never reach DB', async () => {
  let calls = 0
  const port: MenuBulkPort = { execute: async input => { calls++; assert.equal(input.actorId, actor.userId); return { ok: true, changes: [] } } }
  assert.equal((await executeMenuBulk(actor, request, port)).ok, true)
  assert.equal((await executeMenuBulk(actor, { ...request, patches: [] }, port)).ok, false)
  assert.equal((await executeMenuBulk(actor, { restaurantId: 'one', mode: 'undo' }, port)).ok, false)
  assert.equal(calls, 1)
})
