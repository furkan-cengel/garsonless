import { processBillingMaintenanceBatch } from '@garsonless/application/billing-maintenance'
import {
  createBillingMaintenancePort,
  createSubscriptionBillingOperationsPort,
} from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../../../../lib/billing/iyzico-subscription-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
}).strict()

export async function POST(request: Request) {
  const expected = process.env['OUTBOX_WORKER_SECRET']
  if (!expected || request.headers.get('x-outbox-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid maintenance request' }, { status: 400 })

  const workerId = `billing-${crypto.randomUUID()}`
  try {
    const result = await processBillingMaintenanceBatch(
      { actor: 'platform-billing-worker', provider: 'iyzico', workerId },
      { limit: parsed.data.limit ?? 20 },
      createBillingMaintenancePort(),
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(readIyzicoSubscriptionProviderConfig()),
    )
    if (result.ok) return NextResponse.json({ workerId, ...result.value })
    console.error('[billing-maintenance]', { workerId, error: result.error })
    return NextResponse.json({ error: 'Billing maintenance failed' }, { status: 503 })
  } catch (cause) {
    console.error('[billing-maintenance]', { workerId }, cause)
    return NextResponse.json({ error: 'Billing maintenance unavailable' }, { status: 503 })
  }
}
