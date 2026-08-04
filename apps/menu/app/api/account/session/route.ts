import { resolveCustomerIdentityForAuthUser } from '@garsonless/db/server'
import { createMenuServerClient } from '../../../../lib/supabase-server'
import { customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { anonymousCustomerSessionView, customerSessionView } from '../../../../lib/customer-auth-server'

export async function GET() {
  const supabase = await createMenuServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return customerAuthSuccessResponse(anonymousCustomerSessionView())

  const identity = await resolveCustomerIdentityForAuthUser(user.id)
  if (!identity) return customerAuthSuccessResponse(anonymousCustomerSessionView())
  return customerAuthSuccessResponse(customerSessionView(user, identity.name))
}
