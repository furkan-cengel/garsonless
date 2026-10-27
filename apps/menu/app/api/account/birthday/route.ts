import { readCustomerBirthdayView, saveCustomerBirthday } from '../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../lib/customer-auth-request'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const restaurantId = new URL(request.url).searchParams.get('restaurantId')
  if (!restaurantId || !UUID_PATTERN.test(restaurantId)) return customerAuthErrorResponse('CONFLICT')
  if (!await publicRestaurantHasFeature(restaurantId, 'customer_accounts')) return customerAuthErrorResponse('PLAN_REQUIRED')
  try {
    const birthday = await readCustomerBirthdayView(session, restaurantId)
    return customerAuthSuccessResponse(birthday === 'unlinked' ? { linked: false, birthday: null } : { linked: true, birthday })
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}

function parseBirthdayUpdate(value: unknown): { restaurantId: string; month: number | null; day: number | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => !['restaurantId', 'month', 'day'].includes(key))) return null
  const part = (input: unknown) => (input === null ? null : Number.isInteger(input) ? input as number : undefined)
  const month = part(row['month'])
  const day = part(row['day'])
  return typeof row['restaurantId'] === 'string' && UUID_PATTERN.test(row['restaurantId']) && month !== undefined && day !== undefined
    ? { restaurantId: row['restaurantId'], month, day }
    : null
}

export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const input = parseBirthdayUpdate(await request.json().catch(() => null))
  if (!input) return customerAuthErrorResponse('CONFLICT')
  if (!await publicRestaurantHasFeature(input.restaurantId, 'customer_accounts')) return customerAuthErrorResponse('PLAN_REQUIRED')
  try {
    return await saveCustomerBirthday(session, input)
      ? customerAuthSuccessResponse({ birthday: input.month === null ? null : { month: input.month, day: input.day } })
      : customerAuthErrorResponse('CONFLICT')
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
