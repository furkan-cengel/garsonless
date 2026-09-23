import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readBoundedRequestBody } from '@garsonless/application/request-body'
import { createPublicOrderPort, resolveCheckoutDiscount, resolveOrderLines } from '@garsonless/db/server'
import { requestClientAddress } from '../../../../lib/customer-auth-server'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

const MAX_PREVIEW_BODY_BYTES = 128 * 1024

// This endpoint is public and answers whether a coupon code exists, so it is
// throttled per client address: a general budget for cart edits plus a tighter
// one for coupon lookups, which would otherwise allow unbounded code guessing.
const PREVIEW_LIMITS = [
  { scope: 'preview', max: 60, windowSeconds: 60, couponOnly: false },
  { scope: 'preview-coupon', max: 30, windowSeconds: 600, couponOnly: true },
  { scope: 'preview-coupon-day', max: 100, windowSeconds: 86_400, couponOnly: true },
] as const

const schema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
    selectedModifiers: z.array(z.object({ group_id: z.string().min(1).max(128), option_id: z.string().min(1).max(128), quantity: z.number().int().positive().max(99).optional() })).max(50).optional(),
    removedIngredientIds: z.array(z.string().max(128)).max(50).optional(),
    combo: z.object({ instanceId: z.string().uuid(), sectionInstanceId: z.string().min(1).max(128), comboIndex: z.number().int().min(1).max(3) }).optional(),
    promotion: z.object({
      sectionInstanceId: z.string().min(1).max(128),
      kind: z.enum(['discount-badge', 'daily-special', 'promo-slider']),
      offer: z.enum(['freebie']).optional(),
      instanceId: z.string().uuid().optional(),
      role: z.enum(['qualifier', 'reward']).optional(),
    }).optional(),
    modifiers: z.array(z.record(z.unknown())).optional(),
    modifiersPriceDelta: z.number().optional(),
  })).min(1).max(100),
  redeemPoints: z.number().int().nonnegative().optional(),
  redeemStampClaim: z.boolean().optional(),
  catalogItemId: z.string().uuid().nullable().optional(),
  couponCode: z.string().trim().max(32).nullable().optional(),
})

export async function POST(req: Request): Promise<NextResponse> {
  const bounded = await readBoundedRequestBody(req, MAX_PREVIEW_BODY_BYTES)
  if (!bounded.ok) {
    return NextResponse.json({ ok: false, error: bounded.status === 413 ? 'İstek çok büyük.' : 'Geçersiz JSON.' }, { status: bounded.status })
  }
  let body: unknown
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bounded.bytes)) } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz JSON.' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz istek.' }, { status: 400 })
  if (!await publicRestaurantHasFeature(parsed.data.restaurantId, 'loyalty')) {
    return NextResponse.json({ ok: false, error: 'Bu özellik Pro paketi gerektirir.' }, { status: 403 })
  }
  const address = requestClientAddress(req)
  const hasCoupon = Boolean(parsed.data.couponCode)
  const orderPort = createPublicOrderPort()
  for (const limit of PREVIEW_LIMITS) {
    if (limit.couponOnly && !hasCoupon) continue
    const consumed = await orderPort.consumeRateLimit({
      restaurantId: parsed.data.restaurantId,
      keyHash: createHash('sha256').update(`${limit.scope}:${address}`).digest('hex'),
      max: limit.max,
      windowSeconds: limit.windowSeconds,
    })
    if (!consumed.ok) {
      const unavailable = consumed.error === 'Sipariş güvenlik kontrolü kullanılamıyor'
      return NextResponse.json(
        { ok: false, code: unavailable ? null : 'RATE_LIMITED', error: unavailable ? 'İndirim şu anda doğrulanamadı.' : 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.' },
        { status: unavailable ? 503 : 429 },
      )
    }
  }
  const [session, resolved] = await Promise.all([
    getCustomerSession(),
    resolveOrderLines(parsed.data.restaurantId, parsed.data.items),
  ])
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 })
  const result = await resolveCheckoutDiscount({
    customerId: session?.customerId ?? null,
    restaurantId: parsed.data.restaurantId,
    lines: resolved.discountLines,
    loyaltyStackingAllowed: resolved.loyaltyStackingAllowed,
    requestedPointsRedeem: session ? parsed.data.redeemPoints ?? 0 : 0,
    requestedStampClaim: session ? parsed.data.redeemStampClaim ?? false : false,
    requestedCatalogReward: session && parsed.data.catalogItemId ? { itemId: parsed.data.catalogItemId } : null,
    couponCode: parsed.data.couponCode ?? null,
  })
  if (!result.ok) return NextResponse.json({ ok: false, code: result.code, error: result.error }, { status: result.code === 'COUPON_AUTH_REQUIRED' ? 403 : 422 })
  const d = result.discount
  return NextResponse.json({
    ok: true,
    preview: {
      subtotal: d.subtotal,
      memberDiscountAmount: d.memberDiscountAmount,
      memberDiscountPct: d.memberDiscountPct,
      memberTierName: d.memberTierName,
      pointsDiscountAmount: d.pointsDiscountAmount,
      pointsRedeemed: d.pointsRedeemed,
      stampDiscountAmount: d.stampDiscountAmount,
      rewardItemName: d.rewardItemName,
      catalogDiscountAmount: d.catalogDiscountAmount,
      catalogPointsCost: d.catalogPointsCost,
      catalogItemName: d.catalogItemName,
      couponId: d.couponId ?? null,
      couponCode: d.couponCode ?? null,
      couponName: d.couponName ?? null,
      couponDiscountAmount: d.couponDiscountAmount ?? 0,
      couponStackingPolicy: d.couponStackingPolicy ?? null,
      finalTotal: d.finalTotal,
      loyaltySuppressedByPromotion: Boolean(session && !resolved.loyaltyStackingAllowed),
    },
  })
}
