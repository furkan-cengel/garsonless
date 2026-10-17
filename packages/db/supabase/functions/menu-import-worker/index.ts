import { createClient } from 'npm:@supabase/supabase-js@2'
import { extractMenuImport, MenuImportProviderError } from '../_shared/menu-import.ts'
import { workerSecretMatches } from '../_shared/worker-secret.ts'

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST' || !(await workerSecretMatches(request.headers.get('x-menu-import-secret'), Deno.env.get('MENU_IMPORT_WORKER_SECRET')))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return Response.json({ error: 'provider_not_configured' }, { status: 503 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: job, error } = await db.rpc('claim_menu_import')
  if (error) return Response.json({ error: 'queue_unavailable' }, { status: 503 })
  if (!job) return Response.json({ processed: 0 })
  let rows = null, failure = null
  try { rows = await extractMenuImport({ mime: job.mime, base64: job.base64 }, key) }
  catch (error) { failure = error instanceof MenuImportProviderError ? error.message : error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'provider_unavailable' }
  const { data: saved, error: finishError } = await db.rpc('finish_menu_import', { p_job: job.id, p_lease: job.lease, p_rows: rows, p_error: failure })
  return Response.json({ processed: saved ? 1 : 0, error: finishError ? 'completion_unavailable' : null }, { status: finishError ? 503 : 200 })
})
