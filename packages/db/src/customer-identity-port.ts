import { createServiceClient } from './service-client'

export async function resolveCustomerIdentityForAuthUser(authUserId: string): Promise<{
  customerId: string
  name: string | null
} | null> {
  const { data, error } = await createServiceClient()
    .from('customers')
    .select('id, name')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  return error || !data ? null : { customerId: data.id, name: data.name }
}
