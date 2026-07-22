import { createHash } from 'node:crypto'
import { completeSubscriptionCheckout } from '@garsonless/application/billing'
import { createSubscriptionBillingOperationsPort } from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../../../../../../lib/billing/iyzico-subscription-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CALLBACK_BYTES = 8 * 1024
const MAX_TOKEN_LENGTH = 200

function dashboardUrl(path: string): URL {
  return new URL(path, process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000')
}

function callbackTokenKey(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex')
  return `billing:checkout-callback:${digest}`
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CALLBACK_BYTES) {
    return NextResponse.redirect(dashboardUrl('/dashboard?billing=checkout_failed&code=MAS-VAL-001'), 303)
  }

  let token: string | null
  try {
    const body = await request.arrayBuffer()
    if (body.byteLength > MAX_CALLBACK_BYTES) throw new Error('callback too large')
    const form = new URLSearchParams(new TextDecoder().decode(body))
    token = form.get('token')?.trim() ?? null
  } catch {
    token = null
  }
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return NextResponse.redirect(dashboardUrl('/dashboard?billing=checkout_failed&code=MAS-VAL-001'), 303)
  }

  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const result = await completeSubscriptionCheckout(
      { providerCheckoutRef: token, idempotencyKey: callbackTokenKey(token) },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    if (!result.ok) {
      return NextResponse.redirect(dashboardUrl('/dashboard?billing=checkout_failed&code=MAS-PAY-409'), 303)
    }
    return NextResponse.redirect(
      dashboardUrl(`/dashboard/${result.value.restaurantId}/settings?section=billing&checkout=success`),
      303,
    )
  } catch (cause) {
    console.error('[billing-checkout-callback]', { code: 'MAS-SVC-503' }, cause)
    return NextResponse.redirect(dashboardUrl('/dashboard?billing=checkout_failed&code=MAS-SVC-503'), 303)
  }
}
