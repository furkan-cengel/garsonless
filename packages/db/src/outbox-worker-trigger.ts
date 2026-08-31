import { createServiceClient } from './service-client'

/**
 * Best-effort fast path for newly queued domain events.
 *
 * The scheduled outbox worker remains the durability backstop. A failure here
 * must never turn a successfully committed guest action into an API error.
 */
export async function triggerDomainOutboxWorker(): Promise<void> {
  const { error } = await createServiceClient().rpc('invoke_domain_outbox_worker')
  if (error) console.error(`[triggerDomainOutboxWorker] ${error.message}`)
}
