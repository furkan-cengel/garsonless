import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@garsonless/db'
import { resolveActiveTableQrToken } from '@garsonless/db/server'
import { createIyzicoClient, initializeCheckout } from '../../../../lib/iyzico'
import { resolveIyzicoCredentials, attachPaymentTokenToShare } from '../../../../lib/payment-credentials'
import { buildCheckoutAddresses } from '../../../../lib/checkout-address'

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

  const svc = createServiceClient()
  const table = await resolveActiveTableQrToken(tableToken)
  if (!table) return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  const restaurantId = table.restaurantId

  // Read the share server-side (never trust client amount).
  const { data: shareRow } = await svc.from('payment_shares')
    .select('amount, status, method, table_session_id, restaurant_id')
    .eq('id', shareId).maybeSingle()
  const share = shareRow as { amount: number; status: string; method: string | null; table_session_id: string; restaurant_id: string } | null
  if (!share || share.restaurant_id !== restaurantId) return NextResponse.json({ success: false, error: 'Pay bulunamadı' }, { status: 404 })
  if (share.status !== 'declared') return NextResponse.json({ success: false, error: 'Bu pay zaten işlenmiş' }, { status: 409 })
  const { data: session } = await svc.from('table_sessions').select('id')
    .eq('id', share.table_session_id).eq('restaurant_id', restaurantId).eq('table_id', table.tableId).is('closed_at', null).maybeSingle()
  if (!session) return NextResponse.json({ success: false, error: 'Payın bağlı olduğu masa bağlantısı artık geçersiz.' }, { status: 404 })

  // Remaining uncovered = session total − Σ settled shares.
  const { data: orderRows } = await svc.from('orders')
    .select('total').eq('table_session_id', share.table_session_id).eq('restaurant_id', restaurantId)
    .neq('status', 'cancelled').is('deleted_at', null)
  const sessionTotal = ((orderRows ?? []) as Array<{ total: number }>).reduce((s, o) => s + (o.total ?? 0), 0)
  const { data: settledRows } = await svc.from('payment_shares')
    .select('amount').eq('table_session_id', share.table_session_id).eq('status', 'settled')
  const settled = ((settledRows ?? []) as Array<{ amount: number }>).reduce((s, x) => s + (x.amount ?? 0), 0)
  const remaining = Math.round((sessionTotal - settled) * 100) / 100
  if (remaining <= 0) return NextResponse.json({ success: false, error: 'Hesap zaten kapandı' }, { status: 409 })

  // THE clamp: never charge more than what's still owed.
  const charge = Math.min(Number(share.amount), remaining)
  if (!(charge > 0)) return NextResponse.json({ success: false, error: 'Geçersiz tutar' }, { status: 400 })
  const priceStr = charge.toFixed(2)

  // Mark the share as card (method) so the callback settle is consistent.
  await svc.from('payment_shares').update({ method: 'iyzico' }).eq('id', shareId).eq('status', 'declared')

  const requestUrl = new URL(req.url)
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const forwardedProtocol = req.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
  const devOrigin = forwardedHost ? `${forwardedProtocol}://${forwardedHost}` : requestUrl.origin
  const appUrl = process.env['NODE_ENV'] === 'production' ? (process.env['NEXT_PUBLIC_MENU_URL'] ?? requestUrl.origin) : devOrigin
  const callbackUrl = `${appUrl}/api/payment/callback`
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  const credentials = await resolveIyzicoCredentials(restaurantId)
  if (!credentials) return NextResponse.json({ success: false, error: 'Bu restoran için ödeme yapılandırılmamış' }, { status: 503 })
  const { data: restaurantRow } = await svc
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .maybeSingle()
  const checkoutAddress = buildCheckoutAddresses(
    (restaurantRow as { settings: unknown } | null)?.settings,
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
    await attachPaymentTokenToShare(shareId, result.token)
    return NextResponse.json({ success: true, data: { ...result, amount: charge } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment initialization failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
