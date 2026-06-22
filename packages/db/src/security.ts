import { createServiceClient } from './client'

export type SecurityEventType = 'login' | 'password_change'

export interface SecurityEvent {
  id: string
  eventType: SecurityEventType
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface RecordSecurityEventInput {
  userId: string
  eventType: SecurityEventType
  ip?: string | null
  userAgent?: string | null
  /** Optional venue attribution for future team-scoped events. Null for logins. */
  restaurantId?: string | null
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
    await supabase.from('security_events').insert({
      user_id: input.userId,
      event_type: input.eventType,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      restaurant_id: input.restaurantId ?? null,
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
    .select('id, event_type, ip, user_agent, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as Array<{
    id: string
    event_type: string
    ip: string | null
    user_agent: string | null
    created_at: string
  }>).map(row => ({
    id: row.id,
    eventType: row.event_type as SecurityEventType,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }))
}
