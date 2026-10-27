import { readCustomerRewardNoticeView } from '../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../lib/customer-auth-request'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function respond(restaurantId: unknown, markSeen: boolean) {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  if (typeof restaurantId !== 'string' || !UUID_PATTERN.test(restaurantId)) return customerAuthErrorResponse('CONFLICT')
  if (!await publicRestaurantHasFeature(restaurantId, 'loyalty')) return customerAuthErrorResponse('PLAN_REQUIRED')
  try {
    return customerAuthSuccessResponse({ notices: await readCustomerRewardNoticeView(session, restaurantId, markSeen) })
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}

export async function GET(request: Request) {
  return respond(new URL(request.url).searchParams.get('restaurantId'), false)
}

/** Marks every shown notice as seen. */
export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const body = await request.json().catch(() => null) as { restaurantId?: unknown } | null
  return respond(body?.restaurantId, true)
}
