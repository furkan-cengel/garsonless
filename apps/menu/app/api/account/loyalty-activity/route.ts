import { decodeCustomerLoyaltyCursor } from '../../../../lib/customer-account-contract'
import { readCustomerLoyaltyActivityView } from '../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { getCustomerSession } from '../../../../lib/customer-session'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const url = new URL(request.url)
  const restaurantId = url.searchParams.get('restaurantId')
  if (!restaurantId || !UUID_PATTERN.test(restaurantId)) return customerAuthErrorResponse('CONFLICT')
  const rawCursor = url.searchParams.get('cursor')
  const cursor = decodeCustomerLoyaltyCursor(rawCursor)
  if (rawCursor && !cursor) return customerAuthErrorResponse('CONFLICT')
  try {
    return customerAuthSuccessResponse(await readCustomerLoyaltyActivityView({
      session,
      restaurantId,
      limit: 8,
      cursor,
    }))
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
