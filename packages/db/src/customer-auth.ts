import type { User } from '@supabase/supabase-js'
import { ensureCustomerIdentity } from '@garsonless/application/customers'
import type { CustomerAuthIdentity, EnsureCustomerOptions, EnsureCustomerResult } from '@garsonless/domain'
import { createCustomerIdentityApplicationPort } from './customer-auth-application-port'

export type { EnsureCustomerOptions, EnsureCustomerResult } from '@garsonless/domain'

export function customerAuthIdentityFromUser(user: User): CustomerAuthIdentity {
  return {
    authUserId: user.id,
    email: user.email ?? null,
    userMetadata: user.user_metadata ?? {},
    appMetadata: user.app_metadata ?? {},
  }
}

/** Compatibility facade for consumers that have not moved to application imports. */
export async function ensureCustomerForAuthUser(
  authUser: User,
  options: EnsureCustomerOptions = {},
): Promise<EnsureCustomerResult> {
  return ensureCustomerIdentity(
    customerAuthIdentityFromUser(authUser),
    options,
    createCustomerIdentityApplicationPort(),
  )
}
