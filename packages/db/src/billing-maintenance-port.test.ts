import assert from 'node:assert/strict'
import test from 'node:test'
import { createBillingMaintenancePort, type BillingMaintenanceRpc } from './billing-maintenance-port'

test('billing maintenance adapter validates claimed dunning and reconciliation rows', async () => {
  const calls: string[] = []
  const rpc: BillingMaintenanceRpc = async (name) => {
    calls.push(name)
    if (name === 'claim_billing_dunning') return { data: [{
      run_id: 'run-1', restaurant_id: 'r1', subscription_id: 's1', invoice_id: 'i1',
      step: 'retry',
    }], error: null }
    if (name === 'claim_billing_reconciliation') return { data: [{
      job_id: 'job-1', restaurant_id: null, subscription_id: null, scope: 'provider_event',
    }], error: null }
    return { data: true, error: null }
  }
  const port = createBillingMaintenancePort(rpc)
  const dunning = await port.claimDunning({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  const reconciliation = await port.claimReconciliation({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  assert.ok(dunning.ok)
  assert.equal(dunning.value[0]!.invoiceId, 'i1')
  assert.ok(reconciliation.ok)
  assert.equal(reconciliation.value[0]!.restaurantId, null)
  assert.deepEqual(calls, ['claim_billing_dunning', 'claim_billing_reconciliation'])
})

test('billing maintenance adapter rejects malformed RPC projections', async () => {
  const rpc: BillingMaintenanceRpc = async () => ({ data: [{ step: 'unknown' }], error: null })
  const result = await createBillingMaintenancePort(rpc).claimDunning({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  assert.deepEqual(result, { ok: false, error: 'Billing dunning claim result is invalid' })
})
