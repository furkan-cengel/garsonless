import { canSadakatAuthenticate } from '@garsonless/db/server'
import { z } from 'zod'
import { createMenuServerClient } from '../../../../../lib/supabase-server'
import { verifyCustomerAuthCaptcha } from '../../../../../lib/customer-auth-captcha'
import { customerAuthContextSchema } from '../../../../../lib/customer-auth-route-schema'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../../lib/customer-auth-request'
import {
  beginCustomerAuthIntent,
  clearCustomerAuthIntentCookie,
  customerAuthAttemptSubject,
  enforceCustomerAuthRateLimit,
  recordCustomerAuthMetric,
  requestClientAddress,
} from '../../../../../lib/customer-auth-server'
import { availableCustomerAuthCapabilities } from '../../../../../lib/customer-auth-provider'
import { publicRestaurantHasFeature } from '../../../../../lib/restaurant-feature-access'

const schema = customerAuthContextSchema.extend({
  restaurantId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  captchaToken: z.string().min(1).max(4_096).optional(),
})

export async function POST(request: Request) {
  const startedAt = Date.now()
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return customerAuthErrorResponse('CONFLICT')
  if (!(parsed.data.surface === 'sadakat' ? await canSadakatAuthenticate(parsed.data.restaurantId, parsed.data.email.toLowerCase(), 'email') : await publicRestaurantHasFeature(parsed.data.restaurantId, 'customer_accounts'))) {
    return customerAuthErrorResponse('PLAN_REQUIRED')
  }
  if (!(await availableCustomerAuthCapabilities()).emailOtp) {
    return customerAuthErrorResponse('PROVIDER_DISABLED')
  }

  const email = parsed.data.email.toLowerCase()
  const address = requestClientAddress(request)
  const attemptSubject = await customerAuthAttemptSubject()
  if (!attemptSubject) return customerAuthErrorResponse('SERVICE_UNAVAILABLE')

  // Same escalation as SMS: the attempt cookie alone can be dropped, so the
  // address bucket also requires a CAPTCHA. Thresholds are looser than SMS
  // because email is cheaper and diners often share one restaurant network.
  const softLimits = await Promise.all([
    enforceCustomerAuthRateLimit({ request, bucket: 'email-start-challenge', subject: attemptSubject, limit: 3, windowSeconds: 900 }),
    enforceCustomerAuthRateLimit({ request, bucket: 'email-start-challenge-ip', subject: address, limit: 5, windowSeconds: 900 }),
  ])
  if (softLimits.some((limit) => !limit.ok)) {
    const captchaValid = await verifyCustomerAuthCaptcha(parsed.data.captchaToken, address)
    if (!captchaValid) {
      recordCustomerAuthMetric({ method: 'email', stage: 'failed', result: 'error', startedAt, errorCode: 'CHALLENGE_REQUIRED' })
      return customerAuthErrorResponse('CHALLENGE_REQUIRED')
    }
  }

  for (const limit of [
    { bucket: 'email-start-ip', subject: address, limit: 20, windowSeconds: 900 },
    { bucket: 'email-start-address', subject: email, limit: 5, windowSeconds: 900 },
  ]) {
    const result = await enforceCustomerAuthRateLimit({ request, ...limit })
    if (!result.ok) {
      recordCustomerAuthMetric({ method: 'email', stage: 'failed', result: 'error', startedAt, errorCode: result.error.code })
      return customerAuthErrorResponse(result.error.code, result.error.retryAfterSeconds)
    }
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
    const errorCode = error.status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE'
    recordCustomerAuthMetric({ method: 'email', stage: 'failed', result: 'error', startedAt, errorCode })
    return customerAuthErrorResponse(errorCode)
  }
  recordCustomerAuthMetric({ method: 'email', stage: 'sent', result: 'success', startedAt })
  return customerAuthSuccessResponse({ intent: intent.data.intent, resendAfterSeconds: 60 })
}
