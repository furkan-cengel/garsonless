import assert from 'node:assert/strict'
import test from 'node:test'
import type { ClaimedFiscalDocument } from '@garsonless/db/server'
import { planFiscalEvent, syncFiscalDocument } from './fiscal-sync'
import { bearerMatches } from './fiscal-secret'
import { TokenxError } from './tokenx-client'

const doc = (patch: Partial<ClaimedFiscalDocument> = {}): ClaimedFiscalDocument => ({
  id: 'd1', restaurantId: 'r', basketId: 'b1', revision: 2, attempts: 1, syncedRevision: 1,
  settings: { enabled: true, branchId: 'br', terminalId: 'AV1', sections: [{ sectionNo: 1, name: 'Yiyecek', taxPercent: 1000 }], sectionOverrides: {} },
  session: { id: 's', closed: false, tableLabel: 'Masa 3', areaLabel: 'Bahçe' },
  orders: [{ id: 'o1', total: 150, lines: [{ name: 'Pizza', price: 150, quantity: 1, vatRate: 10 }] }],
  ...patch,
})

function fakeClient(fail?: TokenxError) {
  const calls: string[] = []
  return {
    calls,
    async putBasket(branchId: string, basketId: string, basket: { total: number }, meta: { title: string; filter: string | null }) {
      calls.push(`put ${branchId} ${basketId} ${basket.total} ${meta.title}/${meta.filter}`)
      if (fail) throw fail
      return 'created' as const
    },
    async deleteBasket(basketId: string) {
      calls.push(`delete ${basketId}`)
      if (fail) throw fail
    },
  }
}

test('an open bill is sent with the table and area and the orders it covered', async () => {
  const client = fakeClient()
  assert.deepEqual(await syncFiscalDocument(doc(), client), { outcome: 'synced', error: null, orderIds: ['o1'] })
  assert.deepEqual(client.calls, ['put br b1 15000 Masa 3/Bahçe'])
})

test('a closed, emptied or switched-off bill removes its basket; one never sent needs no call', async () => {
  for (const patch of [{ session: { id: 's', closed: true, tableLabel: 'M', areaLabel: null } }, { orders: [] }, { settings: { ...doc().settings, enabled: false } }]) {
    const client = fakeClient()
    assert.equal((await syncFiscalDocument(doc(patch), client)).outcome, 'deleted')
    assert.deepEqual(client.calls, ['delete b1'])
  }
  const fresh = fakeClient()
  assert.equal((await syncFiscalDocument(doc({ orders: [], syncedRevision: 0 }), fresh)).outcome, 'deleted')
  assert.deepEqual(fresh.calls, [])
})

test('a bill with a VAT rate the device lacks is held with a reason, not sent', async () => {
  const client = fakeClient()
  const result = await syncFiscalDocument(doc({ orders: [{ id: 'o1', total: 10, lines: [{ name: 'Rakı', price: 10, quantity: 1, vatRate: 20 }] }] }), client)
  assert.deepEqual(result, { outcome: 'held', error: 'Yazarkasada bu KDV oranına ait bölüm yok: %20', orderIds: [] })
  assert.deepEqual(client.calls, [])
})

test('outages are retried; rejected data is not', async () => {
  assert.equal((await syncFiscalDocument(doc(), fakeClient(new TokenxError('NETWORK', true)))).outcome, 'retry')
  assert.deepEqual(await syncFiscalDocument(doc(), fakeClient(new TokenxError('1103', false))), { outcome: 'failed', error: 'TokenX 1103', orderIds: [] })
})

test('a device payment settles the orders it was sent; replays and other events only record', () => {
  const completed = { kind: 'completed' as const, basketId: 'b1', terminalId: 'AV1', receiptNo: '1', zNo: '1', payments: [{ type: 3, amount: 15000, description: null, operatorId: null }] }
  assert.deepEqual(planFiscalEvent(completed, { status: 'synced', orders: [{ id: 'o1', total: 150 }] }), { kind: 'settle', allocations: [{ orderId: 'o1', method: 'pos' }] })
  assert.deepEqual(planFiscalEvent(completed, { status: 'completed', orders: [] }), { kind: 'ignore' })
  assert.deepEqual(planFiscalEvent(completed, null), { kind: 'ignore' })
  assert.deepEqual(planFiscalEvent({ kind: 'voided', basketId: 'b1' }, null), { kind: 'record', event: 'voided' })
})

test('webhook and worker secrets must match exactly and be long enough', () => {
  const secret = 's'.repeat(40)
  assert.equal(bearerMatches(`Bearer ${secret}`, secret), true)
  assert.equal(bearerMatches(`Bearer ${secret}x`, secret), false)
  assert.equal(bearerMatches(null, secret), false)
  assert.equal(bearerMatches('Bearer short', 'short'), false)
})
