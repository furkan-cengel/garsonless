import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../lib/customer-auth-http'
import { parseCustomerAccountPatch } from '../../../lib/customer-account-contract'
import { readCustomerAccountView, saveCustomerAccountName } from '../../../lib/customer-account-server'
import { validateCustomerAuthMutation } from '../../../lib/customer-auth-request'
import { getCustomerSession } from '../../../lib/customer-session'

export async function GET() {
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  try {
    const account = await readCustomerAccountView(session)
    return account
      ? customerAuthSuccessResponse(account)
      : customerAuthErrorResponse('AUTH_REQUIRED')
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}

export async function PATCH(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const input = parseCustomerAccountPatch(await request.json().catch(() => null))
  if (!input) return customerAuthErrorResponse('CONFLICT')
  try {
    const account = await saveCustomerAccountName(session, input.name)
    return account
      ? customerAuthSuccessResponse(account)
      : customerAuthErrorResponse('CONFLICT')
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
