import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type SubscriptionInvoiceDocumentLookup =
  | { status: 'not_found' }
  | { status: 'not_ready' }
  | { status: 'ready'; providerDocumentRef: string; fiscalDocumentType: 'e_fatura' | 'e_arsiv' }

export type SubscriptionInvoiceDocumentRpc = (
  name: 'read_subscription_invoice_document' | 'read_add_on_invoice_document',
  args: { p_restaurant_id: string; p_invoice_id: string },
) => Promise<{ data: unknown; error: { message: string } | null }>

function serviceRpc(): SubscriptionInvoiceDocumentRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as SubscriptionInvoiceDocumentRpc
}

function parse(value: unknown): SubscriptionInvoiceDocumentLookup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.status === 'not_found' || row.status === 'not_ready') return { status: row.status }
  if (row.status !== 'ready'
    || typeof row.providerDocumentRef !== 'string' || !row.providerDocumentRef.trim()
    || !['e_fatura', 'e_arsiv'].includes(String(row.fiscalDocumentType))) return null
  return {
    status: 'ready',
    providerDocumentRef: row.providerDocumentRef,
    fiscalDocumentType: row.fiscalDocumentType as 'e_fatura' | 'e_arsiv',
  }
}

export function createSubscriptionInvoiceDocumentReadPort(
  rpc: SubscriptionInvoiceDocumentRpc = serviceRpc(),
  source: 'subscription' | 'add_on' = 'subscription',
) {
  return {
    async read(input: { restaurantId: string; invoiceId: string }): Promise<Result<SubscriptionInvoiceDocumentLookup>> {
      const { data, error } = await rpc(source === 'add_on' ? 'read_add_on_invoice_document' : 'read_subscription_invoice_document', {
        p_restaurant_id: input.restaurantId,
        p_invoice_id: input.invoiceId,
      })
      if (error) return err('Invoice document could not be loaded')
      const lookup = parse(data)
      return lookup ? ok(lookup) : err('Invoice document response is invalid')
    },
  }
}
