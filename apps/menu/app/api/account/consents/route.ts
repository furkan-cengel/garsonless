import { getCustomerSession } from '../../../../lib/customer-session'
import { parseCustomerConsentUpdate } from '../../../../lib/customer-account-contract'
import { saveCustomerAccountConsent } from '../../../../lib/customer-account-server'
import { customerAuthErrorResponse, customerAuthSuccessResponse } from '../../../../lib/customer-auth-http'
import { validateCustomerAuthMutation } from '../../../../lib/customer-auth-request'

export async function POST(request: Request) {
  const requestCheck = validateCustomerAuthMutation(request)
  if (!requestCheck.ok) return customerAuthErrorResponse(requestCheck.error.code)
  const session = await getCustomerSession()
  if (!session) return customerAuthErrorResponse('AUTH_REQUIRED')
  const input = parseCustomerConsentUpdate(await request.json().catch(() => null))
  if (!input) return customerAuthErrorResponse('CONFLICT')
  try {
    const account = await saveCustomerAccountConsent({ session, ...input })
    return account
      ? customerAuthSuccessResponse(account)
      : customerAuthErrorResponse('CONFLICT')
  } catch {
    return customerAuthErrorResponse('SERVICE_UNAVAILABLE')
  }
}
