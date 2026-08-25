import type {
  SubscriptionBillingWebhookInboxPort,
  SubscriptionBillingWebhookInboxResult,
  VerifiedSubscriptionBillingEvent,
} from '@garsonless/application/billing'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type SubscriptionBillingWebhookRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>

function serviceRpc(): SubscriptionBillingWebhookRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as SubscriptionBillingWebhookRpc
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseInboxResult(value: unknown): Result<SubscriptionBillingWebhookInboxResult> {
  const row = object(value)
  const providerEventId = nullableString(row?.providerEventId)
  const restaurantId = nullableString(row?.restaurantId)
  const subscriptionId = nullableString(row?.subscriptionId)
  const invoiceId = nullableString(row?.invoiceId)
  const currency = row?.currency
  const amountMinor = row?.amountMinor
  if (!row || !providerEventId || restaurantId === undefined || subscriptionId === undefined
    || invoiceId === undefined || typeof row.duplicate !== 'boolean'
    || typeof row.dispatchable !== 'boolean' || typeof row.alreadyProcessed !== 'boolean') {
    return err('Billing provider inbox RPC result is invalid')
  }
  if ((invoiceId === null && (amountMinor !== null || currency !== null))
    || (invoiceId !== null && (typeof amountMinor !== 'number'
      || !Number.isSafeInteger(amountMinor) || amountMinor < 0 || currency !== 'TRY'))) {
    return err('Billing provider inbox amount result is invalid')
  }
  return ok({
    providerEventId,
    restaurantId,
    subscriptionId,
    invoiceId,
    amount: invoiceId === null ? null : { minor: amountMinor as number, currency: 'TRY' },
    duplicate: row.duplicate,
    dispatchable: row.dispatchable,
    alreadyProcessed: row.alreadyProcessed,
  })
}

function webhookArgs(event: VerifiedSubscriptionBillingEvent): Record<string, unknown> {
  return {
    p_provider_event_id: event.eventId,
    p_event_type: event.type,
    p_provider_customer_ref: event.providerCustomerRef,
    p_provider_subscription_ref: event.providerSubscriptionRef,
    p_provider_invoice_ref: event.providerInvoiceRef,
    p_payload_sanitized: event.sanitizedPayload,
    p_payload_hash: event.payloadHash,
  }
}

/** Service-role-only durable inbox for already signature-verified provider
 * events. The RPC resolves tenant/invoice references atomically. */
export function createSubscriptionBillingWebhookInboxPort(
  rpc: SubscriptionBillingWebhookRpc = serviceRpc(),
): SubscriptionBillingWebhookInboxPort {
  return {
    async ingest(event) {
      const { data, error } = await rpc(
        'ingest_subscription_billing_provider_event',
        webhookArgs(event),
      )
      return error ? err(error.message) : parseInboxResult(data)
    },
    async markFailed(input) {
      const { data, error } = await rpc(
        'mark_subscription_billing_provider_event_failed',
        {
          p_provider_event_id: input.providerEventId,
          p_reason: input.reason.slice(0, 1000),
          p_provider_snapshot_sanitized: input.sanitizedPayload,
        },
      )
      return error ? err(error.message) : data === true ? ok(true) : err('Billing provider inbox failure result is invalid')
    },
  }
}
