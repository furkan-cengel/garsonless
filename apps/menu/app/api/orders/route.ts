import { readBoundedRequestBody } from '@garsonless/application/request-body'
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { placePublicOrder } from '@garsonless/application/orders'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import type { OrderDiscountBreakdown } from '@garsonless/db/types'
import { createPublicOrderPort, createPublicTableQueryPort, resolveTransferredGuestTable } from '@garsonless/db/server'
import { getCustomerSession } from '../../../lib/customer-session'
import { MAX_ORDER_BODY_BYTES, parseOrderRequestBody, validateOrderRequestHeaders } from './order-request'

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string; code?: string }

export async function POST(
  req: Request,
): Promise<NextResponse<ApiResponse<{ orderId: string; breakdown: OrderDiscountBreakdown }>>> {
  const headerError = validateOrderRequestHeaders(req.headers)
  if (headerError) {
    return NextResponse.json({ success: false, error: headerError.error }, { status: headerError.status })
  }

  const body = await readBoundedRequestBody(req, MAX_ORDER_BODY_BYTES)
  if (!body.ok) {
    return NextResponse.json({ success: false, error: body.status === 413 ? 'Sipariş isteği çok büyük.' : 'Geçersiz JSON.' }, { status: body.status })
  }
  let rawBody: string
  try {
    rawBody = new TextDecoder('utf-8', { fatal: true }).decode(body.bytes)
  } catch {
    return NextResponse.json({ success: false, error: 'Geçersiz JSON.' }, { status: 400 })
  }
  const parsed = parseOrderRequestBody(rawBody)
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: parsed.status })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown'
  const tableResult = await resolvePublicTableContext(parsed.data.tableToken, createPublicTableQueryPort())
  if (!tableResult.ok) {
    return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: 503 })
  }
  let table = tableResult.value
  if (!table || table.restaurantSlug !== parsed.data.slug) {
    return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  }
  const transferredTableId = await resolveTransferredGuestTable({ restaurantId: table.restaurantId, sourceTableId: table.tableId, guestSessionId: parsed.data.sessionId })
  if (transferredTableId) table = { ...table, tableId: transferredTableId }

  const keyHash = createHash('sha256')
    .update(`${ip}:${parsed.data.sessionId}:${req.headers.get('user-agent') ?? ''}`)
    .digest('hex')
  // sessionId and user-agent are client-chosen, so the device bucket above can
  // be rotated freely; this bucket uses only the verified table and address.
  const tableKeyHash = createHash('sha256')
    .update(`table:${table.tableId}:${ip}`)
    .digest('hex')
  // Link the order to a verified member (httpOnly cookie, same menu origin).
  // Covers BOTH place-order and pay-first. No cookie → guest, no redemption.
  const session = await getCustomerSession()

  const result = await placePublicOrder(
    {
      actor: 'table-guest',
      restaurantId: table.restaurantId,
      tableId: table.tableId,
      tableToken: parsed.data.tableToken,
      sessionId: parsed.data.sessionId,
    },
    {
      restaurantId: table.restaurantId,
      slug: parsed.data.slug,
      tableToken: parsed.data.tableToken,
      tableId: table.tableId,
      sessionId: parsed.data.sessionId,
      requestId: parsed.data.requestId,
      lines: parsed.data.items,
      customerId: session?.customerId ?? null,
      redeemPoints: session ? (parsed.data.redeemPoints ?? 0) : 0, // guests can't redeem
      redeemStampClaim: session ? (parsed.data.redeemStampClaim ?? false) : false,
      catalogItemId: session ? (parsed.data.catalogItemId ?? null) : null,
      couponCode: parsed.data.couponCode ?? null,
      rateLimitKey: keyHash,
      tableRateLimitKey: tableKeyHash,
    },
    createPublicOrderPort(),
  )

  if (!result.ok) {
    const couponCode = result.error.match(/^(COUPON_[A-Z_]+):/)?.[1] ?? null
    const publicError = couponCode ? result.error.slice(couponCode.length + 1) : result.error
    const status = result.error === 'Sipariş güvenlik kontrolü kullanılamıyor'
      ? 503
      : result.error === 'İşletme şu anda yeni sipariş almıyor.'
        ? 423
      : result.error === 'Bu işletmenin planında QR siparişi açık değil.'
        ? 403
      : result.error.startsWith('Çok fazla sipariş')
        ? 429
        : result.error.startsWith('Failed to')
          ? 500
          : 400
    return NextResponse.json({ success: false, error: publicError, ...(couponCode ? { code: couponCode } : {}) }, { status: couponCode ? 409 : status })
  }

  return NextResponse.json({ success: true, data: { orderId: result.value.orderId, breakdown: result.value.breakdown as OrderDiscountBreakdown } })
}
