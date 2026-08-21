import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveCheckoutDiscount, resolveOrderLines } from '@garsonless/db/server'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

const schema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    selectedModifiers: z.array(z.object({ group_id: z.string().min(1), option_id: z.string().min(1), quantity: z.number().int().positive().optional() })).optional(),
    removedIngredientIds: z.array(z.string()).optional(),
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
  })).min(1),
  redeemPoints: z.number().int().nonnegative().optional(),
  redeemStampClaim: z.boolean().optional(),
  catalogItemId: z.string().uuid().nullable().optional(),
  couponCode: z.string().trim().max(32).nullable().optional(),
})

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz JSON.' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz istek.' }, { status: 400 })
  if (!await publicRestaurantHasFeature(parsed.data.restaurantId, 'loyalty')) {
    return NextResponse.json({ ok: false, error: 'Bu özellik Pro paketi gerektirir.' }, { status: 403 })
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
