import { createHash } from 'node:crypto'
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
import { sanitizeServerDiagnostic } from '../../../../../../lib/server-log-redaction'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CALLBACK_BYTES = 8 * 1024
function noStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store')
  return response
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
  const redirect = (path: string) => noStore(NextResponse.redirect(new URL(path, dashboardOrigin), 303))
  if (!isBillingCallbackMediaType(request.headers.get('content-type'))
    || declaredBillingBodyTooLarge(request.headers.get('content-length'), MAX_CALLBACK_BYTES)) {
    return redirect('/dashboard?billing=checkout_failed&code=MAS-VAL-001')
  }

  let token: string | null = null
  try {
    const body = new Uint8Array(await request.arrayBuffer())
    if (body.byteLength <= MAX_CALLBACK_BYTES) token = parseBillingCallbackToken(body)
  } catch {
    token = null
  }
  if (!token) {
    return redirect('/dashboard?billing=checkout_failed&code=MAS-VAL-001')
  }

  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const result = await completeSubscriptionCheckout(
      { providerCheckoutRef: token, idempotencyKey: callbackTokenKey(token) },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    if (!result.ok) {
      return redirect('/dashboard?billing=checkout_failed&code=MAS-PAY-409')
    }
    return redirect(
      `/dashboard/${result.value.restaurantId}/settings?section=billing&checkout=success`,
    )
  } catch (cause) {
    console.error(
      '[billing-checkout-callback]',
      { code: 'MAS-SVC-503' },
      sanitizeServerDiagnostic(cause),
    )
    return redirect('/dashboard?billing=checkout_failed&code=MAS-SVC-503')
  }
}
