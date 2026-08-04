import { getCustomerSession } from '../../../../lib/customer-session'
import {
  addCustomerFavorites,
  readCustomerFavoritesView,
  removeCustomerFavorite,
} from '../../../../lib/customer-account-server'
import {
  parseCustomerFavoriteDelete,
  parseCustomerFavoritePut,
} from '../../../../lib/customer-account-contract'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../lib/customer-auth-request'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const restaurantId = new URL(request.url).searchParams.get('restaurantId')
  if (restaurantId && !UUID_PATTERN.test(restaurantId)) return customerAuthErrorResponse('CONFLICT')
  try {
    return customerAuthSuccessResponse(await readCustomerFavoritesView(session, restaurantId ?? undefined))
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
export async function PUT(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const parsed = parseCustomerFavoritePut(await request.json().catch(() => null))
  if (!parsed) return customerAuthErrorResponse('CONFLICT')
  try {
    return customerAuthSuccessResponse(await addCustomerFavorites(session, parsed.restaurantId, parsed.menuItemIds))
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}

export async function DELETE(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const parsed = parseCustomerFavoriteDelete(await request.json().catch(() => null))
  if (!parsed) return customerAuthErrorResponse('CONFLICT')
  try {
    return customerAuthSuccessResponse(await removeCustomerFavorite(session, parsed.restaurantId, parsed.menuItemId))
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
