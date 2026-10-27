import { createClient } from 'npm:@supabase/supabase-js@2'
import { extractMenuImport, MenuImportProviderError } from '../_shared/menu-import.ts'
import { extractInvoiceImport, InvoiceImportProviderError } from '../_shared/invoice-import.ts'
import { workerSecretMatches } from '../_shared/worker-secret.ts'

// One worker reads both queues: printed menus and purchase invoices. They share the
// provider key, the Vault endpoint and the schedule; a failure in one never blocks the other.
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST' || !(await workerSecretMatches(request.headers.get('x-menu-import-secret'), Deno.env.get('MENU_IMPORT_WORKER_SECRET')))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return Response.json({ error: 'provider_not_configured' }, { status: 503 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const failureCode = (error: unknown, known: new (message?: string) => Error) => error instanceof known ? error.message : error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'provider_unavailable'
  let processed = 0
  let unavailable = false

  const { data: job, error } = await db.rpc('claim_menu_import')
  if (error) unavailable = true
  else if (job) {
    let rows = null, failure = null
    try { rows = await extractMenuImport({ mime: job.mime, base64: job.base64 }, key) }
    catch (cause) { failure = failureCode(cause, MenuImportProviderError) }
    const { data: saved, error: finishError } = await db.rpc('finish_menu_import', { p_job: job.id, p_lease: job.lease, p_rows: rows, p_error: failure })
    if (finishError) unavailable = true
    else if (saved) processed += 1
  }

  const { data: invoiceJob, error: invoiceError } = await db.rpc('claim_invoice_read')
  if (invoiceError) unavailable = true
  else if (invoiceJob) {
    let result = null, failure = null
    try { result = await extractInvoiceImport({ mime: invoiceJob.mime, base64: invoiceJob.base64 }, key) }
    catch (cause) { failure = failureCode(cause, InvoiceImportProviderError) }
    const { data: saved, error: finishError } = await db.rpc('finish_invoice_read', { p_job: invoiceJob.id, p_lease: invoiceJob.lease, p_result: result, p_error: failure })
    if (finishError) unavailable = true
    else if (saved) processed += 1
  }

  return Response.json({ processed, error: unavailable ? 'queue_unavailable' : null }, { status: unavailable && processed === 0 ? 503 : 200 })
})
