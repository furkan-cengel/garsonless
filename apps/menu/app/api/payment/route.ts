import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@garsonless/db'
import { createIyzicoClient, initializeCheckout } from '../../../lib/iyzico'
import { resolveIyzicoCredentials, attachPaymentTokenToOrder } from '../../../lib/payment-credentials'
import { buildCheckoutAddresses } from '../../../lib/checkout-address'

const paymentSchema = z.object({
  orderId: z.string().uuid(),
  // total is IGNORED for the charge — the İyzico amount is read from the DB
  // order (server-authoritative). Kept for back-compat / display only.
  total: z.number().positive().optional(),
  restaurantId: z.string().uuid(),
  buyerName: z.string().min(1).max(50),
  buyerSurname: z.string().min(1).max(50),
  buyerEmail: z.string().email(),
  buyerPhone: z.string().min(7).max(20),
  deviceId: z.string().min(1),
})

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export async function POST(
  req: Request,
): Promise<NextResponse<ApiResponse<{ paymentPageUrl: string; token: string }>>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const {
    orderId,
    restaurantId,
    buyerName,
    buyerSurname,
    buyerEmail,
    buyerPhone,
    deviceId,
  } = parsed.data

  const requestUrl = new URL(req.url)
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const forwardedProtocol = req.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
  const developmentOrigin = forwardedHost
    ? `${forwardedProtocol}://${forwardedHost}`
    : requestUrl.origin
  // Production uses the canonical configured host. Development follows the
  // incoming host so HTTPS quick tunnels receive a reachable callback URL.
  const appUrl = process.env['NODE_ENV'] === 'production'
    ? process.env['NEXT_PUBLIC_MENU_URL'] ?? requestUrl.origin
    : developmentOrigin
  const callbackUrl = `${appUrl}/api/payment/callback`

  // SERVER-AUTHORITATIVE amount: read the order's stored total (post-discount).
  // The client-supplied `total` is never used for the charge.
  const svc = createServiceClient()
  const { data: orderRow } = await svc
    .from('orders')
    .select('total, restaurant_id')
    .eq('id', orderId)
    .maybeSingle()
  const order = orderRow as { total: number; restaurant_id: string } | null
  if (!order || order.restaurant_id !== restaurantId) {
    return NextResponse.json({ success: false, error: 'Sipariş bulunamadı' }, { status: 404 })
  }
  const { data: restaurantRow } = await svc
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .maybeSingle()
  const checkoutAddress = buildCheckoutAddresses(
    (restaurantRow as { settings: unknown } | null)?.settings,
    `${buyerName} ${buyerSurname}`,
  )
  const amount = Number(order.total)
  if (!(amount > 0)) {
    return NextResponse.json({ success: false, error: 'Geçersiz tutar' }, { status: 400 })
  }
  const priceStr = amount.toFixed(2)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  const credentials = await resolveIyzicoCredentials(restaurantId)
  if (!credentials) {
    return NextResponse.json(
      { success: false, error: 'Bu restoran için ödeme yapılandırılmamış' },
      { status: 503 },
    )
  }

  try {
    const client = createIyzicoClient(credentials)
    const result = await initializeCheckout(client, {
      locale: 'tr',
      conversationId: orderId,
      price: priceStr,
      paidPrice: priceStr,
      currency: 'TRY',
      basketId: orderId,
      paymentGroup: 'PRODUCT',
      callbackUrl,
      buyer: {
        id: deviceId,
        name: buyerName,
        surname: buyerSurname,
        email: buyerEmail,
        gsmNumber: buyerPhone,
        identityNumber: '11111111111',
        registrationAddress: checkoutAddress.registrationAddress,
        city: checkoutAddress.city,
        country: 'Turkey',
        ip,
      },
      shippingAddress: checkoutAddress.shippingAddress,
      billingAddress: checkoutAddress.billingAddress,
      basketItems: [
        {
          id: orderId,
          name: 'Restaurant Order',
          category1: 'Food',
          itemType: 'VIRTUAL',
          price: priceStr,
        },
      ],
    })

    await attachPaymentTokenToOrder(orderId, result.token)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment initialization failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
