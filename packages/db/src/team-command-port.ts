import type { TeamCommandPort } from '@garsonless/application/team'
import { err, ok } from '@garsonless/domain'
import {
  acceptInvite,
  createInvite,
  removeMember,
  resendInvite,
  setMemberStatus,
  updateMemberPermissions,
} from './team'

/** Server-only adapter; authorization belongs to @garsonless/application/team. */
export function createTeamCommandPort(): TeamCommandPort {
  return {
    async createInvite(input) {
      const result = await createInvite(input)
      return result.ok
        ? ok({ token: result.token, email: result.email, permissions: result.permissions, reinvited: result.reinvited })
        : err(result.error)
    },

    async updatePermissions(input) {
      const result = await updateMemberPermissions(input.restaurantId, input.memberId, input.permissions)
      return result.ok ? ok(result.target) : err(result.error)
    },

    async setStatus(input) {
      const result = await setMemberStatus(input.restaurantId, input.memberId, input.status)
      return result.ok ? ok(result.target) : err(result.error)
    },

    async remove(input) {
      const result = await removeMember(input.restaurantId, input.memberId)
      return result.ok ? ok(result.target) : err(result.error)
    },

    async resendInvite(input) {
      const result = await resendInvite(input.restaurantId, input.memberId)
      return result.ok
        ? ok({ token: result.token, email: result.email, permissions: result.permissions })
        : err(result.error)
    },

    async acceptInvite(input) {
      const result = await acceptInvite(input)
      return result.ok
        ? ok({ restaurantId: result.restaurantId, email: result.email, permissions: result.permissions })
        : {
          ok: false,
          error: result.error,
          ...(result.inviteEmail ? { inviteEmail: result.inviteEmail } : {}),
        }
    },
  }
}
