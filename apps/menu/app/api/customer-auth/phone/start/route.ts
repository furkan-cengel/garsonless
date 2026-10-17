import { canSadakatAuthenticate } from '@garsonless/db/server'
import { z } from 'zod'
import { normalizeTurkishMobile } from '@garsonless/db/server'
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
  phone: z.string().trim().min(10).max(32),
  captchaToken: z.string().min(1).max(4_096).optional(),
})

export async function POST(request: Request) {
  const startedAt = Date.now()
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return customerAuthErrorResponse('PHONE_INVALID')
  const phone = normalizeTurkishMobile(parsed.data.phone)
  if (!phone) return customerAuthErrorResponse('PHONE_INVALID')
  if (!(parsed.data.surface === 'sadakat' ? await canSadakatAuthenticate(parsed.data.restaurantId, phone) : await publicRestaurantHasFeature(parsed.data.restaurantId, 'customer_accounts'))) {
    return customerAuthErrorResponse('PLAN_REQUIRED')
  }
  const capabilities = await availableCustomerAuthCapabilities()
  if (!capabilities.phoneOtp) return customerAuthErrorResponse('PROVIDER_DISABLED')

  const address = requestClientAddress(request)
  const attemptSubject = await customerAuthAttemptSubject()
  if (!attemptSubject) return customerAuthErrorResponse('SERVICE_UNAVAILABLE')

  // The attempt cookie alone is not enough: a client that drops cookies gets a
  // fresh subject each time, so the address bucket also escalates to CAPTCHA.
  const softLimits = await Promise.all([
    enforceCustomerAuthRateLimit({
      request,
      bucket: 'phone-start-challenge',
      subject: attemptSubject,
      limit: 2,
      windowSeconds: 900,
    }),
    enforceCustomerAuthRateLimit({
      request,
      bucket: 'phone-start-challenge-ip',
      subject: address,
      limit: 3,
      windowSeconds: 900,
    }),
  ])
  if (softLimits.some((limit) => !limit.ok)) {
    const captchaValid = await verifyCustomerAuthCaptcha(parsed.data.captchaToken, address)
    if (!captchaValid) {
      recordCustomerAuthMetric({ method: 'phone', stage: 'failed', result: 'error', startedAt, errorCode: 'CHALLENGE_REQUIRED' })
      return customerAuthErrorResponse('CHALLENGE_REQUIRED')
    }
  }

  for (const limit of [
    { bucket: 'phone-start-ip', subject: address, limit: 20, windowSeconds: 900 },
    { bucket: 'phone-start-number', subject: phone, limit: 5, windowSeconds: 900 },
    { bucket: 'phone-start-number-day', subject: phone, limit: 10, windowSeconds: 86_400 },
  ]) {
    const result = await enforceCustomerAuthRateLimit({ request, ...limit })
    if (!result.ok) {
      recordCustomerAuthMetric({ method: 'phone', stage: 'failed', result: 'error', startedAt, errorCode: result.error.code })
      return customerAuthErrorResponse(result.error.code, result.error.retryAfterSeconds)
    }
  }

  const intent = await beginCustomerAuthIntent({ ...parsed.data, phone, flow: 'phone' })
  if (!intent.ok) return customerAuthErrorResponse(intent.error.code)

  const supabase = await createMenuServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  })
  if (error) {
    await clearCustomerAuthIntentCookie()
    const errorCode = error.status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE'
    recordCustomerAuthMetric({ method: 'phone', stage: 'failed', result: 'error', startedAt, errorCode })
    return customerAuthErrorResponse(errorCode)
  }
  recordCustomerAuthMetric({ method: 'phone', stage: 'sent', result: 'success', startedAt })
  return customerAuthSuccessResponse({
    intent: intent.data.intent,
    resendAfterSeconds: 90,
    maskedDestination: `+90 5** *** ${phone.slice(-4)}`,
  })
}
