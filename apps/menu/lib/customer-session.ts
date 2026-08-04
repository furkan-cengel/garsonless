import { cache } from 'react'
import { resolveCustomerIdentityForAuthUser } from '@garsonless/db/server'
import { createMenuServerClient } from './supabase-server'

export interface CustomerSession {
  authUserId: string
  customerId: string
  name: string | null
  email: string | null
  emailVerified: boolean
  phone: string | null
  phoneVerified: boolean
}

/**
 * Resolve the Supabase Auth identity to the service-role-only customer domain
 * row. React cache deduplicates auth + customer lookups within one server
 * request (SSR may need the identity in more than one data loader).
 */
export const getCustomerSession = cache(async (): Promise<CustomerSession | null> => {
  const auth = await createMenuServerClient()
  const { data: { user }, error: authError } = await auth.auth.getUser()
  if (authError || !user) return null

  const customer = await resolveCustomerIdentityForAuthUser(user.id)
  if (!customer) return null
  return {
    authUserId: user.id,
    ...customer,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    phone: user.phone ?? null,
    phoneVerified: Boolean(user.phone_confirmed_at),
  }
})
