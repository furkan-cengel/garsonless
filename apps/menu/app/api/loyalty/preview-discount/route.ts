import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { computeOrderDiscount, verifyCustomerSession, CUSTOMER_SESSION_COOKIE } from '@garsonless/db'

const schema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    modifiersPriceDelta: z.number(),
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

  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
  const session = await verifyCustomerSession(token)

  const d = await computeOrderDiscount({
    customerId: session?.customerId ?? null,
    restaurantId: parsed.data.restaurantId,
    lines: parsed.data.items,
    requestedPointsRedeem: session ? (parsed.data.redeemPoints ?? 0) : 0,
    requestedStampClaim: session ? (parsed.data.redeemStampClaim ?? false) : false,
    requestedCatalogReward: session && parsed.data.catalogItemId ? { itemId: parsed.data.catalogItemId } : null,
  })

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
    },
  })
}
