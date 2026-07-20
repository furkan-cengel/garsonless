import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { placePublicOrder } from '@garsonless/application/orders'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import type { OrderDiscountBreakdown } from '@garsonless/db/types'
import { createPublicOrderPort, createPublicTableQueryPort } from '@garsonless/db/server'
import { getCustomerSession } from '../../../lib/customer-session'

const orderItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
  selectedModifiers: z.array(z.object({
    group_id: z.string().min(1),
    option_id: z.string().min(1),
    quantity: z.number().int().positive().optional(),
  })).optional(),
  removedIngredientIds: z.array(z.string().min(1)).optional(),
  // Persisted pre-migration carts may still send these; the DB resolver ignores them.
  modifiers: z.array(z.record(z.unknown())).optional(),
  name: z.string().optional(),
  price: z.number().optional(),
  modifiersPriceDelta: z.number().optional(),
})

const createOrderSchema = z.object({
  slug: z.string().min(1),
  tableToken: z.string().uuid(),
  sessionId: z.string().uuid(),
  requestId: z.string().uuid(),
  items: z.array(orderItemSchema).min(1),
  // total is IGNORED — the server recomputes from DB prices. Kept for back-compat.
  total: z.number().nonnegative().optional(),
  redeemPoints: z.number().int().nonnegative().optional(),
  redeemStampClaim: z.boolean().optional(),
  catalogItemId: z.string().uuid().nullable().optional(),
})

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export async function POST(
  req: Request,
): Promise<NextResponse<ApiResponse<{ orderId: string; breakdown: OrderDiscountBreakdown }>>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown'
  const tableResult = await resolvePublicTableContext(parsed.data.tableToken, createPublicTableQueryPort())
  if (!tableResult.ok) {
    return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: 503 })
  }
  const table = tableResult.value
  if (!table || table.restaurantSlug !== parsed.data.slug) {
    return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  }

  const keyHash = createHash('sha256')
    .update(`${ip}:${parsed.data.sessionId}:${req.headers.get('user-agent') ?? ''}`)
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
      rateLimitKey: keyHash,
    },
    createPublicOrderPort(),
  )

  if (!result.ok) {
    const status = result.error === 'Sipariş güvenlik kontrolü kullanılamıyor'
      ? 503
      : result.error.startsWith('Çok fazla sipariş')
        ? 429
        : result.error.startsWith('Failed to')
          ? 500
          : 400
    return NextResponse.json({ success: false, error: result.error }, { status })
  }

  return NextResponse.json({ success: true, data: { orderId: result.value.orderId, breakdown: result.value.breakdown as OrderDiscountBreakdown } })
}
