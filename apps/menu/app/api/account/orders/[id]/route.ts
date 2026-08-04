import { readCustomerOrderDetailView } from '../../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../../lib/customer-auth-http'
import { getCustomerSession } from '../../../../../lib/customer-session'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const { id } = await context.params
  if (!UUID_PATTERN.test(id)) return customerAuthErrorResponse('CONFLICT')
  try {
    const order = await readCustomerOrderDetailView(session, id)
    return order
      ? customerAuthSuccessResponse(order)
      : customerAuthErrorResponse('CONFLICT')
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
