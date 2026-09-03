import { NextResponse } from 'next/server'
import { declareSplitShare, prepareSplitCheckout, releaseSplitCheckout } from '@garsonless/application/splits'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import { createPublicTableQueryPort, createSplitPaymentPort } from '@garsonless/db/server'
import { createIyzicoClient, initializeCheckout } from '../../../../lib/iyzico'
import { resolveIyzicoCredentials, attachPaymentTokenToShare } from '../../../../lib/payment-credentials'
import { buildCheckoutAddresses } from '../../../../lib/checkout-address'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'
import { getCustomerSession } from '../../../../lib/customer-session'
import { isIyzicoEnvironmentAllowed } from '../../../../lib/iyzico-environment'
import {
  createSplitRateLimitKey,
  createSplitRequestFingerprint,
  readBoundedPaymentJson,
  splitErrorStatus,
  splitPaySchema,
} from '../../../../lib/split-request'

// Start an İyzico checkout for ONE split share. The charge is SERVER-AUTHORITATIVE
// AND CLAMPED to the remaining uncovered total: charge = min(share.amount,
// session_total − Σ settled shares). A client can never be overcharged past what
// the table still owes; a fully-covered session rejects the checkout.

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ paymentPageUrl: string; token: string; amount: number; shareId: string }>>> {
  const raw = await readBoundedPaymentJson(req)
  if (!raw.ok) return NextResponse.json({ success: false, error: raw.error }, { status: raw.status })
  const parsed = splitPaySchema.safeParse(raw.data)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { tableToken, buyerName, buyerSurname, buyerEmail, buyerPhone, buyerIdentityNumber, deviceId } = parsed.data

  const tableResult = await resolvePublicTableContext(tableToken, createPublicTableQueryPort())
  if (!tableResult.ok) return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: 503 })
  const table = tableResult.value
  if (!table) return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  const restaurantId = table.restaurantId
  if (!await publicRestaurantHasFeature(restaurantId, 'split_payments')) {
    return NextResponse.json({ success: false, error: 'Bu özellik Pro paketi gerektirir.' }, { status: 403 })
  }
  if (!await publicRestaurantHasFeature(restaurantId, 'online_payments')) {
    return NextResponse.json({ success: false, error: 'Kartla ödeme bu işletmede aktif değil.' }, { status: 403 })
  }
  const credentials = await resolveIyzicoCredentials(restaurantId)
  if (!credentials || !isIyzicoEnvironmentAllowed(credentials.baseUrl)) {
    return NextResponse.json({ success: false, error: 'Kartla ödeme bu işletmede henüz kullanıma hazır değil.' }, { status: 503 })
  }

  const tableContext = { actor: 'table-guest' as const, restaurantId, tableId: table.tableId, tableToken }
  const splitPort = createSplitPaymentPort()
  const rateLimitKey = createSplitRateLimitKey(req, tableToken)
  let shareId = parsed.data.shareId
  if (!shareId) {
    if (table.restaurantSlug !== parsed.data.slug) {
      return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
    }
    const customerSession = await getCustomerSession()
    const declaration = await declareSplitShare(
      tableContext,
      {
        restaurantId,
        tableSessionId: parsed.data.tableSessionId!,
        requestId: parsed.data.requestId!,
        requestFingerprint: createSplitRequestFingerprint({
          tableSessionId: parsed.data.tableSessionId!,
          method: 'iyzico',
          label: parsed.data.label,
          amount: parsed.data.amount,
          assignedItems: parsed.data.assignedItems,
        }),
        rateLimitKey,
        method: 'iyzico',
        label: parsed.data.label,
        amount: parsed.data.amount,
        assignedItems: parsed.data.assignedItems,
        customerId: customerSession?.customerId ?? null,
      },
      splitPort,
    )
    if (!declaration.ok) {
      return NextResponse.json({ success: false, error: declaration.error }, { status: splitErrorStatus(declaration.error) })
    }
    shareId = declaration.value.shareId
  } else {
    const rateLimit = await splitPort.consumeRateLimit({
      restaurantId,
      keyHash: rateLimitKey,
      max: 12,
      windowSeconds: 60,
    })
    if (!rateLimit.ok) {
      return NextResponse.json({ success: false, error: rateLimit.error }, { status: splitErrorStatus(rateLimit.error) })
    }
  }
  const prepared = await prepareSplitCheckout(
    tableContext,
    { restaurantId, shareId },
    splitPort,
  )
  if (!prepared.ok) {
    const status = prepared.error.includes('bulunamadı') || prepared.error.includes('geçersiz') ? 404 : 409
    return NextResponse.json({ success: false, error: prepared.error }, { status })
  }
  const charge = prepared.value.amount
  const priceStr = charge.toFixed(2)
  const releaseReservation = async () => {
    const released = await releaseSplitCheckout(
      tableContext,
      { restaurantId, shareId },
      splitPort,
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

  const checkoutAddress = buildCheckoutAddresses(
    prepared.value.restaurantSettings,
    `${buyerName} ${buyerSurname}`,
  )

  try {
    const client = createIyzicoClient(credentials)
    const result = await initializeCheckout(client, {
      locale: 'tr', conversationId: shareId, price: priceStr, paidPrice: priceStr, currency: 'TRY',
      basketId: shareId, paymentGroup: 'PRODUCT', callbackUrl,
      buyer: { id: deviceId, name: buyerName, surname: buyerSurname, email: buyerEmail, gsmNumber: buyerPhone, identityNumber: buyerIdentityNumber, registrationAddress: checkoutAddress.registrationAddress, city: checkoutAddress.city, country: 'Turkey', ip },
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
    return NextResponse.json({ success: true, data: { ...result, amount: charge, shareId } })
  } catch {
    await releaseReservation()
    return NextResponse.json(
      { success: false, error: 'Ödeme sağlayıcısına güvenli biçimde ulaşılamadı. Lütfen tekrar deneyin.' },
      { status: 503 },
    )
  }
}
