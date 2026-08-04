import { parseCustomerDeleteRequest } from '../../../../../lib/customer-account-contract'
import { requestCustomerAccountDeletion } from '../../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../../lib/customer-auth-request'
import { getCustomerSession } from '../../../../../lib/customer-session'

export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const input = parseCustomerDeleteRequest(await request.json().catch(() => null))
  if (!input) return customerAuthErrorResponse('CONFLICT')
  try {
    return customerAuthSuccessResponse(await requestCustomerAccountDeletion(
      session,
      input.requestId,
      input.confirmation,
    ))
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
