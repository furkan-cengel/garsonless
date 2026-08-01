import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prepareOrderCheckout, releaseOrderCheckout } from '@garsonless/application/payments'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import { createOrderCheckoutPort, createPublicTableQueryPort } from '@garsonless/db/server'
import { createIyzicoClient, initializeCheckout } from '../../../lib/iyzico'
import { resolveIyzicoCredentials, attachPaymentTokenToOrder } from '../../../lib/payment-credentials'
import { buildCheckoutAddresses } from '../../../lib/checkout-address'

const paymentSchema = z.object({
  orderId: z.string().uuid(),
  // total is IGNORED for the charge — the İyzico amount is read from the DB
  // order (server-authoritative). Kept for back-compat / display only.
  total: z.number().positive().optional(),
  restaurantId: z.string().uuid(),
  tableToken: z.string().uuid(),
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
    tableToken,
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

  const tableResult = await resolvePublicTableContext(tableToken, createPublicTableQueryPort())
  if (!tableResult.ok) {
    return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: 503 })
  }
  const table = tableResult.value
  if (!table || table.restaurantId !== restaurantId) {
    return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  }
  const prepared = await prepareOrderCheckout(
    { actor: 'table-guest', restaurantId, tableId: table.tableId, tableToken },
    { restaurantId, orderId },
    createOrderCheckoutPort(),
  )
  if (!prepared.ok) {
    const status = prepared.error.includes('bulunamadı') ? 404 : 400
    return NextResponse.json({ success: false, error: prepared.error }, { status })
  }
  const checkoutContext = { actor: 'table-guest' as const, restaurantId, tableId: table.tableId, tableToken }
  const checkoutPort = createOrderCheckoutPort()
  const releaseReservation = async () => {
    const released = await releaseOrderCheckout(
      checkoutContext,
      { restaurantId, orderId, reservationId: prepared.value.reservationId },
      checkoutPort,
    )
    if (!released.ok) console.warn(JSON.stringify({ event: 'payment.checkout.release_failed' }))
  }
  const checkoutAddress = buildCheckoutAddresses(
    prepared.value.restaurantSettings,
    `${buyerName} ${buyerSurname}`,
  )
  const amount = prepared.value.amount
  const priceStr = amount.toFixed(2)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  const credentials = await resolveIyzicoCredentials(restaurantId)
  if (!credentials) {
    await releaseReservation()
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

    const mappingError = await attachPaymentTokenToOrder(
      orderId,
      restaurantId,
      prepared.value.reservationId,
      result.token,
    )
    if (mappingError) {
      await releaseReservation()
      return NextResponse.json(
        { success: false, error: 'Ödeme oturumu güvenli biçimde başlatılamadı. Lütfen tekrar deneyin.' },
        { status: 503 },
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch {
    await releaseReservation()
    return NextResponse.json(
      { success: false, error: 'Ödeme sağlayıcısına güvenli biçimde ulaşılamadı. Lütfen tekrar deneyin.' },
      { status: 503 },
    )
  }
}
