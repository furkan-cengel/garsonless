import { NextResponse } from 'next/server'
import { declareSplitShare } from '@garsonless/application/splits'
import { resolvePublicTableContext } from '@garsonless/application/tables'
import { createPublicTableQueryPort, createSplitPaymentPort } from '@garsonless/db/server'
import { getCustomerSession } from '../../../../lib/customer-session'
import { publicRestaurantHasFeature } from '../../../../lib/restaurant-feature-access'
import {
  createSplitRateLimitKey,
  createSplitRequestFingerprint,
  readBoundedPaymentJson,
  splitCreateSchema,
  splitErrorStatus,
} from '../../../../lib/split-request'

// Customer declares a split share (card intent OR cash). Service-role, gated by
// the slug↔restaurant cross-check + an OPEN session (mirrors /api/orders). The
// amount is SERVER-AUTHORITATIVE: item-splits derive it from the session's order
// items; free-splits take the client amount but validate it against the session.

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ shareId: string; amount: number }>>> {
  const raw = await readBoundedPaymentJson(req)
  if (!raw.ok) return NextResponse.json({ success: false, error: raw.error }, { status: raw.status })
  const parsed = splitCreateSchema.safeParse(raw.data)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { slug, tableToken, tableSessionId, requestId, method, label, amount, assignedItems } = parsed.data

  const tableResult = await resolvePublicTableContext(tableToken, createPublicTableQueryPort())
  if (!tableResult.ok) return NextResponse.json({ success: false, error: 'Masa bağlantısı doğrulanamadı.' }, { status: 503 })
  const table = tableResult.value
  if (!table || table.restaurantSlug !== slug) return NextResponse.json({ success: false, error: 'Masa bağlantısı geçersiz veya yenilenmiş.' }, { status: 404 })
  if (!await publicRestaurantHasFeature(table.restaurantId, 'split_payments')) {
    return NextResponse.json({ success: false, error: 'Bu özellik Pro paketi gerektirir.' }, { status: 403 })
  }
  if (method === 'iyzico' && !await publicRestaurantHasFeature(table.restaurantId, 'online_payments')) {
    return NextResponse.json({ success: false, error: 'Kartla ödeme bu işletmede aktif değil.' }, { status: 403 })
  }
  const session = await getCustomerSession()
  const result = await declareSplitShare(
    { actor: 'table-guest', restaurantId: table.restaurantId, tableId: table.tableId, tableToken },
    {
      restaurantId: table.restaurantId,
      tableSessionId,
      requestId,
      requestFingerprint: createSplitRequestFingerprint({
        tableSessionId,
        method,
        label,
        amount,
        assignedItems,
      }),
      rateLimitKey: createSplitRateLimitKey(req, tableToken),
      method,
      label,
      amount,
      assignedItems,
      customerId: session?.customerId ?? null,
    },
    createSplitPaymentPort(),
  )
  if (!result.ok) {
    const status = splitErrorStatus(result.error)
    return NextResponse.json({ success: false, error: result.error }, { status })
  }
  return NextResponse.json({ success: true, data: result.value })
}
