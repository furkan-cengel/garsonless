import type { TeamCommandPort } from '@garsonless/application/team'
import { err, ok } from '@garsonless/domain'
import { sanitizeTeamPermissions } from '@garsonless/domain/team'
import { createServiceClient } from './client'
import {
  acceptInvite,
  createInvite,
  resendInvite,
} from './team'

async function mutateTeamMemberWithAudit(input: {
  restaurantId: string
  memberId: string
  actorUserId: string
  operation: 'permissions' | 'status' | 'remove'
  permissions?: string[]
  status?: 'active' | 'disabled'
}) {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as (
    name: 'mutate_team_member_with_audit',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc('mutate_team_member_with_audit', {
    p_restaurant_id: input.restaurantId,
    p_actor_user_id: input.actorUserId,
    p_member_id: input.memberId,
    p_operation: input.operation,
    p_permissions: input.permissions ?? null,
    p_status: input.status ?? null,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return err(error?.message ?? 'team_mutation_failed')
  const row = data as Record<string, unknown>
  if (typeof row['email'] !== 'string') return err('team_mutation_failed')
  const status: 'active' | 'disabled' | 'invited' = row['status'] === 'active' || row['status'] === 'disabled'
    ? row['status']
    : 'invited'
  return ok({
    email: row['email'],
    permissions: sanitizeTeamPermissions(row['permissions']),
    status,
  })
}

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
      return mutateTeamMemberWithAudit({ ...input, operation: 'permissions' })
    },

    async setStatus(input) {
      return mutateTeamMemberWithAudit({ ...input, operation: 'status' })
    },

    async remove(input) {
      const result = await mutateTeamMemberWithAudit({ ...input, operation: 'remove' })
      return result.ok ? ok({ email: result.value.email }) : result
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
