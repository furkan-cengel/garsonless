import { decodeCustomerOrderCursor, type CustomerOrderFilter } from '../../../../lib/customer-account-contract'
import { readCustomerOrdersView } from '../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { getCustomerSession } from '../../../../lib/customer-session'

const FILTERS = new Set<CustomerOrderFilter>(['active', 'past'])

export async function GET(request: Request) {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')

  const url = new URL(request.url)
  const rawFilter = url.searchParams.get('status') ?? 'active'
  if (!FILTERS.has(rawFilter as CustomerOrderFilter)) return customerAuthErrorResponse('CONFLICT')
  const rawLimit = url.searchParams.get('limit')
  const parsedLimit = rawLimit === null ? 10 : Number(rawLimit)
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) return customerAuthErrorResponse('CONFLICT')
  const rawCursor = url.searchParams.get('cursor')
  const cursor = decodeCustomerOrderCursor(rawCursor)
  if (rawCursor && !cursor) return customerAuthErrorResponse('CONFLICT')

  try {
    return customerAuthSuccessResponse(await readCustomerOrdersView({
      session,
      filter: rawFilter as CustomerOrderFilter,
      limit: parsedLimit,
      cursor,
    }))
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
