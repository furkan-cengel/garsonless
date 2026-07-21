import { consumeDashboardInbox } from '@garsonless/application/notifications'
import { createDashboardInboxPort } from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ eventId: z.string().uuid() })

export async function POST(request: Request) {
  const expected = process.env['OUTBOX_WORKER_SECRET']
  if (!expected || request.headers.get('x-outbox-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })

  try {
    const result = await consumeDashboardInbox(parsed.data.eventId, createDashboardInboxPort())
    if (result.ok) return NextResponse.json(result.value)
    console.error('[dashboard-inbox-consumer]', { eventId: parsed.data.eventId, error: result.error })
    return NextResponse.json({ error: 'Dashboard inbox delivery failed' }, { status: 503 })
  } catch (cause) {
    console.error('[dashboard-inbox-consumer]', { eventId: parsed.data.eventId }, cause)
    return NextResponse.json({ error: 'Dashboard inbox delivery unavailable' }, { status: 503 })
  }
}
