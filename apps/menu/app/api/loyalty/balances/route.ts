import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifyCustomerSession,
  getMemberBalances,
  CUSTOMER_SESSION_COOKIE,
  type MemberBalances,
} from '@garsonless/db'

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

  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
  const session = await verifyCustomerSession(token)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Not a member' }, { status: 401 })
  }

  const balances = await getMemberBalances(session.customerId, restaurantId)
  return NextResponse.json({ ok: true, balances })
}
