import { NextResponse } from 'next/server'
import { z } from 'zod'
import { customerActorContext, previewLoyaltyDiscount } from '@garsonless/application/loyalty'
import { createLoyaltyQueryPort, resolveOrderLines } from '@garsonless/db/server'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

const schema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    selectedModifiers: z.array(z.object({
      group_id: z.string().min(1),
      option_id: z.string().min(1),
      quantity: z.number().int().positive().optional(),
    })).optional(),
    removedIngredientIds: z.array(z.string()).optional(),
    combo: z.object({
      instanceId: z.string().uuid(),
      sectionInstanceId: z.string().min(1).max(128),
      comboIndex: z.number().int().min(1).max(3),
    }).optional(),
    promotion: z.object({
      sectionInstanceId: z.string().min(1).max(128),
      kind: z.enum(['discount-badge', 'daily-special']),
    }).optional(),
    modifiers: z.array(z.record(z.unknown())).optional(),
    modifiersPriceDelta: z.number().optional(),
  })).min(1),
  redeemPoints: z.number().int().nonnegative().optional(),
  redeemStampClaim: z.boolean().optional(),
  catalogItemId: z.string().uuid().nullable().optional(),
})

// Read-only discount preview. Same engine as placement → no client money math,
// no drift. Returns 0-discount for guests. Never writes the ledger.
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
  if (!await publicRestaurantHasFeature(parsed.data.restaurantId, 'loyalty')) {
    return NextResponse.json({ ok: false, error: 'Bu özellik Pro paketi gerektirir.' }, { status: 403 })
  }

  const session = await getCustomerSession()
  const resolved = await resolveOrderLines(parsed.data.restaurantId, parsed.data.items)
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 })
  }

  const loyaltyContext = session && resolved.loyaltyStackingAllowed ? customerActorContext({
    authUserId: session.authUserId,
    customerId: session.customerId,
    restaurantId: parsed.data.restaurantId,
  }) : null
  const result = await previewLoyaltyDiscount(loyaltyContext, {
    restaurantId: parsed.data.restaurantId,
    lines: resolved.discountLines,
    requestedPointsRedeem: parsed.data.redeemPoints ?? 0,
    requestedStampClaim: parsed.data.redeemStampClaim ?? false,
    requestedCatalogReward: parsed.data.catalogItemId ? { itemId: parsed.data.catalogItemId } : null,
  }, createLoyaltyQueryPort())
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 })
  }
  const d = result.value

  // Public subset only (no scopeKey / pointsRate internals).
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
      finalTotal: d.finalTotal,
      loyaltySuppressedByPromotion: Boolean(session && !resolved.loyaltyStackingAllowed),
    },
  })
}
