import { getCustomerSession } from '../../../../../../lib/customer-session'
import { readCustomerReorderPreviewView } from '../../../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../../../lib/customer-auth-request'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const { id } = await context.params
  if (!UUID_PATTERN.test(id)) return customerAuthErrorResponse('CONFLICT')
  try {
    const preview = await readCustomerReorderPreviewView(session, id)
    return preview
      ? customerAuthSuccessResponse(preview)
      : customerAuthErrorResponse('CONFLICT')
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
