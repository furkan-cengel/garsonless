import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@garsonless/db'

const Query = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
})

export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid table credentials' }, { status: 400 })
  const svc = createServiceClient()
  const { data: table } = await svc.from('tables').select('id').eq('id', parsed.data.tableId)
    .eq('restaurant_id', parsed.data.restaurantId).is('deleted_at', null).maybeSingle()
  if (!table) return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 })

  const { data: session, error: sessionError } = await svc.from('table_sessions')
    .select('id, opened_at').eq('restaurant_id', parsed.data.restaurantId)
    .eq('table_id', parsed.data.tableId).is('closed_at', null).maybeSingle()
  if (sessionError) return NextResponse.json({ success: false, error: 'Table state unavailable' }, { status: 503 })
  if (!session) return NextResponse.json({ success: true, data: { session: null, orders: [], shares: [] } })

  const [{ data: orders, error: orderError }, { data: shares, error: shareError }] = await Promise.all([
    svc.from('orders').select('id, status, total, paid_at, created_at, items')
      .eq('table_session_id', session.id).is('deleted_at', null).order('created_at'),
    svc.from('payment_shares').select('id, amount, method, status, label')
      .eq('table_session_id', session.id).neq('status', 'void'),
  ])
  if (orderError || shareError) return NextResponse.json({ success: false, error: 'Table state unavailable' }, { status: 503 })
  return NextResponse.json({ success: true, data: { session, orders: orders ?? [], shares: shares ?? [] } })
}
