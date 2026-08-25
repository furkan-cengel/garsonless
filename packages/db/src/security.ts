import { createServiceClient } from './service-client'

export type TeamSecurityEventType =
  | 'team_member_invited'
  | 'team_invite_resent'
  | 'team_member_permissions_updated'
  | 'team_member_disabled'
  | 'team_member_activated'
  | 'team_member_removed'
  | 'team_invite_accepted'

export const TEAM_SECURITY_EVENT_TYPES: readonly TeamSecurityEventType[] = [
  'team_member_invited',
  'team_invite_resent',
  'team_member_permissions_updated',
  'team_member_disabled',
  'team_member_activated',
  'team_member_removed',
  'team_invite_accepted',
]

export type SecurityEventType = 'login' | 'password_change' | TeamSecurityEventType

export interface SecurityEventMetadata {
  targetEmail?: string
  permissions?: string[]
}

export interface SecurityEvent {
  id: string
  eventType: SecurityEventType
  ip: string | null
  userAgent: string | null
  metadata: SecurityEventMetadata
  createdAt: string
}

export interface RecordSecurityEventInput {
  userId: string
  eventType: SecurityEventType
  ip?: string | null
  userAgent?: string | null
  /** Optional venue attribution for future team-scoped events. Null for logins. */
  restaurantId?: string | null
  metadata?: SecurityEventMetadata
}

/**
 * Best-effort security audit write (service role). NEVER throws — a logging
 * failure must never block a login or a password change. Writes go through the
 * service role because `security_events` has no authenticated write policy, so
 * a user can never forge or tamper with their own audit trail.
 */
export async function recordSecurityEvent(input: RecordSecurityEventInput): Promise<void> {
  try {
    const supabase = createServiceClient()
    // Generated Supabase Json types require an index signature; construct the
    // persisted shape explicitly instead of casting application input through.
    const metadata: Record<string, string | string[]> = {}
    if (input.metadata?.targetEmail) metadata['targetEmail'] = input.metadata.targetEmail
    if (input.metadata?.permissions) metadata['permissions'] = input.metadata.permissions
    await supabase.from('security_events').insert({
      user_id: input.userId,
      event_type: input.eventType,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      restaurant_id: input.restaurantId ?? null,
      metadata,
    })
  } catch {
    // best-effort: swallow — auditing must not break the auth flow
  }
}

/**
 * Read a user's recent security events (service role, hard-scoped by userId).
 * The dashboard UI reads through the RLS-enforced authenticated client instead;
 * this helper exists for server contexts that already hold a verified user id.
 */
export async function getSecurityEvents(userId: string, limit = 20): Promise<SecurityEvent[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('security_events')
    .select('id, event_type, ip, user_agent, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as Array<{
    id: string
    event_type: string
    ip: string | null
    user_agent: string | null
    metadata: unknown
    created_at: string
  }>).map(row => ({
    id: row.id,
    eventType: row.event_type as SecurityEventType,
    ip: row.ip,
    userAgent: row.user_agent,
    metadata: isSecurityEventMetadata(row.metadata),
    createdAt: row.created_at,
  }))
}

function isSecurityEventMetadata(value: unknown): SecurityEventMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  return {
    ...(typeof source['targetEmail'] === 'string' ? { targetEmail: source['targetEmail'] } : {}),
    ...(Array.isArray(source['permissions'])
      ? { permissions: source['permissions'].filter((item): item is string => typeof item === 'string') }
      : {}),
  }
}
