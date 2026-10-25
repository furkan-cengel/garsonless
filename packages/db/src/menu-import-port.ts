import type { MenuImportJob, MenuImportMime } from '@garsonless/application/menu-import'
import { createServiceClient } from './service-client'

export async function enqueueMenuImport(input: {
  restaurantId: string; actorId: string; id: string; filename: string
  mime: MenuImportMime; base64: string; hash: string
}): Promise<{ job: MenuImportJob | null; error: string | null }> {
  const client = createServiceClient()
  const rpc = client.rpc.bind(client) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc('enqueue_menu_import', {
    p_restaurant: input.restaurantId, p_actor: input.actorId, p_id: input.id,
    p_filename: input.filename, p_mime: input.mime, p_source: input.base64, p_hash: input.hash,
  })
  const allowed = ['quota_exceeded', 'active_job_exists', 'request_mismatch']
  if (!error) {
    // Read now instead of waiting for the next cron minute; same Vault endpoint and secret as the schedule.
    try { await rpc('invoke_menu_import_worker', {}) } catch { /* the scheduled run still picks it up */ }
  }
  return { job: error ? null : data as MenuImportJob, error: error ? allowed.find(code => error.message === code) ?? 'unavailable' : null }
}
