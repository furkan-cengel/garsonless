import assert from 'node:assert/strict'
import test from 'node:test'
import { updateOrderStatusDB } from './orders-update'

test('repository rejects payment, cancellation and entry states before opening a service client', async () => {
  for (const status of ['paid', 'cancelled', 'pending', 'pending_approval']) {
    assert.deepEqual(
      await updateOrderStatusDB('order', status as never, 'restaurant'),
      { error: 'Use the dedicated cancellation or settlement command' },
    )
  }
})
