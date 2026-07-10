import { NextResponse } from 'next/server'
import { z } from 'zod'
import { computeOrderDiscount, resolveOrderLines } from '@garsonless/db'
import { getCustomerSession } from '../../../../lib/customer-session'

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

  const session = await getCustomerSession()
  const resolved = await resolveOrderLines(parsed.data.restaurantId, parsed.data.items)
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 })
  }

  const d = await computeOrderDiscount({
    customerId: session?.customerId ?? null,
    restaurantId: parsed.data.restaurantId,
    lines: resolved.discountLines,
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
