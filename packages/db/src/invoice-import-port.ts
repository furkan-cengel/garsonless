import type { InvoiceImportJob, InvoiceImportMime } from '@garsonless/application/invoice-import'
import { createServiceClient } from './service-client'

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
const rpcFor = () => {
  const client = createServiceClient()
  return client.rpc.bind(client) as unknown as Rpc
}

/** Queues an invoice for reading; the caller has checked inventory access and the plan. */
export async function enqueueInvoiceRead(input: {
  restaurantId: string; actorId: string; id: string; mime: InvoiceImportMime; base64: string; hash: string
}): Promise<{ job: InvoiceImportJob | null; error: string | null }> {
  const rpc = rpcFor()
  const { data, error } = await rpc('enqueue_invoice_read', {
    p_restaurant: input.restaurantId, p_actor: input.actorId, p_id: input.id,
    p_mime: input.mime, p_source: input.base64, p_hash: input.hash,
  })
  if (!error) {
    // Read now instead of waiting for the next cron minute; the menu worker also reads invoices.
    try { await rpc('invoke_menu_import_worker', {}) } catch { /* the scheduled run still picks it up */ }
  }
  const allowed = ['quota_exceeded', 'request_mismatch', 'forbidden']
  return { job: error ? null : data as InvoiceImportJob, error: error ? allowed.find((code) => error.message === code) ?? 'unavailable' : null }
}

export async function readInvoiceRead(input: { restaurantId: string; actorId: string; id: string }): Promise<{ job: InvoiceImportJob | null; error: string | null }> {
  const { data, error } = await rpcFor()('read_invoice_read', { p_restaurant: input.restaurantId, p_actor: input.actorId, p_id: input.id })
  return { job: error ? null : data as InvoiceImportJob, error: error ? (['not_found', 'forbidden'].includes(error.message) ? error.message : 'unavailable') : null }
}
