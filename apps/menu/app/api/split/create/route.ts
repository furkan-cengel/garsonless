import { NextResponse } from 'next/server'
import { z } from 'zod'
import { declareSplitShare } from '@garsonless/application/splits'
import { createSplitPaymentPort, resolveActiveTableQrToken } from '@garsonless/db/server'
import { getCustomerSession } from '../../../../lib/customer-session'

// Customer declares a split share (card intent OR cash). Service-role, gated by
// the slug↔restaurant cross-check + an OPEN session (mirrors /api/orders). The
// amount is SERVER-AUTHORITATIVE: item-splits derive it from the session's order
// items; free-splits take the client amount but validate it against the session.

const schema = z.object({
  slug: z.string().min(1),
  tableToken: z.string().uuid(),
  tableSessionId: z.string().uuid(),
  method: z.enum(['iyzico', 'cash']),
  label: z.string().max(40).optional(),
  // free-amount split
  amount: z.number().positive().optional(),
  // item-based split: line refs; the server re-derives the amount from the DB.
  assignedItems: z.array(z.object({ orderId: z.string().uuid(), itemId: z.string() })).optional(),
})

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ shareId: string; amount: number }>>> {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { slug, tableToken, tableSessionId, method, label, amount, assignedItems } = parsed.data

  const table = await resolveActiveTableQrToken(tableToken)
  if (!table || table.restaurantSlug !== slug) return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  const session = await getCustomerSession()
  const result = await declareSplitShare(
    { actor: 'table-guest', restaurantId: table.restaurantId, tableId: table.tableId, tableToken },
    {
      restaurantId: table.restaurantId,
      tableSessionId,
      method,
      label,
      amount,
      assignedItems,
      customerId: session?.customerId ?? null,
    },
    createSplitPaymentPort(),
  )
  if (!result.ok) {
    const status = result.error.includes('bulunamadı') || result.error.includes('kapanmış') ? 404 : 400
    return NextResponse.json({ success: false, error: result.error }, { status })
  }
  return NextResponse.json({ success: true, data: result.value })
}
