import {
  err,
  hasSameRestaurant,
  isValidTeamEmail,
  normalizeTeamEmail,
  ok,
  sanitizeTeamPermissions,
  type DashboardActorContext,
  type Result,
  type TeamMemberStatus,
  type TeamSection,
} from '@garsonless/domain'

export interface TeamCommandTarget {
  email: string
  permissions: TeamSection[]
  status: TeamMemberStatus
}

/**
 * Invite acceptance is the one command whose rejected outcome needs a small
 * amount of safe context for the UI. Keeping this separate from the generic
 * Result avoids throwing away the invited email on an email-mismatch screen.
 */
export type AcceptTeamInviteResult =
  | { ok: true; value: { restaurantId: string; email: string; permissions: TeamSection[] } }
  | { ok: false; error: string; inviteEmail?: string }

export interface TeamCommandPort {
  createInvite(input: {
    restaurantId: string
    email: string
    permissions: TeamSection[]
    invitedBy: string
  }): Promise<Result<{ token: string; email: string; permissions: TeamSection[]; reinvited: boolean }>>
  updatePermissions(input: {
    restaurantId: string
    memberId: string
    permissions: TeamSection[]
  }): Promise<Result<TeamCommandTarget>>
  setStatus(input: {
    restaurantId: string
    memberId: string
    status: 'active' | 'disabled'
  }): Promise<Result<TeamCommandTarget>>
  remove(input: {
    restaurantId: string
    memberId: string
  }): Promise<Result<{ email: string }>>
  resendInvite(input: {
    restaurantId: string
    memberId: string
  }): Promise<Result<{ token: string; email: string; permissions: TeamSection[] }>>
  acceptInvite(input: {
    token: string
    userId: string
    userEmail: string
  }): Promise<AcceptTeamInviteResult>
}

function requireTeamOwner(context: DashboardActorContext, restaurantId: string): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.isOwner === true
    ? ok(true)
    : err('Not authorized')
}

function validPermissions(value: unknown): Result<TeamSection[]> {
  const permissions = sanitizeTeamPermissions(value)
  return permissions.length > 0 ? ok(permissions) : err('En az bir bölüm seç')
}

export async function inviteTeamMember(
  context: DashboardActorContext,
  input: { restaurantId: string; email: string; permissions: unknown },
  port: TeamCommandPort,
): Promise<Result<{ token: string; email: string; permissions: TeamSection[]; reinvited: boolean }>> {
  const access = requireTeamOwner(context, input.restaurantId)
  if (!access.ok) return access
  const email = normalizeTeamEmail(input.email)
  if (!isValidTeamEmail(email)) return err('Geçersiz davet e-postası')
  const permissions = validPermissions(input.permissions)
  if (!permissions.ok) return permissions
  return port.createInvite({
    restaurantId: input.restaurantId,
    email,
    permissions: permissions.value,
    invitedBy: context.userId,
  })
}

export async function updateTeamMemberPermissions(
  context: DashboardActorContext,
  input: { restaurantId: string; memberId: string; permissions: unknown },
  port: TeamCommandPort,
): Promise<Result<TeamCommandTarget>> {
  const access = requireTeamOwner(context, input.restaurantId)
  if (!access.ok) return access
  const permissions = validPermissions(input.permissions)
  if (!permissions.ok) return permissions
  return port.updatePermissions({ ...input, permissions: permissions.value })
}

export async function setTeamMemberStatus(
  context: DashboardActorContext,
  input: { restaurantId: string; memberId: string; status: 'active' | 'disabled' },
  port: TeamCommandPort,
): Promise<Result<TeamCommandTarget>> {
  const access = requireTeamOwner(context, input.restaurantId)
  return access.ok ? port.setStatus(input) : access
}

export async function removeTeamMember(
  context: DashboardActorContext,
  input: { restaurantId: string; memberId: string },
  port: TeamCommandPort,
): Promise<Result<{ email: string }>> {
  const access = requireTeamOwner(context, input.restaurantId)
  return access.ok ? port.remove(input) : access
}

export async function resendTeamInvite(
  context: DashboardActorContext,
  input: { restaurantId: string; memberId: string },
  port: TeamCommandPort,
): Promise<Result<{ token: string; email: string; permissions: TeamSection[] }>> {
  const access = requireTeamOwner(context, input.restaurantId)
  return access.ok ? port.resendInvite(input) : access
}

/** Invite acceptance is bound to the authenticated user's verified email. */
export async function acceptTeamInvite(
  input: { token: string; userId: string; userEmail: string },
  port: TeamCommandPort,
): Promise<AcceptTeamInviteResult> {
  if (input.token.length < 16 || !isValidTeamEmail(input.userEmail)) return err('invalid_or_expired')
  return port.acceptInvite({ ...input, userEmail: normalizeTeamEmail(input.userEmail) })
}
