import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient, resolveActiveTableQrToken } from '@garsonless/db/server'

const Query = z.object({
  orderId: z.string().uuid(),
  sessionId: z.string().uuid(),
  tableToken: z.string().uuid(),
})

export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid order credentials' }, { status: 400 })

  const table = await resolveActiveTableQrToken(parsed.data.tableToken)
  if (!table) return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 })
  const svc = createServiceClient()
  const { data: session } = await svc.from('table_sessions').select('id')
    .eq('id', parsed.data.sessionId).eq('restaurant_id', table.restaurantId).eq('table_id', table.tableId)
    .maybeSingle()
  if (!session) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
  const { data, error } = await svc
    .from('orders')
    .select('status, paid_at')
    .eq('id', parsed.data.orderId)
    .eq('session_id', parsed.data.sessionId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return NextResponse.json({ success: false, error: 'Order status unavailable' }, { status: 503 })
  if (!data) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ success: true, data })
}
