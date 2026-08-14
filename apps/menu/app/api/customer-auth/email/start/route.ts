import { z } from 'zod'
import { createMenuServerClient } from '../../../../../lib/supabase-server'
import { customerAuthContextSchema } from '../../../../../lib/customer-auth-route-schema'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../../lib/customer-auth-request'
import {
  beginCustomerAuthIntent,
  clearCustomerAuthIntentCookie,
  enforceCustomerAuthRateLimit,
  requestClientAddress,
} from '../../../../../lib/customer-auth-server'
import { publicRestaurantHasFeature } from '../../../../../lib/restaurant-feature-access'

const schema = customerAuthContextSchema.extend({
  restaurantId: z.string().uuid(),
  email: z.string().trim().email().max(254),
})

export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return customerAuthErrorResponse('CONFLICT')
  if (!await publicRestaurantHasFeature(parsed.data.restaurantId, 'customer_accounts')) {
    return customerAuthErrorResponse('PLAN_REQUIRED')
  }

  const email = parsed.data.email.toLowerCase()
  for (const limit of [
    { bucket: 'email-start-ip', subject: requestClientAddress(request), limit: 20, windowSeconds: 900 },
    { bucket: 'email-start-address', subject: email, limit: 5, windowSeconds: 900 },
  ]) {
    const result = await enforceCustomerAuthRateLimit({ request, ...limit })
    if (!result.ok) return customerAuthErrorResponse(result.error.code, result.error.retryAfterSeconds)
  }

  const intent = await beginCustomerAuthIntent({ ...parsed.data, email, flow: 'email' })
  if (!intent.ok) return customerAuthErrorResponse(intent.error.code)

  const supabase = await createMenuServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: parsed.data.name ? { full_name: parsed.data.name } : {},
    },
  })
  if (error) {
    await clearCustomerAuthIntentCookie()
    return customerAuthErrorResponse(error.status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE')
  }
  return customerAuthSuccessResponse({ intent: intent.data.intent, resendAfterSeconds: 60 })
}
