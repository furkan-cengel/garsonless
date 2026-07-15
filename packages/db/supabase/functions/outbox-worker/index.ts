import { createClient } from 'npm:@supabase/supabase-js@2'

type OutboxEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
}

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

Deno.serve(async (req) => {
  const secret = required('OUTBOX_WORKER_SECRET')
  if (req.headers.get('x-outbox-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const worker = `edge-${crypto.randomUUID()}`
  const { data, error } = await supabase.rpc('claim_domain_outbox', {
    p_worker: worker,
    p_limit: 25,
    p_lease_seconds: 60,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let processed = 0
  let failed = 0
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
      const delay = Math.min(30 * 2 ** Math.min(6, event.attempts), 3600)
      await supabase.rpc('fail_domain_outbox', {
        p_event_id: event.id,
        p_worker: worker,
        p_error: message,
        p_delay_seconds: delay,
      })
    }
  }

  return Response.json({ claimed: (data ?? []).length, processed, failed })
})
