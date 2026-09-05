import { randomBytes } from 'node:crypto'
import { completeSubscriptionCardUpdate } from '@garsonless/application/billing'
import { createSubscriptionBillingOperationsPort } from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import {
  declaredBillingBodyTooLarge,
  isBillingCallbackMediaType,
  parseBillingCallbackToken,
} from '../../../../../../lib/billing/subscription-billing-http-boundary'
import { billingDashboardUrl } from '../../../../../../lib/billing/subscription-billing-request'
import {
  billingCheckoutResultCsp,
  createBillingCheckoutResultDocument,
  type BillingCheckoutPublicCode,
  type BillingCheckoutResultOutcome,
} from '../../../../../../lib/billing/subscription-billing-checkout-result'
import { sanitizeServerDiagnostic } from '../../../../../../lib/server-log-redaction'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CALLBACK_BYTES = 8 * 1024

function noStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store')
  return response
}

function callbackResult(input: {
  dashboardOrigin: URL
  returnPath: string
  outcome: BillingCheckoutResultOutcome
  code?: BillingCheckoutPublicCode
}): NextResponse {
  const nonce = randomBytes(18).toString('base64url')
  return noStore(new NextResponse(createBillingCheckoutResultDocument({
    dashboardOrigin: input.dashboardOrigin,
    returnUrl: new URL(input.returnPath, input.dashboardOrigin),
    nonce,
    outcome: input.outcome,
    code: input.code,
  }), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': billingCheckoutResultCsp(nonce),
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  }))
}

export async function POST(request: Request) {
  let dashboardOrigin: URL
  try {
    dashboardOrigin = billingDashboardUrl('/', process.env['NEXT_PUBLIC_APP_URL'])
  } catch {
    return noStore(NextResponse.json(
      { ok: false, code: 'BILLING_CARD_UPDATE_CALLBACK_NOT_CONFIGURED' },
      { status: 503 },
    ))
  }
  const callbackState = new URL(request.url).searchParams.get('state')
  if (!callbackState
    || !/^[A-Za-z0-9_-]{32,200}$/.test(callbackState)
    || !isBillingCallbackMediaType(request.headers.get('content-type'))
    || declaredBillingBodyTooLarge(request.headers.get('content-length'), MAX_CALLBACK_BYTES)) {
    return callbackResult({
      dashboardOrigin,
      returnPath: '/dashboard?billing=card_update_failed&code=MAS-VAL-001',
      outcome: 'failed',
      code: 'MAS-VAL-001',
    })
  }

  let token: string | null = null
  try {
    const body = new Uint8Array(await request.arrayBuffer())
    if (body.byteLength <= MAX_CALLBACK_BYTES) token = parseBillingCallbackToken(body)
  } catch {
    token = null
  }
  if (!token) {
    return callbackResult({
      dashboardOrigin,
      returnPath: '/dashboard?billing=card_update_failed&code=MAS-VAL-001',
      outcome: 'failed',
      code: 'MAS-VAL-001',
    })
  }

  try {
    const result = await completeSubscriptionCardUpdate({
      providerCheckoutRef: token,
      callbackState,
    }, createSubscriptionBillingOperationsPort())
    if (!result.ok || result.value.outcome === 'ambiguous') {
      return callbackResult({
        dashboardOrigin,
        returnPath: '/dashboard?billing=card_update_pending&code=MAS-PAY-409',
        outcome: 'pending',
        code: 'MAS-PAY-409',
      })
    }
    return callbackResult({
      dashboardOrigin,
      returnPath: `/dashboard/${result.value.restaurantId}/settings?section=billing&card_update=success`,
      outcome: 'succeeded',
    })
  } catch (cause) {
    console.error(
      '[billing-card-update-callback]',
      { code: 'MAS-SVC-503' },
      sanitizeServerDiagnostic(cause),
    )
    return callbackResult({
      dashboardOrigin,
      returnPath: '/dashboard?billing=card_update_pending&code=MAS-SVC-503',
      outcome: 'pending',
      code: 'MAS-SVC-503',
    })
  }
}
