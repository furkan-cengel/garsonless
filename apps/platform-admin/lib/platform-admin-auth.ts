import { resolvePlatformAdminActor, type PlatformAdminAccessError } from '@garsonless/application/platform-admin'
import { createPlatformAdminIdentityPort } from '@garsonless/db/server'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { redirect } from 'next/navigation'
import { createPlatformAdminServerClient } from './supabase-server'

export async function requirePlatformAdminActor(): Promise<PlatformAdminActorContext> {
  const supabase = await createPlatformAdminServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const currentAal = assurance?.currentLevel === 'aal2'
    ? 'aal2'
    : assurance?.currentLevel === 'aal1' ? 'aal1' : null
  const result = await resolvePlatformAdminActor(
    { userId: user.id, currentAal },
    createPlatformAdminIdentityPort(),
  )
  if (!result.ok) routeAccessError(result.error)
  return result.value
}

function routeAccessError(error: PlatformAdminAccessError): never {
  if (error === 'Platform admin MFA is required') redirect('/auth/mfa')
  redirect('/auth/denied')
}
