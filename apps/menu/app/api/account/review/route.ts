import { CUSTOMER_FEEDBACK_COMMENT_MAX_LENGTH } from '@garsonless/domain/customers'
import { readCustomerReviewPromptView, saveCustomerFeedback } from '../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../lib/customer-auth-request'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** The visit to ask about after payment, or null. */
export async function GET(request: Request) {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const restaurantId = new URL(request.url).searchParams.get('restaurantId')
  if (!restaurantId || !UUID_PATTERN.test(restaurantId)) return customerAuthErrorResponse('CONFLICT')
  if (!await publicRestaurantHasFeature(restaurantId, 'customer_accounts')) return customerAuthErrorResponse('PLAN_REQUIRED')
  try {
    return customerAuthSuccessResponse({ prompt: await readCustomerReviewPromptView(session, restaurantId) })
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}

function parseFeedback(value: unknown): { restaurantId: string; visitKey: string; rating: number | null; comment: string | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => !['restaurantId', 'visitKey', 'rating', 'comment'].includes(key))) return null
  const rating = row['rating'] === null ? null : Number.isInteger(row['rating']) && (row['rating'] as number) >= 1 && (row['rating'] as number) <= 5 ? row['rating'] as number : undefined
  const comment = row['comment'] === null || row['comment'] === undefined ? null
    : typeof row['comment'] === 'string' && row['comment'].length <= CUSTOMER_FEEDBACK_COMMENT_MAX_LENGTH ? row['comment'] : undefined
  return typeof row['restaurantId'] === 'string' && UUID_PATTERN.test(row['restaurantId'])
    && typeof row['visitKey'] === 'string' && UUID_PATTERN.test(row['visitKey'])
    && rating !== undefined && comment !== undefined
    ? { restaurantId: row['restaurantId'], visitKey: row['visitKey'], rating, comment }
    : null
}

export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const input = parseFeedback(await request.json().catch(() => null))
  if (!input) return customerAuthErrorResponse('CONFLICT')
  if (!await publicRestaurantHasFeature(input.restaurantId, 'customer_accounts')) return customerAuthErrorResponse('PLAN_REQUIRED')
  try {
    return await saveCustomerFeedback(session, input) === 'saved'
      ? customerAuthSuccessResponse({ saved: true })
      : customerAuthErrorResponse('CONFLICT')
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
