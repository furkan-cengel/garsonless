import type {
  PaymentReconciliationEvent,
  PaymentReconciliationEventType,
  PaymentReconciliationPort,
} from '@garsonless/application/payment-reconciliation'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

function rpc(): Rpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as Rpc
}

type ReconciliationRow = {
  id: string
  restaurant_id: string | null
  order_id: string | null
  share_id: string | null
  event_type: PaymentReconciliationEventType
  attempts: number
}

export async function recordPaymentReconciliation(input: {
  restaurantId?: string | null
  orderId?: string | null
  shareId?: string | null
  providerTokenHash: string
  eventType: PaymentReconciliationEventType
  detail?: Record<string, unknown>
}): Promise<Result<{ eventId: string }>> {
  const { data, error } = await rpc()('enqueue_payment_reconciliation', {
    p_restaurant_id: input.restaurantId ?? null,
    p_order_id: input.orderId ?? null,
    p_share_id: input.shareId ?? null,
    p_provider_token_hash: input.providerTokenHash,
    p_event_type: input.eventType,
    p_detail: input.detail ?? {},
  })
  return error || typeof data !== 'string'
    ? err(error?.message ?? 'Reconciliation event kaydedilemedi')
    : ok({ eventId: data })
}

export function createPaymentReconciliationPort(): PaymentReconciliationPort {
  return {
    async claim(input) {
      const { data, error } = await rpc()('claim_payment_reconciliation', {
        p_worker: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
      })
      if (error) return err(error.message)
      const rows = Array.isArray(data) ? data as ReconciliationRow[] : []
      const events: PaymentReconciliationEvent[] = rows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        orderId: row.order_id,
        shareId: row.share_id,
        eventType: row.event_type,
        attempts: row.attempts,
      }))
      return ok(events)
    },
    async resolve(input) {
      const { data, error } = await rpc()('resolve_payment_reconciliation', {
        p_event_id: input.eventId,
        p_worker: input.workerId,
      })
      if (error) return err(error.message)
      return data === true ? ok(true) : err('Reconciliation lease lost')
    },
    async fail(input) {
      const { data, error } = await rpc()('fail_payment_reconciliation', {
        p_event_id: input.eventId,
        p_worker: input.workerId,
        p_error: input.error,
        p_delay_seconds: input.delaySeconds,
      })
      if (error) return err(error.message)
      return data === 'retry_scheduled' || data === 'dead_lettered' || data === 'lease_lost'
        ? ok(data)
        : err('Reconciliation failure state is invalid')
    },
  }
}
