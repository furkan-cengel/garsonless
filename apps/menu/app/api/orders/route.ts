import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createOrder, createServiceClient, type OrderDiscountBreakdown } from '@garsonless/db'
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
  restaurantId: z.string().uuid(),
  // Slug of the menu the order is placed from — cross-checked server-side
  // against restaurantId so a tampered body can't inject orders into another
  // restaurant (mirrors the /api/payment restaurant cross-check). Optional for
  // back-compat; when present it MUST match.
  slug: z.string().min(1),
  tableId: z.string().uuid(),
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

  // Anti-spoof: the slug is trusted (it's the URL the customer is ordering
  // from); confirm it resolves to the restaurantId in the body. Mismatch → 400.
  const svc = createServiceClient()
  {
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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown'
  const keyHash = createHash('sha256')
    .update(`${ip}:${parsed.data.sessionId}:${req.headers.get('user-agent') ?? ''}`)
    .digest('hex')
  const rpc = svc.rpc.bind(svc) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data: allowed, error: rateError } = await rpc('consume_public_order_rate_limit', {
    p_restaurant_id: parsed.data.restaurantId,
    p_key_hash: keyHash,
    p_max: 8,
    p_window_seconds: 60,
  })
  if (rateError) {
    return NextResponse.json({ success: false, error: 'Sipariş güvenlik kontrolü kullanılamıyor' }, { status: 503 })
  }
  if (allowed !== true) {
    return NextResponse.json({ success: false, error: 'Çok fazla sipariş denemesi. Lütfen kısa süre sonra tekrar deneyin.' }, { status: 429 })
  }

  // Link the order to a verified member (httpOnly cookie, same menu origin).
  // Covers BOTH place-order and pay-first. No cookie → guest, no redemption.
  const session = await getCustomerSession()

  const result = await createOrder({
    restaurantId: parsed.data.restaurantId,
    tableId: parsed.data.tableId,
    sessionId: parsed.data.sessionId,
    requestId: parsed.data.requestId,
    lines: parsed.data.items,
    customerId: session?.customerId ?? null,
    redeemPoints: session ? (parsed.data.redeemPoints ?? 0) : 0, // guests can't redeem
    redeemStampClaim: session ? (parsed.data.redeemStampClaim ?? false) : false,
    catalogItemId: session ? (parsed.data.catalogItemId ?? null) : null,
  })

  if (!result.ok) {
    const status = result.error.startsWith('Failed to') ? 500 : 400
    return NextResponse.json({ success: false, error: result.error }, { status })
  }

  return NextResponse.json({ success: true, data: { orderId: result.orderId, breakdown: result.breakdown } })
}
