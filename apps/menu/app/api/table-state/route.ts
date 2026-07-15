import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readPublicTableState } from '@garsonless/db/server'

const Query = z.object({
  token: z.string().uuid(),
})

export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid table credentials' }, { status: 400 })
  try {
    const state = await readPublicTableState(parsed.data.token)
    if (!state) return NextResponse.json({ success: false, error: 'Table not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: { session: state.session, orders: state.orders, shares: state.shares } })
  } catch {
    return NextResponse.json({ success: false, error: 'Table state unavailable' }, { status: 503 })
  }
}
