import { createHash, randomBytes } from 'node:crypto'
import { createServiceClient } from './client'

// The grantable dashboard sections (kept in sync with the dashboard nav).
export const TEAM_SECTIONS = [
  'pano', 'orders', 'menu', 'tables', 'customers', 'analytics', 'theme', 'settings',
] as const
export type TeamSection = (typeof TEAM_SECTIONS)[number]

export type MemberStatus = 'invited' | 'active' | 'disabled'

export interface TeamMember {
  id: string
  userId: string | null
  email: string
  permissions: TeamSection[]
  status: MemberStatus
  invitedAt: string
  acceptedAt: string | null
}

export interface ResolvedInvite {
  memberId: string
  restaurantId: string
  restaurantName: string
  email: string
  permissions: TeamSection[]
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Random, URL-safe single-use invite token (the raw value is only emailed). */
export function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

export function sanitizeTeamPermissions(perms: unknown): TeamSection[] {
  if (!Array.isArray(perms)) return []
  const valid = perms.filter((p): p is TeamSection => typeof p === 'string' && (TEAM_SECTIONS as readonly string[]).includes(p))
  return Array.from(new Set(valid))
}

interface MemberRow {
  id: string
  user_id: string | null
  email: string
  permissions: unknown
  status: string
  invited_at: string
  accepted_at: string | null
}

function mapMember(row: MemberRow): TeamMember {
  const status: MemberStatus = row.status === 'active' || row.status === 'disabled' ? row.status : 'invited'
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    permissions: sanitizeTeamPermissions(row.permissions),
    status,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  }
}

const MEMBER_COLS = 'id, user_id, email, permissions, status, invited_at, accepted_at'

/** All members of a restaurant (service role; caller owner-gates). No token hash. */
export async function listTeamMembers(restaurantId: string): Promise<TeamMember[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('restaurant_members')
    .select(MEMBER_COLS)
    .eq('restaurant_id', restaurantId)
    .order('invited_at', { ascending: true })
  return ((data ?? []) as MemberRow[]).map(mapMember)
}

export type CreateInviteResult =
  | { ok: true; token: string; memberId: string; email: string; reinvited: boolean }
  | { ok: false; error: 'no_permissions' | 'already_member' | string }

/**
 * Create or refresh an invite (service role; caller owner-gates). Stores
 * sha256(token) + a 7-day expiry; returns the RAW token for the email link.
 * Re-inviting a still-pending email regenerates its token in place.
 */
export async function createInvite(input: {
  restaurantId: string
  email: string
  permissions: unknown
  invitedBy: string
}): Promise<CreateInviteResult> {
  const sb = createServiceClient()
  const email = input.email.trim().toLowerCase()
  const permissions = sanitizeTeamPermissions(input.permissions)
  if (permissions.length === 0) return { ok: false, error: 'no_permissions' }

  const token = generateInviteToken()
  const tokenHash = hashToken(token)
  const expires = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  const now = new Date().toISOString()

  const { data: existing } = await sb
    .from('restaurant_members')
    .select('id, status')
    .eq('restaurant_id', input.restaurantId)
    .eq('email', email)
    .neq('status', 'disabled')
    .maybeSingle()

  const ex = existing as { id: string; status: string } | null
  if (ex?.status === 'active') return { ok: false, error: 'already_member' }

  if (ex?.status === 'invited') {
    const { error } = await sb
      .from('restaurant_members')
      .update({ permissions, invite_token_hash: tokenHash, invite_expires_at: expires, invited_by: input.invitedBy, invited_at: now })
      .eq('id', ex.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, token, memberId: ex.id, email, reinvited: true }
  }

  const { data: inserted, error } = await sb
    .from('restaurant_members')
    .insert({
      restaurant_id: input.restaurantId,
      email,
      permissions,
      status: 'invited',
      invited_by: input.invitedBy,
      invited_at: now,
      invite_token_hash: tokenHash,
      invite_expires_at: expires,
    })
    .select('id')
    .single()
  if (error || !inserted) return { ok: false, error: error?.message ?? 'insert_failed' }
  return { ok: true, token, memberId: (inserted as { id: string }).id, email, reinvited: false }
}

/** Resolve a raw token → pending invite (hash match, status='invited', unexpired). */
export async function resolveInviteByToken(token: string): Promise<ResolvedInvite | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('restaurant_members')
    .select('id, restaurant_id, email, permissions, invite_expires_at, restaurants(name)')
    .eq('invite_token_hash', hashToken(token))
    .eq('status', 'invited')
    .maybeSingle()
  if (!data) return null
  const row = data as { id: string; restaurant_id: string; email: string; permissions: unknown; invite_expires_at: string | null; restaurants: { name: string } | null }
  if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() < Date.now()) return null
  return {
    memberId: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurants?.name ?? '',
    email: row.email,
    permissions: sanitizeTeamPermissions(row.permissions),
  }
}

export type AcceptInviteResult =
  | { ok: true; restaurantId: string; permissions: TeamSection[] }
  | { ok: false; error: 'invalid_or_expired' | 'email_mismatch' | string; inviteEmail?: string }

/**
 * Accept an invite: link user_id, activate, single-use-consume the token.
 * SECURITY: only links when the authenticated email matches the invite email
 * (case-insensitive) → no invite hijack.
 */
export async function acceptInvite(input: {
  token: string
  userId: string
  userEmail: string
}): Promise<AcceptInviteResult> {
  const sb = createServiceClient()
  const resolved = await resolveInviteByToken(input.token)
  if (!resolved) return { ok: false, error: 'invalid_or_expired' }
  if (resolved.email.toLowerCase() !== input.userEmail.trim().toLowerCase()) {
    return { ok: false, error: 'email_mismatch', inviteEmail: resolved.email }
  }

  // Already an active member via a different row → consume this token, keep it.
  const { data: existingActive } = await sb
    .from('restaurant_members')
    .select('id')
    .eq('restaurant_id', resolved.restaurantId)
    .eq('user_id', input.userId)
    .eq('status', 'active')
    .maybeSingle()
  if (existingActive && (existingActive as { id: string }).id !== resolved.memberId) {
    await sb.from('restaurant_members')
      .update({ status: 'disabled', invite_token_hash: null, invite_expires_at: null })
      .eq('id', resolved.memberId)
    return { ok: true, restaurantId: resolved.restaurantId, permissions: resolved.permissions }
  }

  const { error } = await sb
    .from('restaurant_members')
    .update({ user_id: input.userId, status: 'active', accepted_at: new Date().toISOString(), invite_token_hash: null, invite_expires_at: null })
    .eq('id', resolved.memberId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, restaurantId: resolved.restaurantId, permissions: resolved.permissions }
}

/** Update a member's section permissions (service role; caller owner-gates). */
export async function updateMemberPermissions(restaurantId: string, memberId: string, permissions: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('restaurant_members')
    .update({ permissions: sanitizeTeamPermissions(permissions) })
    .eq('id', memberId)
    .eq('restaurant_id', restaurantId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function setMemberStatus(restaurantId: string, memberId: string, status: 'active' | 'disabled'): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('restaurant_members')
    .update({ status })
    .eq('id', memberId)
    .eq('restaurant_id', restaurantId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function removeMember(restaurantId: string, memberId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('restaurant_members')
    .delete()
    .eq('id', memberId)
    .eq('restaurant_id', restaurantId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type ResendInviteResult = { ok: true; token: string; email: string } | { ok: false; error: 'not_pending' | string }

/** Regenerate the token+expiry for a still-pending invite. */
export async function resendInvite(restaurantId: string, memberId: string): Promise<ResendInviteResult> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('restaurant_members')
    .select('id, email, status')
    .eq('id', memberId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  const row = data as { id: string; email: string; status: string } | null
  if (!row || row.status !== 'invited') return { ok: false, error: 'not_pending' }
  const token = generateInviteToken()
  const { error } = await sb
    .from('restaurant_members')
    .update({ invite_token_hash: hashToken(token), invite_expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(), invited_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('restaurant_id', restaurantId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, token, email: row.email }
}
