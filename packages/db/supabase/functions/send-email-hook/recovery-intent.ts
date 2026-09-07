/** Called only after authenticating the Supabase send-email webhook. */
export async function recordDashboardRecoveryEmail(input: { actionType: string; redirectTo: string; userId: string; email: string; token: string; tokenHash: string; supabaseUrl: string; serviceKey: string }, request: typeof fetch = fetch): Promise<void> {
  if (input.actionType !== 'recovery') return
  let target: URL
  try { target = new URL(input.redirectTo) } catch { return }
  const origins = ['https://app.masabu.co', 'https://sandbox.masabu.co', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3002', 'http://127.0.0.1:3002']
  if (!origins.includes(target.origin) || target.pathname !== '/auth/confirm') return
  if (!input.serviceKey || !input.userId) throw new Error('Recovery intent storage unavailable')
  const email = input.email.trim().toLowerCase()
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(input.serviceKey), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode('masabu-recovery-code:' + email + ':' + input.token))
  const digest = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2,'0')).join('')
  const response = await request(input.supabaseUrl + '/rest/v1/dashboard_recovery_email_intents?on_conflict=token_hash', {
    method: 'POST', headers: {apikey:input.serviceKey, Authorization:'Bearer '+input.serviceKey, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates'},
    body: JSON.stringify({token_hash:input.tokenHash, otp_digest:digest, user_id:input.userId, email, expires_at:new Date(Date.now()+3600_000).toISOString()})
  })
  if (!response.ok) throw new Error('Recovery intent storage unavailable')
}
