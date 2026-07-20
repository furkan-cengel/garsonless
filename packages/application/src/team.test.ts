import test from 'node:test'
import assert from 'node:assert/strict'
import { err, ok } from '@garsonless/domain'
import {
  acceptTeamInvite,
  inviteTeamMember,
  removeTeamMember,
  setTeamMemberStatus,
  updateTeamMemberPermissions,
  type TeamCommandPort,
} from './team'

const owner = {
  actor: 'dashboard-member' as const,
  userId: 'owner-a',
  restaurantId: 'restaurant-a',
  permissions: ['settings'],
  isOwner: true,
}

function port(): TeamCommandPort {
  return {
    createInvite: async (input) => ok({ token: 'x'.repeat(64), email: input.email, permissions: input.permissions, reinvited: false }),
    updatePermissions: async (input) => ok({ email: 'member@example.com', permissions: input.permissions, status: 'active' }),
    setStatus: async (input) => ok({ email: 'member@example.com', permissions: ['orders'], status: input.status }),
    remove: async () => ok({ email: 'member@example.com' }),
    resendInvite: async () => ok({ token: 'x'.repeat(64), email: 'member@example.com', permissions: ['orders'] }),
    acceptInvite: async () => ok({ restaurantId: 'restaurant-a', email: 'member@example.com', permissions: ['orders'] }),
  }
}

test('team commands reject cross-tenant and non-owner actors before persistence', async () => {
  const base = port()
  let calls = 0
  base.createInvite = async () => { calls += 1; return err('should_not_run') }
  assert.deepEqual(await inviteTeamMember(owner, {
    restaurantId: 'restaurant-b', email: 'member@example.com', permissions: ['orders'],
  }, base), err('Not authorized'))
  assert.deepEqual(await removeTeamMember({ ...owner, isOwner: false }, {
    restaurantId: 'restaurant-a', memberId: 'member-a',
  }, base), err('Not authorized'))
  assert.equal(calls, 0)
})

test('team commands normalize grants and fail before persistence on invalid inputs', async () => {
  const base = port()
  let inviteInput: Parameters<TeamCommandPort['createInvite']>[0] | null = null
  base.createInvite = async (input) => { inviteInput = input; return ok({ token: 'x'.repeat(64), email: input.email, permissions: input.permissions, reinvited: false }) }
  assert.equal((await inviteTeamMember(owner, {
    restaurantId: 'restaurant-a', email: ' STAFF@Example.com ', permissions: ['orders', 'orders', 'unknown'],
  }, base)).ok, true)
  assert.deepEqual(inviteInput, {
    restaurantId: 'restaurant-a', email: 'staff@example.com', permissions: ['orders'], invitedBy: 'owner-a',
  })
  assert.deepEqual(await updateTeamMemberPermissions(owner, {
    restaurantId: 'restaurant-a', memberId: 'member-a', permissions: ['unknown'],
  }, base), err('En az bir bölüm seç'))
})

test('status and acceptance commands preserve their distinct authority boundaries', async () => {
  const base = port()
  let status = ''
  base.setStatus = async (input) => { status = input.status; return ok({ email: 'member@example.com', permissions: ['orders'], status: input.status }) }
  assert.equal((await setTeamMemberStatus(owner, {
    restaurantId: 'restaurant-a', memberId: 'member-a', status: 'disabled',
  }, base)).ok, true)
  assert.equal(status, 'disabled')

  assert.deepEqual(await acceptTeamInvite({
    token: 'short', userId: 'user-a', userEmail: 'member@example.com',
  }, base), err('invalid_or_expired'))
  assert.equal((await acceptTeamInvite({
    token: 'x'.repeat(64), userId: 'user-a', userEmail: 'MEMBER@example.com',
  }, base)).ok, true)

  base.acceptInvite = async () => ({
    ok: false,
    error: 'email_mismatch',
    inviteEmail: 'member@example.com',
  })
  assert.deepEqual(await acceptTeamInvite({
    token: 'x'.repeat(64), userId: 'user-a', userEmail: 'other@example.com',
  }, base), {
    ok: false,
    error: 'email_mismatch',
    inviteEmail: 'member@example.com',
  })
})
