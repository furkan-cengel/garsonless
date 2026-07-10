import { cache } from 'react'
import { createServiceClient } from '@garsonless/db'
import { createMenuServerClient } from './supabase-server'

export interface CustomerSession {
  customerId: string
  name: string | null
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

  const service = createServiceClient()
  const { data, error } = await service
    .from('customers')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return { customerId: data.id, name: data.name }
})
