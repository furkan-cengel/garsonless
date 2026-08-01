import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyticsQueryToSearchParams,
  parseAnalyticsQuery,
  validateAnalyticsQuery,
} from '../../lib/analytics-filter-contract'

test('analytics query parser allow-lists presets and AND filters', () => {
  assert.deepEqual(parseAnalyticsQuery({
    range: 'calendar_month',
    source: 'customer',
    payment: 'iyzico',
    status: 'served',
  }), {
    range: 'calendar_month',
    from: null,
    to: null,
    filters: { source: 'customer', paymentMethod: 'iyzico', status: 'served' },
  })
})

test('custom range is inclusive, ordered and bounded to 366 days', () => {
  const valid = parseAnalyticsQuery({ range: 'custom', from: '2026-07-01', to: '2026-07-30' })
  assert.equal(valid.range, 'custom')
  assert.equal(valid.from, '2026-07-01')
  assert.equal(valid.to, '2026-07-30')
  assert.equal(parseAnalyticsQuery({ range: 'custom', from: '2026-07-30', to: '2026-07-01' }).range, 'week')
  assert.equal(parseAnalyticsQuery({ range: 'custom', from: '2025-01-01', to: '2026-07-30' }).range, 'week')
})

test('analytics query URL omits defaults and round-trips custom filters', () => {
  const query = parseAnalyticsQuery({
    range: 'custom', from: '2026-07-01', to: '2026-07-30', source: 'staff', payment: 'cash', status: 'ready',
  })
  const params = analyticsQueryToSearchParams(query, 'payments')
  assert.equal(params.toString(), 'report=payments&range=custom&from=2026-07-01&to=2026-07-30&source=staff&payment=cash&status=ready')
  assert.deepEqual(parseAnalyticsQuery(params), query)
})

test('malformed query values fail closed to the default scope', () => {
  assert.deepEqual(parseAnalyticsQuery({ range: 'forever', source: 'provider', payment: 'crypto', status: 'deleted' }), {
    range: 'week',
    from: null,
    to: null,
    filters: { source: 'all', paymentMethod: 'all', status: 'all' },
  })
})

test('API query validation rejects malformed nested filters instead of normalizing them', () => {
  assert.equal(validateAnalyticsQuery({
    range: 'week', from: null, to: null,
    filters: { source: 'provider', paymentMethod: 'crypto', status: 'deleted' },
  }), null)
  assert.deepEqual(validateAnalyticsQuery({
    range: 'week', from: null, to: null,
    filters: { source: 'staff', paymentMethod: 'pos', status: 'ready' },
  }), {
    range: 'week', from: null, to: null,
    filters: { source: 'staff', paymentMethod: 'pos', status: 'ready' },
  })
})
