import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient, createShareDB } from '@garsonless/db'
import { getCustomerSession } from '../../../../lib/customer-session'

// Customer declares a split share (card intent OR cash). Service-role, gated by
// the slug↔restaurant cross-check + an OPEN session (mirrors /api/orders). The
// amount is SERVER-AUTHORITATIVE: item-splits derive it from the session's order
// items; free-splits take the client amount but validate it against the session.

const schema = z.object({
  restaurantId: z.string().uuid(),
  slug: z.string().min(1).optional(),
  tableSessionId: z.string().uuid(),
  method: z.enum(['iyzico', 'cash']),
  label: z.string().max(40).optional(),
  // free-amount split
  amount: z.number().positive().optional(),
  // item-based split: line refs; the server re-derives the amount from the DB.
  assignedItems: z.array(z.object({ orderId: z.string().uuid(), itemId: z.string() })).optional(),
})

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

interface OrderLine { itemId?: string; price?: number; quantity?: number; modifiersPriceDelta?: number }

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ shareId: string; amount: number }>>> {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { restaurantId, slug, tableSessionId, method, label, amount, assignedItems } = parsed.data

  const svc = createServiceClient()
  // Anti-spoof: slug must resolve to restaurantId (same as /api/orders).
  if (slug) {
    const { data: r } = await svc.from('restaurants').select('id').eq('slug', slug).is('deleted_at', null).maybeSingle()
    if ((r as { id: string } | null)?.id !== restaurantId) return NextResponse.json({ success: false, error: 'Restaurant mismatch' }, { status: 400 })
  }
  // Session must be OPEN and belong to the restaurant.
  const { data: sessionRow } = await svc.from('table_sessions').select('id').eq('id', tableSessionId).eq('restaurant_id', restaurantId).is('closed_at', null).maybeSingle()
  if (!sessionRow) return NextResponse.json({ success: false, error: 'Adisyon bulunamadı ya da kapanmış' }, { status: 404 })

  // Session order lines (server-authoritative) — used to derive item-split amounts
  // and cap free amounts at the session total.
  const { data: orderRows } = await svc.from('orders')
    .select('id, total, items').eq('table_session_id', tableSessionId).eq('restaurant_id', restaurantId)
    .neq('status', 'cancelled').is('deleted_at', null)
  const orders = (orderRows ?? []) as Array<{ id: string; total: number; items: unknown }>
  const sessionTotal = orders.reduce((s, o) => s + (o.total ?? 0), 0)

  let shareAmount: number
  if (assignedItems && assignedItems.length > 0) {
    // Item-based: sum the assigned lines from the ACTUAL order data (never trust
    // a client amount). Duplicate itemIds in one order sum together.
    let sum = 0
    for (const { orderId, itemId } of assignedItems) {
      const order = orders.find((o) => o.id === orderId)
      if (!order || !Array.isArray(order.items)) continue
      for (const line of order.items as OrderLine[]) {
        if (line.itemId === itemId) {
          const unit = (typeof line.price === 'number' ? line.price : 0) + (typeof line.modifiersPriceDelta === 'number' ? line.modifiersPriceDelta : 0)
          const qty = typeof line.quantity === 'number' && line.quantity > 0 ? line.quantity : 1
          sum += Math.max(0, unit) * qty
        }
      }
    }
    shareAmount = Math.round(sum * 100) / 100
    if (shareAmount <= 0) return NextResponse.json({ success: false, error: 'Seçili kalemlerden tutar çıkmadı' }, { status: 400 })
  } else {
    if (!(amount && amount > 0)) return NextResponse.json({ success: false, error: 'Tutar gerekli' }, { status: 400 })
    // Free amount: cap at the session total (a single share can't exceed the bill).
    shareAmount = Math.min(amount, sessionTotal)
  }

  const session = await getCustomerSession()

  const { shareId, error } = await createShareDB({
    restaurantId,
    tableSessionId,
    amount: shareAmount,
    method,
    customerId: session?.customerId ?? null,
    label: label ?? null,
    assignedItems: assignedItems ?? null,
  })
  if (error || !shareId) return NextResponse.json({ success: false, error: error ?? 'Pay oluşturulamadı' }, { status: 500 })

  return NextResponse.json({ success: true, data: { shareId, amount: shareAmount } })
}
