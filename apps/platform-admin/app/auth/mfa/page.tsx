import { readPlatformAdminIdentity } from '@garsonless/application/platform-admin'
import { createPlatformAdminIdentityPort } from '@garsonless/db/server'
import { redirect } from 'next/navigation'
import { createPlatformAdminServerClient } from '../../../lib/supabase-server'
import { MfaChallenge } from './MfaChallenge'

export const dynamic = 'force-dynamic'

export default async function MfaPage() {
  const supabase = await createPlatformAdminServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const identity = await readPlatformAdminIdentity(user.id, createPlatformAdminIdentityPort())
  if (!identity.ok) redirect('/auth/denied')
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel === 'aal2') redirect('/')
  return <main className="auth-wrap"><MfaChallenge /></main>
}
