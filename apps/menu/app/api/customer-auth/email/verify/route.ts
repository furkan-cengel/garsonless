import { z } from 'zod'
import { createMenuServerClient } from '../../../../../lib/supabase-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../../lib/customer-auth-request'
import {
  clearCustomerAuthIntentCookie,
  completeCustomerIdentity,
  consumeStoredCustomerAuthIntent,
  enforceCustomerAuthRateLimit,
  readCustomerAuthIntent,
  requestClientAddress,
} from '../../../../../lib/customer-auth-server'
import { publicRestaurantHasFeature } from '../../../../../lib/restaurant-feature-access'

const schema = z.object({
  intent: z.string().min(32).max(128),
  code: z.string().regex(/^\d{6}$/),
})

export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return customerAuthErrorResponse('OTP_INVALID')

  const intent = await readCustomerAuthIntent(parsed.data.intent)
  if (!intent || intent.flow !== 'email' || !intent.email) {
    return customerAuthErrorResponse('CONTEXT_EXPIRED')
  }
  if (!intent.restaurantId || !await publicRestaurantHasFeature(intent.restaurantId, 'customer_accounts')) {
    return customerAuthErrorResponse('PLAN_REQUIRED')
  }

  for (const limit of [
    { bucket: 'email-verify-ip', subject: requestClientAddress(request), limit: 20, windowSeconds: 600 },
    { bucket: 'email-verify-intent', subject: intent.nonce, limit: 10, windowSeconds: 600 },
  ]) {
    const result = await enforceCustomerAuthRateLimit({ request, ...limit })
    if (!result.ok) return customerAuthErrorResponse(result.error.code, result.error.retryAfterSeconds)
  }

  const supabase = await createMenuServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    email: intent.email,
    token: parsed.data.code,
    type: 'email',
  })
  if (error || !data.user || !data.session) {
    const expired = error?.message.toLowerCase().includes('expired') === true
    return customerAuthErrorResponse(expired ? 'OTP_EXPIRED' : 'OTP_INVALID')
  }

  const consumed = await consumeStoredCustomerAuthIntent(intent)
  if (!consumed) {
    await supabase.auth.signOut({ scope: 'local' })
    await clearCustomerAuthIntentCookie()
    return customerAuthErrorResponse('CONTEXT_EXPIRED')
  }

  const completed = await completeCustomerIdentity(data.user, intent)
  await clearCustomerAuthIntentCookie()
  if (!completed.ok) {
    await supabase.auth.signOut({ scope: 'local' })
    return customerAuthErrorResponse(completed.error.code)
  }
  return customerAuthSuccessResponse(completed.data)
}
