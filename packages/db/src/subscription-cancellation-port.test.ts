import assert from 'node:assert/strict'
import test from 'node:test'
import { createSubscriptionCancellationSchedulePort } from './subscription-cancellation-port'

const scheduled = {
  cancellationRequestId: 'cancel-request-1',
  subscriptionId: 'subscription-1',
  status: 'scheduled',
  effectiveAt: '2026-10-01T00:00:00.000Z',
  duplicate: false,
}

test('period-end cancellation port maps schedule and withdrawal RPC contracts', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createSubscriptionCancellationSchedulePort(async (name, args) => {
    calls.push({ name, args })
    return name === 'schedule_subscription_cancellation'
      ? { data: scheduled, error: null }
      : {
          data: {
            cancellationRequestId: 'cancel-request-1',
            subscriptionId: 'subscription-1',
            status: 'withdrawn',
            duplicate: true,
          },
          error: null,
        }
  })

  assert.deepEqual(await port.scheduleCancellation({
    restaurantId: 'restaurant-1',
    idempotencyKey: 'schedule-key',
    requestFingerprint: 'a'.repeat(64),
    requestedBy: 'owner-1',
    occurredAt: '2026-09-01T00:00:00.000Z',
  }), { ok: true, value: scheduled })
  assert.deepEqual(await port.withdrawCancellation({
    restaurantId: 'restaurant-1',
    cancellationRequestId: 'cancel-request-1',
    idempotencyKey: 'withdraw-key',
    requestFingerprint: 'b'.repeat(64),
    withdrawnBy: 'owner-1',
    occurredAt: '2026-09-02T00:00:00.000Z',
  }), {
    ok: true,
    value: {
      cancellationRequestId: 'cancel-request-1',
      subscriptionId: 'subscription-1',
      status: 'withdrawn',
      duplicate: true,
    },
  })
  assert.deepEqual(calls, [{
    name: 'schedule_subscription_cancellation',
    args: {
      p_restaurant_id: 'restaurant-1',
      p_idempotency_key: 'schedule-key',
      p_request_fingerprint: 'a'.repeat(64),
      p_requested_by: 'owner-1',
      p_occurred_at: '2026-09-01T00:00:00.000Z',
    },
  }, {
    name: 'withdraw_subscription_cancellation',
    args: {
      p_restaurant_id: 'restaurant-1',
      p_cancellation_request_id: 'cancel-request-1',
      p_idempotency_key: 'withdraw-key',
      p_request_fingerprint: 'b'.repeat(64),
      p_withdrawn_by: 'owner-1',
      p_occurred_at: '2026-09-02T00:00:00.000Z',
    },
  }])
})

test('period-end cancellation port rejects malformed results and hides RPC diagnostics', async () => {
  const malformed = createSubscriptionCancellationSchedulePort(async () => ({
    data: { ...scheduled, effectiveAt: 'not-a-date' },
    error: null,
  }))
  assert.deepEqual(await malformed.scheduleCancellation({
    restaurantId: 'restaurant-1', idempotencyKey: 'key', requestFingerprint: 'a'.repeat(64),
    requestedBy: 'owner-1', occurredAt: '2026-09-01T00:00:00.000Z',
  }), { ok: false, error: 'Billing cancellation schedule result is invalid' })

  const failed = createSubscriptionCancellationSchedulePort(async () => ({
    data: null, error: { message: 'provider secret diagnostic' },
  }))
  assert.deepEqual(await failed.withdrawCancellation({
    restaurantId: 'restaurant-1', cancellationRequestId: 'cancel-request-1',
    idempotencyKey: 'key', requestFingerprint: 'b'.repeat(64),
    withdrawnBy: 'owner-1', occurredAt: '2026-09-01T00:00:00.000Z',
  }), { ok: false, error: 'Billing cancellation could not be withdrawn' })
})
