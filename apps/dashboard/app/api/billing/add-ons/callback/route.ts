import { readBoundedRequestBody } from '@garsonless/application/request-body'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAddOnPurchasePort } from '@garsonless/db/server'
import { reconcileAddOnPurchase } from '@garsonless/application/add-on-purchases'
import { createIyzicoAddOnProvider } from '../../../../../lib/billing/iyzico-add-on-provider'
import {
  parseBillingCallbackToken,
  declaredBillingBodyTooLarge,
  isBillingCallbackMediaType,
} from '../../../../../lib/billing/subscription-billing-http-boundary'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  if (
    declaredBillingBodyTooLarge(request.headers.get('content-length'), 8192) ||
    !isBillingCallbackMediaType(request.headers.get('content-type'))
  )
    return new NextResponse('Invalid callback', { status: 400 })
  const body = await readBoundedRequestBody(request, 8192)
  if (!body.ok)
    return new NextResponse('Invalid callback', { status: body.status })
  const token = parseBillingCallbackToken(body.bytes)
  if (!token) return new NextResponse('Invalid callback', { status: 400 })
  const port = createAddOnPurchasePort()
  const purchase = await port.readByToken(token)
  if (!purchase) return new NextResponse('Unknown checkout', { status: 404 })
  try {
    await reconcileAddOnPurchase(purchase, port, createIyzicoAddOnProvider())
    revalidatePath(`/dashboard/${purchase.restaurantId}`, 'layout')
  } catch {
    /* Return to an authenticated status check; never grant on callback parameters. */
  }
  const origin = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ).origin
  return NextResponse.redirect(
    new URL(
      `/dashboard/${purchase.restaurantId}/settings?section=billing&purchase=${purchase.id}`,
      origin,
    ),
    303,
  )
}
