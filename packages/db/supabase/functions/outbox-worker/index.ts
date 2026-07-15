import { createClient } from 'npm:@supabase/supabase-js@2'

type OutboxEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
}

type FailResult = 'retry_scheduled' | 'dead_lettered' | 'lease_lost'

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

Deno.serve(async (req) => {
  const secret = required('OUTBOX_WORKER_SECRET')
  if (req.headers.get('x-outbox-secret') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const worker = `edge-${crypto.randomUUID()}`

  if (req.method === 'GET') {
    const health = await supabase.rpc('get_domain_outbox_health')
    if (health.error) return Response.json({ error: health.error.message }, { status: 500 })
    return Response.json({ worker: 'outbox-worker', health: health.data?.[0] ?? null })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, POST' } })
  }

  const { data, error } = await supabase.rpc('claim_domain_outbox', {
    p_worker: worker,
    p_limit: 25,
    p_lease_seconds: 60,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let processed = 0
  let failed = 0
  let retryScheduled = 0
  let deadLettered = 0
  let leaseLost = 0
  for (const event of (data ?? []) as OutboxEvent[]) {
    try {
      // This is the first idempotent operational projection. Realtime and the
      // dashboard's analytics remain source-of-truth reads today; separate
      // notification/KDS/analytics consumers can be added without changing
      // the event transaction or claim semantics.
      const receipt = await supabase.from('domain_outbox_receipts').upsert(
        { outbox_id: event.id, consumer: 'operational-projection' },
        { onConflict: 'outbox_id,consumer', ignoreDuplicates: true },
      )
      if (receipt.error) throw receipt.error

      const ack = await supabase.rpc('ack_domain_outbox', { p_event_id: event.id, p_worker: worker })
      if (ack.error || ack.data !== true) throw ack.error ?? new Error('Outbox lease was lost before acknowledgement')
      processed += 1
    } catch (cause) {
      failed += 1
      const message = cause instanceof Error ? cause.message : 'Unknown outbox consumer failure'
      const delay = Math.min(30 * 2 ** Math.min(6, Math.max(0, event.attempts - 1)), 3600)
      const failure = await supabase.rpc('fail_domain_outbox', {
        p_event_id: event.id,
        p_worker: worker,
        p_error: message,
        p_delay_seconds: delay,
      })
      if (failure.error) {
        leaseLost += 1
        console.error('Failed to release outbox event', event.id, failure.error.message)
        continue
      }
      const result = failure.data as FailResult
      if (result === 'dead_lettered') deadLettered += 1
      else if (result === 'retry_scheduled') retryScheduled += 1
      else leaseLost += 1
    }
  }

  return Response.json({
    claimed: (data ?? []).length,
    processed,
    failed,
    retryScheduled,
    deadLettered,
    leaseLost,
  })
})
