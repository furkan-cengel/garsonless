import { consumeDashboardPush } from '@garsonless/application/push-notifications'
import { createDashboardPushPort } from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createWebPushProvider } from '../../../../lib/web-push-provider'

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
    const result = await consumeDashboardPush(
      parsed.data.eventId,
      createDashboardPushPort(),
      createWebPushProvider(),
    )
    if (result.ok) return NextResponse.json(result.value)
    console.error('[dashboard-push-consumer]', { eventId: parsed.data.eventId, error: result.error })
    return NextResponse.json({ error: 'Dashboard push delivery failed' }, { status: 503 })
  } catch (cause) {
    console.error('[dashboard-push-consumer]', { eventId: parsed.data.eventId }, cause)
    return NextResponse.json({ error: 'Dashboard push delivery unavailable' }, { status: 503 })
  }
}
