import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readPublicTableState } from '@garsonless/application/tables'
import { createPublicTableQueryPort } from '@garsonless/db/server'

const Query = z.object({
  token: z.string().uuid(),
})

export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid table credentials' }, { status: 400 })
  const result = await readPublicTableState(parsed.data.token, createPublicTableQueryPort())
  if (!result.ok) return NextResponse.json({ success: false, error: 'Table state unavailable' }, { status: 503 })
  if (!result.value) return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: {
    session: result.value.session,
    orders: result.value.orders,
    shares: result.value.shares,
  } })
}
