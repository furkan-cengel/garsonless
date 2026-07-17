import assert from 'node:assert/strict'
import test from 'node:test'
import { processPaymentReconciliationBatch, type PaymentReconciliationPort } from './payment-reconciliation'

test('reconciliation resolves known aggregates and defers missing mappings', async () => {
  const resolved: string[] = []
  const failed: Array<{ id: string; delay: number }> = []
  const port: PaymentReconciliationPort = {
    async claim() {
      return { ok: true, value: [
        { id: 'a', restaurantId: 'r', orderId: 'o', shareId: null, eventType: 'order_settlement_failed', attempts: 1 },
        { id: 'b', restaurantId: null, orderId: null, shareId: null, eventType: 'order_mapping_missing', attempts: 1 },
      ] }
    },
    async resolve(input) { resolved.push(input.eventId); return { ok: true, value: true } },
    async fail(input) { failed.push({ id: input.eventId, delay: input.delaySeconds }); return { ok: true, value: 'retry_scheduled' } },
  }
  const result = await processPaymentReconciliationBatch({ workerId: 'worker' }, port, {
    async recoverOrder() { return { ok: true, value: null } },
    async recoverShare() { return { ok: true, value: null } },
  })
  assert.deepEqual(result, { ok: true, value: { claimed: 2, resolved: 1, retried: 1, deadLettered: 0, leaseLost: 0 } })
  assert.deepEqual(resolved, ['a'])
  assert.deepEqual(failed, [{ id: 'b', delay: 3600 }])
})
