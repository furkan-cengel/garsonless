import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCollectedOrderFilter } from './order-query-spec'

test('collected order PostgREST filter is generated from the domain policy', () => {
  const calls: string[] = []
  const query = {
    not(column: string, operator: string, value: unknown) {
      calls.push(`not:${column}:${operator}:${String(value)}`)
      return this
    },
    neq(column: string, value: string) {
      calls.push(`neq:${column}:${value}`)
      return this
    },
    or(filters: string) {
      calls.push(`or:${filters}`)
      return this
    },
  }

  assert.equal(applyCollectedOrderFilter(query), query)
  assert.deepEqual(calls, [
    'not:paid_at:is:null',
    'or:payment_method.is.null,payment_method.neq.comp',
  ])
})
