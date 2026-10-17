import { canSadakatAuthenticate } from '@garsonless/db/server'
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
  recordCustomerAuthMetric,
  recordCustomerAuthLegalEvidence,
  requestClientAddress,
} from '../../../../../lib/customer-auth-server'
import { publicRestaurantHasFeature } from '../../../../../lib/restaurant-feature-access'

const schema = z.object({
  intent: z.string().min(32).max(128),
  code: z.string().regex(/^\d{6}$/),
})

export async function POST(request: Request) {
  const startedAt = Date.now()
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return customerAuthErrorResponse('OTP_INVALID')

  const intent = await readCustomerAuthIntent(parsed.data.intent)
  if (!intent || intent.version !== 2 || intent.flow !== 'phone' || !intent.phone) {
    return customerAuthErrorResponse('CONTEXT_EXPIRED')
  }
  if (!intent.restaurantId || !(intent.surface === 'sadakat' ? await canSadakatAuthenticate(intent.restaurantId, intent.phone) : await publicRestaurantHasFeature(intent.restaurantId, 'customer_accounts'))) {
    return customerAuthErrorResponse('PLAN_REQUIRED')
  }

  for (const limit of [
    { bucket: 'phone-verify-ip', subject: requestClientAddress(request), limit: 20, windowSeconds: 600 },
    { bucket: 'phone-verify-intent', subject: intent.nonce, limit: 5, windowSeconds: 600 },
  ]) {
    const result = await enforceCustomerAuthRateLimit({ request, ...limit })
    if (!result.ok) {
      recordCustomerAuthMetric({ method: 'phone', stage: 'failed', result: 'error', startedAt, errorCode: result.error.code })
      return customerAuthErrorResponse(result.error.code, result.error.retryAfterSeconds)
    }
  }

  const supabase = await createMenuServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    phone: intent.phone,
    token: parsed.data.code,
    type: 'sms',
  })
  if (error || !data.user || !data.session) {
    const expired = error?.message.toLowerCase().includes('expired') === true
    const errorCode = expired ? 'OTP_EXPIRED' : 'OTP_INVALID'
    recordCustomerAuthMetric({ method: 'phone', stage: 'failed', result: 'error', startedAt, errorCode })
    return customerAuthErrorResponse(errorCode)
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
    recordCustomerAuthMetric({ method: 'phone', stage: 'failed', result: 'error', startedAt, errorCode: completed.error.code })
    return customerAuthErrorResponse(completed.error.code)
  }
  await recordCustomerAuthLegalEvidence(request, data.user.id, intent)
  recordCustomerAuthMetric({ method: 'phone', stage: 'verified', result: 'success', startedAt })
  return customerAuthSuccessResponse({
    ...completed.data,
    profileCompletionRequired: !completed.data.profile?.name,
  })
}
