import { processDomainOutboxEvent } from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAuthorizedWorkerRequest } from '@garsonless/application/worker-secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ eventId: z.string().uuid() })

export async function POST(request: Request) {
  if (!isAuthorizedWorkerRequest(request.headers, process.env['OUTBOX_WORKER_SECRET'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })

  const result = await processDomainOutboxEvent(parsed.data.eventId)
  return result.ok
    ? NextResponse.json(result.value)
    : NextResponse.json({ error: result.error }, { status: 503 })
}
