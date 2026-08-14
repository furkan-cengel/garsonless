import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prepareSplitCheckout, releaseSplitCheckout } from '@garsonless/application/splits'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import { createPublicTableQueryPort, createSplitPaymentPort } from '@garsonless/db/server'
import { createIyzicoClient, initializeCheckout } from '../../../../lib/iyzico'
import { resolveIyzicoCredentials, attachPaymentTokenToShare } from '../../../../lib/payment-credentials'
import { buildCheckoutAddresses } from '../../../../lib/checkout-address'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

// Start an İyzico checkout for ONE split share. The charge is SERVER-AUTHORITATIVE
// AND CLAMPED to the remaining uncovered total: charge = min(share.amount,
// session_total − Σ settled shares). A client can never be overcharged past what
// the table still owes; a fully-covered session rejects the checkout.

const schema = z.object({
  shareId: z.string().uuid(),
  tableToken: z.string().uuid(),
  buyerName: z.string().min(1).max(50),
  buyerSurname: z.string().min(1).max(50),
  buyerEmail: z.string().email(),
  buyerPhone: z.string().min(7).max(20),
  deviceId: z.string().min(1),
})

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ paymentPageUrl: string; token: string; amount: number }>>> {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { shareId, tableToken, buyerName, buyerSurname, buyerEmail, buyerPhone, deviceId } = parsed.data

  const tableResult = await resolvePublicTableContext(tableToken, createPublicTableQueryPort())
  if (!tableResult.ok) return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: 503 })
  const table = tableResult.value
  if (!table) return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  const restaurantId = table.restaurantId
  if (!await publicRestaurantHasFeature(restaurantId, 'split_payments')) {
    return NextResponse.json({ success: false, error: 'Bu özellik Pro paketi gerektirir.' }, { status: 403 })
  }
  const prepared = await prepareSplitCheckout(
    { actor: 'table-guest', restaurantId, tableId: table.tableId, tableToken },
    { restaurantId, shareId },
    createSplitPaymentPort(),
  )
  if (!prepared.ok) {
    const status = prepared.error.includes('bulunamadı') || prepared.error.includes('geçersiz') ? 404 : 409
    return NextResponse.json({ success: false, error: prepared.error }, { status })
  }
  const charge = prepared.value.amount
  const priceStr = charge.toFixed(2)
  const tableContext = { actor: 'table-guest' as const, restaurantId, tableId: table.tableId, tableToken }
  const releaseReservation = async () => {
    const released = await releaseSplitCheckout(
      tableContext,
      { restaurantId, shareId },
      createSplitPaymentPort(),
    )
    if (!released.ok) {
      console.warn(JSON.stringify({ event: 'payment.split_reservation.release_failed' }))
    }
  }

  const requestUrl = new URL(req.url)
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const forwardedProtocol = req.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
  const devOrigin = forwardedHost ? `${forwardedProtocol}://${forwardedHost}` : requestUrl.origin
  const appUrl = process.env['NODE_ENV'] === 'production' ? (process.env['NEXT_PUBLIC_MENU_URL'] ?? requestUrl.origin) : devOrigin
  const callbackUrl = `${appUrl}/api/payment/callback`
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  const credentials = await resolveIyzicoCredentials(restaurantId)
  if (!credentials) {
    await releaseReservation()
    return NextResponse.json({ success: false, error: 'Bu restoran için ödeme yapılandırılmamış' }, { status: 503 })
  }
  const checkoutAddress = buildCheckoutAddresses(
    prepared.value.restaurantSettings,
    `${buyerName} ${buyerSurname}`,
  )

  try {
    const client = createIyzicoClient(credentials)
    const result = await initializeCheckout(client, {
      locale: 'tr', conversationId: shareId, price: priceStr, paidPrice: priceStr, currency: 'TRY',
      basketId: shareId, paymentGroup: 'PRODUCT', callbackUrl,
      buyer: { id: deviceId, name: buyerName, surname: buyerSurname, email: buyerEmail, gsmNumber: buyerPhone, identityNumber: '11111111111', registrationAddress: checkoutAddress.registrationAddress, city: checkoutAddress.city, country: 'Turkey', ip },
      shippingAddress: checkoutAddress.shippingAddress,
      billingAddress: checkoutAddress.billingAddress,
      basketItems: [{ id: shareId, name: 'Hesap payı', category1: 'Food', itemType: 'VIRTUAL', price: priceStr }],
    })
    const mappingError = await attachPaymentTokenToShare(shareId, restaurantId, result.token)
    if (mappingError) {
      await releaseReservation()
      return NextResponse.json(
        { success: false, error: 'Ödeme oturumu güvenli biçimde başlatılamadı. Lütfen tekrar deneyin.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ success: true, data: { ...result, amount: charge } })
  } catch {
    await releaseReservation()
    return NextResponse.json(
      { success: false, error: 'Ödeme sağlayıcısına güvenli biçimde ulaşılamadı. Lütfen tekrar deneyin.' },
      { status: 503 },
    )
  }
}
