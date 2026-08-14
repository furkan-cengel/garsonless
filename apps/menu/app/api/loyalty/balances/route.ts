import { NextResponse } from 'next/server'
import {
  customerActorContext,
  readMemberLoyalty,
  type MemberBalances,
} from '@garsonless/application/loyalty'
import { createLoyaltyQueryPort } from '@garsonless/db/server'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'

type ApiResponse =
  | { ok: true; balances: MemberBalances | null }
  | { ok: false; error: string }

// Cookie-scoped balance read: verifies the member session, then reads balances
// service-role for THAT customer only. Anon RLS blocks the ledger directly.
export async function GET(req: Request): Promise<NextResponse<ApiResponse>> {
  const restaurantId = new URL(req.url).searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ ok: false, error: 'restaurantId required' }, { status: 400 })
  }
  if (!await publicRestaurantHasFeature(restaurantId, 'loyalty')) {
    return NextResponse.json({ ok: false, error: 'Bu özellik Pro paketi gerektirir.' }, { status: 403 })
  }

  const session = await getCustomerSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Not a member' }, { status: 401 })
  }

  const result = await readMemberLoyalty(customerActorContext({
    authUserId: session.authUserId,
    customerId: session.customerId,
    restaurantId,
  }), createLoyaltyQueryPort())
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 })
  }
  return NextResponse.json({ ok: true, balances: result.value })
}
