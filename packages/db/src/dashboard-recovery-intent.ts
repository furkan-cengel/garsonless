import { createHmac } from 'node:crypto'
import { createServiceClient } from './service-client'
/** Provider recovery and magic-link token types overlap; attest the actual email purpose. */
export async function findDashboardRecoveryEmail(input: { tokenHash?: string; email?: string; code?: string }): Promise<{ userId: string } | null> {
  const client = createServiceClient()
  let query = client.from('dashboard_recovery_email_intents').select('user_id').gt('expires_at', new Date().toISOString())
  if (input.tokenHash) query = query.eq('token_hash', input.tokenHash)
  else {
    if (!input.email || !input.code) return null
    const email = input.email.trim().toLowerCase()
    const digest = createHmac('sha256', process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '').update('masabu-recovery-code:' + email + ':' + input.code).digest('hex')
    query = query.eq('email', email).eq('otp_digest', digest)
  }
  const {data,error} = await query.maybeSingle()
  if (error) throw new Error('Recovery verification unavailable')
  return data ? {userId:data.user_id} : null
}
