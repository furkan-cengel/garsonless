import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readPublicTableOrderStatus } from '@garsonless/application/tables'
import { createPublicTableQueryPort } from '@garsonless/db/server'

const Query = z.object({
  orderId: z.string().uuid(),
  sessionId: z.string().uuid(),
  tableToken: z.string().uuid(),
})

export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid order credentials' }, { status: 400 })

  const result = await readPublicTableOrderStatus({
    token: parsed.data.tableToken,
    sessionId: parsed.data.sessionId,
    orderId: parsed.data.orderId,
  }, createPublicTableQueryPort())
  if (!result.ok) return NextResponse.json({ success: false, error: 'Order status unavailable' }, { status: 503 })
  if (!result.value) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: result.value })
}
