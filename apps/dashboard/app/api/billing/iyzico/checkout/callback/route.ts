import { createHash, randomBytes } from 'node:crypto'
import { completeSubscriptionCheckout } from '@garsonless/application/billing'
import { createSubscriptionBillingOperationsPort } from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../../../../../../lib/billing/iyzico-subscription-provider'
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
  const returnUrl = new URL(input.returnPath, input.dashboardOrigin)
  const response = new NextResponse(createBillingCheckoutResultDocument({
    dashboardOrigin: input.dashboardOrigin,
    returnUrl,
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
  })
  return noStore(response)
}

function callbackTokenKey(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex')
  return `billing:checkout-callback:${digest}`
}

export async function POST(request: Request) {
  let dashboardOrigin: URL
  try {
    dashboardOrigin = billingDashboardUrl('/', process.env['NEXT_PUBLIC_APP_URL'])
  } catch {
    return noStore(NextResponse.json(
      { ok: false, code: 'BILLING_CHECKOUT_CALLBACK_NOT_CONFIGURED' },
      { status: 503 },
    ))
  }
  if (!isBillingCallbackMediaType(request.headers.get('content-type'))
    || declaredBillingBodyTooLarge(request.headers.get('content-length'), MAX_CALLBACK_BYTES)) {
    return callbackResult({
      dashboardOrigin,
      returnPath: '/dashboard?billing=checkout_failed&code=MAS-VAL-001',
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
      returnPath: '/dashboard?billing=checkout_failed&code=MAS-VAL-001',
      outcome: 'failed',
      code: 'MAS-VAL-001',
    })
  }

  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const result = await completeSubscriptionCheckout(
      { providerCheckoutRef: token, idempotencyKey: callbackTokenKey(token) },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    if (!result.ok) {
      return callbackResult({
        dashboardOrigin,
        returnPath: '/dashboard?billing=checkout_pending&code=MAS-PAY-409',
        outcome: 'pending',
        code: 'MAS-PAY-409',
      })
    }
    if (result.value.outcome === 'incomplete') {
      return callbackResult({
        dashboardOrigin,
        returnPath: '/dashboard?billing=checkout_incomplete&code=MAS-PAY-409',
        outcome: 'incomplete',
        code: 'MAS-PAY-409',
      })
    }
    if (result.value.outcome === 'expired') {
      return callbackResult({
        dashboardOrigin,
        returnPath: '/dashboard?billing=checkout_expired&code=MAS-PAY-409',
        outcome: 'expired',
        code: 'MAS-PAY-409',
      })
    }
    if (result.value.outcome === 'ambiguous') {
      return callbackResult({
        dashboardOrigin,
        returnPath: '/dashboard?billing=checkout_pending&code=MAS-PAY-409',
        outcome: 'pending',
        code: 'MAS-PAY-409',
      })
    }
    return callbackResult({
      dashboardOrigin,
      returnPath: `/dashboard/${result.value.restaurantId}/settings?section=billing&checkout=success`,
      outcome: 'succeeded',
    })
  } catch (cause) {
    console.error(
      '[billing-checkout-callback]',
      { code: 'MAS-SVC-503' },
      sanitizeServerDiagnostic(cause),
    )
    return callbackResult({
      dashboardOrigin,
      returnPath: '/dashboard?billing=checkout_pending&code=MAS-SVC-503',
      outcome: 'pending',
      code: 'MAS-SVC-503',
    })
  }
}
