import { finishEmailVerification } from './verification-completion'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { completeDashboardSignupEmailVerification } from '@garsonless/db/server'
import { readFlowGrant, signFlowGrant, sessionIdFromToken, type FlowGrant } from './flow-grant'
import type { createDashboardServerClient } from '../supabase-server'
type DashboardClient = Awaited<ReturnType<typeof createDashboardServerClient>>
const secret = () => process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
const cookieName = (purpose: FlowGrant['purpose']) => 'dashboard_auth_' + purpose
export async function saveFlowGrant(purpose: FlowGrant['purpose'], userId: string, sessionId: string) {
  const value = signFlowGrant({ purpose, userId, sessionId }, secret())
  ;(await cookies()).set(cookieName(purpose), value, { httpOnly: true, secure: process.env['NODE_ENV'] === 'production', sameSite: 'lax', path: '/auth', maxAge: 600 })
}
export async function getFlowGrant(purpose: FlowGrant['purpose']) {
  return readFlowGrant((await cookies()).get(cookieName(purpose))?.value, secret(), purpose)
}
export async function deleteFlowGrant(purpose: FlowGrant['purpose']) {
  ;(await cookies()).set(cookieName(purpose), '', { path: '/auth', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env['NODE_ENV'] === 'production' })
}
export async function validatedFlowSession(client: DashboardClient, purpose: 'recovery' | 'complete') {
  const grant = await getFlowGrant(purpose)
  if (!grant) return null
  const { data: { user } } = await client.auth.getUser()
  if (!user || user.id !== grant.userId) return null
  const { data: { session } } = await client.auth.getSession()
  return sessionIdFromToken(session?.access_token) === grant.sessionId ? { user, grant } : null
}
export async function completeVerifiedSession(client: DashboardClient, user: User, accessToken: string): Promise<boolean> {
  const sessionId = sessionIdFromToken(accessToken)
  if (!sessionId || !user.email_confirmed_at) return false
  await saveFlowGrant('complete', user.id, sessionId)
  const completed = await finishEmailVerification(user.app_metadata?.['dashboard_signup_email_verification_required'] === true, {
    clearMetadata: async () => (await completeDashboardSignupEmailVerification(user.id)).ok,
    refreshSession: async () => !(await client.auth.refreshSession()).error,
  })
  if (!completed) return false
  await deleteFlowGrant('complete')
  return true
}
