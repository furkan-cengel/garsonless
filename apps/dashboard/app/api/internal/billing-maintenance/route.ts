import { reconcileAddOnPurchase } from '@garsonless/application/add-on-purchases'
import { createAddOnPurchasePort } from '@garsonless/db/server'
import { createIyzicoAddOnProvider } from '../../../../lib/billing/iyzico-add-on-provider'
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
  const addOnMaintenance = async () => {
    const port = createAddOnPurchasePort()
    const provider = createIyzicoAddOnProvider()
    const purchases = await port.pending()
    const results = await Promise.allSettled(purchases.map(purchase => reconcileAddOnPurchase(purchase, port, provider)))
    return { checked: results.filter(result => result.status === 'fulfilled').length, failed: results.filter(result => result.status === 'rejected').length }
  }
  // Each queue runs even when the other provider integration is unavailable.
  const [subscriptionResult, addOnResult] = await Promise.allSettled([
    (async () => processBillingMaintenanceBatch(
      { actor: 'platform-billing-worker', provider: 'iyzico', workerId },
      { limit: parsed.data.limit ?? 20 },
      createBillingMaintenancePort(),
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(readIyzicoSubscriptionProviderConfig()),
    ))(),
    addOnMaintenance(),
  ])
  const addOns = addOnResult.status === 'fulfilled' ? addOnResult.value : { checked: 0, failed: 1 }
  if (subscriptionResult.status === 'fulfilled' && subscriptionResult.value.ok) {
    return NextResponse.json({ workerId, ...subscriptionResult.value.value, addOns }, { status: addOns.failed ? 503 : 200 })
  }
  console.error('[billing-maintenance]', { workerId, subscriptionFailed: true, addOns })
  return NextResponse.json({ workerId, error: 'Billing maintenance requires reconciliation', addOns }, { status: 503 })
}
