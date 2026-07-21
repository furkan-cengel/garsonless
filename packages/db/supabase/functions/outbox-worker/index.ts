import { createClient } from 'npm:@supabase/supabase-js@2'

type OutboxEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
}

type FailResult = 'retry_scheduled' | 'dead_lettered' | 'lease_lost'

const durableConsumer = (eventType: string): 'loyalty-ledger' | 'campaign-sms' | null => {
  if (eventType === 'campaign.delivery_requested') return 'campaign-sms'
  if ([
    'order.status_changed',
    'order.settled',
    'table_session.closed',
    'customer.welcome_bonus_requested',
  ].includes(eventType)) return 'loyalty-ledger'
  return null
}

const isDashboardPushEvent = (eventType: string) => [
  'order.created',
  'service_request.created',
].includes(eventType)

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
  let deferred = 0
  let pushDispatched = 0
  let pushSkipped = 0
  let pushUnconfigured = 0
  for (const event of (data ?? []) as OutboxEvent[]) {
    try {
      const consumer = durableConsumer(event.event_type)
      if (consumer) {
        const receipt = await supabase
          .from('domain_outbox_receipts')
          .select('outbox_id')
          .eq('outbox_id', event.id)
          .eq('consumer', consumer)
          .maybeSingle()
        if (receipt.error) throw receipt.error

        if (!receipt.data) {
          const consumerUrl = Deno.env.get('OUTBOX_CONSUMER_URL')
          if (!consumerUrl) {
            const release = await supabase.rpc('defer_domain_outbox', {
              p_event_id: event.id,
              p_worker: worker,
              p_reason: `OUTBOX_CONSUMER_URL is not configured for ${consumer}`,
              p_delay_seconds: 3600,
            })
            if (release.error || release.data !== true) {
              throw release.error ?? new Error('Outbox lease was lost before deferral')
            }
            deferred += 1
            continue
          }
          const response = await fetch(consumerUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-outbox-secret': secret,
            },
            body: JSON.stringify({ eventId: event.id }),
          })
          if (!response.ok) {
            const detail = await response.text().catch(() => '')
            throw new Error(`Domain consumer ${consumer} failed (${response.status}): ${detail.slice(0, 300)}`)
          }
        }
      }

      // Web Push is a second, independent fan-out consumer. Its endpoint owns
      // per-subscription receipts, entitlement checks and provider retries;
      // the generic worker only dispatches the outbox event. Missing rollout
      // configuration is observable but does not block core order processing.
      if (isDashboardPushEvent(event.event_type)) {
        const pushReceipt = await supabase
          .from('domain_outbox_receipts')
          .select('outbox_id')
          .eq('outbox_id', event.id)
          .eq('consumer', 'dashboard-push')
          .maybeSingle()
        if (pushReceipt.error) throw pushReceipt.error

        if (pushReceipt.data) {
          pushSkipped += 1
        } else {
          const pushUrl = Deno.env.get('OUTBOX_PUSH_CONSUMER_URL')
          if (!pushUrl) {
            pushUnconfigured += 1
          } else {
            const response = await fetch(pushUrl, {
              method: 'POST',
              signal: AbortSignal.timeout(45_000),
              headers: {
                'content-type': 'application/json',
                'x-outbox-secret': secret,
              },
              body: JSON.stringify({ eventId: event.id }),
            })
            if (!response.ok) {
              const detail = await response.text().catch(() => '')
              throw new Error(`Dashboard push consumer failed (${response.status}): ${detail.slice(0, 300)}`)
            }
            pushDispatched += 1
          }
        }
      }

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

  // Provider-success/local-write failures use a separate recovery queue. The
  // scheduled edge invocation also kicks that queue, while the application
  // endpoint owns settlement commands and keeps provider semantics out of the
  // generic outbox worker. Missing configuration is observable but does not
  // interfere with domain-event delivery.
  let reconciliation: Record<string, unknown> = { configured: false }
  const reconciliationUrl = Deno.env.get('PAYMENT_RECONCILIATION_URL')
  if (reconciliationUrl) {
    try {
      const response = await fetch(reconciliationUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-outbox-secret': secret,
        },
        body: JSON.stringify({ limit: 20 }),
      })
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>
      reconciliation = response.ok
        ? { configured: true, ...payload }
        : { configured: true, error: `HTTP ${response.status}`, detail: payload }
    } catch (cause) {
      reconciliation = {
        configured: true,
        error: cause instanceof Error ? cause.message : 'Reconciliation worker failed',
      }
    }
  }

  return Response.json({
    claimed: (data ?? []).length,
    processed,
    failed,
    retryScheduled,
    deadLettered,
    leaseLost,
    deferred,
    pushDispatched,
    pushSkipped,
    pushUnconfigured,
    reconciliation,
  })
})
