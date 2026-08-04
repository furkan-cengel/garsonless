import { z } from 'zod'
import { createMenuServerClient } from '../../../../lib/supabase-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../lib/customer-auth-request'
import { anonymousCustomerSessionView, clearCustomerAuthIntentCookie } from '../../../../lib/customer-auth-server'

const schema = z.object({ scope: z.enum(['device', 'all']) })

export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return customerAuthErrorResponse('CONFLICT')

  const supabase = await createMenuServerClient()
  const { error } = await supabase.auth.signOut({ scope: parsed.data.scope === 'all' ? 'global' : 'local' })
  if (error) return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  await clearCustomerAuthIntentCookie()
  return customerAuthSuccessResponse(anonymousCustomerSessionView())
}
