import { z } from 'zod'
import { createMenuServerClient } from '../../../../../lib/supabase-server'
import { customerAuthContextSchema } from '../../../../../lib/customer-auth-route-schema'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../../lib/customer-auth-http'
import { customerAuthCallbackUrl, validateCustomerAuthMutation } from '../../../../../lib/customer-auth-request'
import {
  beginCustomerAuthIntent,
  clearCustomerAuthIntentCookie,
  enforceCustomerAuthRateLimit,
  recordCustomerAuthMetric,
  requestClientAddress,
} from '../../../../../lib/customer-auth-server'
import { availableCustomerAuthProviders } from '../../../../../lib/customer-auth-provider'
import { publicRestaurantHasFeature } from '../../../../../lib/restaurant-feature-access'

const schema = customerAuthContextSchema.extend({
  restaurantId: z.string().uuid(),
  provider: z.enum(['google', 'apple', 'facebook']),
})

export async function POST(request: Request) {
  const startedAt = Date.now()
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return customerAuthErrorResponse('CONFLICT')
  if (!await publicRestaurantHasFeature(parsed.data.restaurantId, 'customer_accounts')) {
    return customerAuthErrorResponse('PLAN_REQUIRED')
  }
  const availableProviders = await availableCustomerAuthProviders()
  if (!availableProviders.includes(parsed.data.provider)) {
    return customerAuthErrorResponse('PROVIDER_DISABLED')
  }

  const rateLimit = await enforceCustomerAuthRateLimit({
    request,
    bucket: `oauth-start-${parsed.data.provider}`,
    subject: requestClientAddress(request),
    limit: 20,
    windowSeconds: 900,
  })
  if (!rateLimit.ok) {
    recordCustomerAuthMetric({ method: parsed.data.provider, stage: 'failed', result: 'error', startedAt, errorCode: rateLimit.error.code })
    return customerAuthErrorResponse(rateLimit.error.code, rateLimit.error.retryAfterSeconds)
  }

  const intent = await beginCustomerAuthIntent({ ...parsed.data, flow: 'oauth' })
  if (!intent.ok) return customerAuthErrorResponse(intent.error.code)
  const callback = customerAuthCallbackUrl(intent.data.intent)
  if (!callback) {
    await clearCustomerAuthIntentCookie()
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }

  const supabase = await createMenuServerClient()
  const queryParams = parsed.data.provider === 'google'
    ? { prompt: 'select_account' }
    : undefined
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: {
      redirectTo: callback.toString(),
      skipBrowserRedirect: true,
      ...(queryParams ? { queryParams } : {}),
    },
  })
  if (error || !data.url) {
    await clearCustomerAuthIntentCookie()
    recordCustomerAuthMetric({ method: parsed.data.provider, stage: 'failed', result: 'error', startedAt, errorCode: 'SERVICE_UNAVAILABLE' })
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
  recordCustomerAuthMetric({ method: parsed.data.provider, stage: 'start', result: 'success', startedAt })
  return customerAuthSuccessResponse({ redirectUrl: data.url })
}
