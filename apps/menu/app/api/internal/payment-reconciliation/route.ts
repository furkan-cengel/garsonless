import { randomUUID } from 'node:crypto'
import { processPaymentReconciliationBatch } from '@garsonless/application/payment-reconciliation'
import { settleOrder } from '@garsonless/application/orders'
import { settleProviderShare } from '@garsonless/application/splits'
import {
  createPaymentReconciliationPort,
  createSettlementPort,
  createSplitPaymentPort,
} from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ limit: z.number().int().min(1).max(100).optional() })

export async function POST(request: Request) {
  const expected = process.env['OUTBOX_WORKER_SECRET']
  if (!expected || request.headers.get('x-outbox-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const result = await processPaymentReconciliationBatch(
    { workerId: `menu-reconciliation-${randomUUID()}`, limit: parsed.data.limit },
    createPaymentReconciliationPort(),
    {
      recoverOrder: ({ restaurantId, orderId }) => settleOrder(
        { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
        { restaurantId, orderId, method: 'iyzico' },
        createSettlementPort(),
      ),
      recoverShare: ({ restaurantId, shareId }) => settleProviderShare(
        { actor: 'payment-provider', restaurantId, provider: 'iyzico' },
        { restaurantId, shareId },
        createSplitPaymentPort(),
      ),
    },
  )
  return result.ok
    ? NextResponse.json(result.value)
    : NextResponse.json({ error: result.error }, { status: 503 })
}
