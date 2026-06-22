import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createOrder, verifyCustomerSession, CUSTOMER_SESSION_COOKIE, createServiceClient, type OrderDiscountBreakdown } from '@garsonless/db'

const orderItemSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  modifiers: z.array(z.record(z.unknown())),
  modifiersPriceDelta: z.number(),
})

const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  // Slug of the menu the order is placed from — cross-checked server-side
  // against restaurantId so a tampered body can't inject orders into another
  // restaurant (mirrors the /api/payment restaurant cross-check). Optional for
  // back-compat; when present it MUST match.
  slug: z.string().min(1).optional(),
  tableId: z.string().uuid().nullable(),
  sessionId: z.string().uuid(),
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

  // Anti-spoof: the slug is trusted (it's the URL the customer is ordering
  // from); confirm it resolves to the restaurantId in the body. Mismatch → 400.
  if (parsed.data.slug) {
    const svc = createServiceClient()
    const { data: restRow } = await svc
      .from('restaurants')
      .select('id')
      .eq('slug', parsed.data.slug)
      .is('deleted_at', null)
      .maybeSingle()
    const resolvedId = (restRow as { id: string } | null)?.id ?? null
    if (resolvedId !== parsed.data.restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant mismatch' }, { status: 400 })
    }
  }

  // Link the order to a verified member (httpOnly cookie, same menu origin).
  // Covers BOTH place-order and pay-first. No cookie → guest, no redemption.
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
  const session = await verifyCustomerSession(token)

  const result = await createOrder({
    restaurantId: parsed.data.restaurantId,
    tableId: parsed.data.tableId,
    sessionId: parsed.data.sessionId,
    lines: parsed.data.items,
    customerId: session?.customerId ?? null,
    redeemPoints: session ? (parsed.data.redeemPoints ?? 0) : 0, // guests can't redeem
    redeemStampClaim: session ? (parsed.data.redeemStampClaim ?? false) : false,
    catalogItemId: session ? (parsed.data.catalogItemId ?? null) : null,
  })

  if (!result.ok) {
    const status = result.error === 'Table not found for this restaurant' ? 400 : 500
    return NextResponse.json({ success: false, error: result.error }, { status })
  }

  return NextResponse.json({ success: true, data: { orderId: result.orderId, breakdown: result.breakdown } })
}
