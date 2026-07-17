import type { Result } from '@garsonless/domain'
import { err, ok } from '@garsonless/domain'

export type PaymentReconciliationEventType =
  | 'order_settlement_failed'
  | 'share_settlement_failed'
  | 'order_mapping_missing'

export interface PaymentReconciliationEvent {
  id: string
  restaurantId: string | null
  orderId: string | null
  shareId: string | null
  eventType: PaymentReconciliationEventType
  attempts: number
}

export interface PaymentReconciliationPort {
  claim(input: { workerId: string; limit: number; leaseSeconds: number }): Promise<Result<PaymentReconciliationEvent[]>>
  resolve(input: { eventId: string; workerId: string }): Promise<Result<true>>
  fail(input: { eventId: string; workerId: string; error: string; delaySeconds: number }): Promise<Result<'retry_scheduled' | 'dead_lettered' | 'lease_lost'>>
}

export interface PaymentRecoveryHandlers {
  recoverOrder(input: { restaurantId: string; orderId: string }): Promise<Result<unknown>>
  recoverShare(input: { restaurantId: string; shareId: string }): Promise<Result<unknown>>
}

export interface PaymentReconciliationBatchResult {
  claimed: number
  resolved: number
  retried: number
  deadLettered: number
  leaseLost: number
}

/** Retries only provider-success events whose local aggregate is known. A
 * mapping-missing event intentionally remains observable for manual recovery:
 * the raw provider token is never stored in the queue. */
export async function processPaymentReconciliationBatch(
  input: { workerId: string; limit?: number },
  port: PaymentReconciliationPort,
  handlers: PaymentRecoveryHandlers,
): Promise<Result<PaymentReconciliationBatchResult>> {
  if (!input.workerId.trim()) return err('Worker id is required')
  const claimed = await port.claim({ workerId: input.workerId, limit: input.limit ?? 20, leaseSeconds: 60 })
  if (!claimed.ok) return claimed

  const summary: PaymentReconciliationBatchResult = {
    claimed: claimed.value.length,
    resolved: 0,
    retried: 0,
    deadLettered: 0,
    leaseLost: 0,
  }
  for (const event of claimed.value) {
    let recovery: Result<unknown>
    if (event.eventType === 'order_settlement_failed' && event.restaurantId && event.orderId) {
      recovery = await handlers.recoverOrder({ restaurantId: event.restaurantId, orderId: event.orderId })
    } else if (event.eventType === 'share_settlement_failed' && event.restaurantId && event.shareId) {
      recovery = await handlers.recoverShare({ restaurantId: event.restaurantId, shareId: event.shareId })
    } else {
      recovery = err('Provider token mapping requires manual reconciliation')
    }

    if (recovery.ok) {
      const resolved = await port.resolve({ eventId: event.id, workerId: input.workerId })
      if (!resolved.ok) return resolved
      summary.resolved += 1
      continue
    }
    const failed = await port.fail({
      eventId: event.id,
      workerId: input.workerId,
      error: recovery.error,
      delaySeconds: event.eventType === 'order_mapping_missing' ? 3600 : Math.min(3600, 30 * 2 ** Math.min(event.attempts, 6)),
    })
    if (!failed.ok) return failed
    if (failed.value === 'retry_scheduled') summary.retried += 1
    else if (failed.value === 'dead_lettered') summary.deadLettered += 1
    else summary.leaseLost += 1
  }
  return ok(summary)
}
