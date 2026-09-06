import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { getRestaurantCustomerDetail, getRestaurantCustomers, getRestaurantCustomerSegmentCounts, updateCustomerSegment } from './customers'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const customerId = '22222222-2222-4222-8222-222222222222'
const row = { customer_id: customerId, name: 'Test', phone: null, has_consent: false, spend: 0, visits: 1, points: 0, lifetime_points: 0, last_seen: null, first_seen: null, total_count: 6 }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

function stub(t: TestContext, handler: typeof fetch) {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://customers-test.invalid'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-only-key'
  t.mock.method(globalThis, 'fetch', handler)
  t.after(() => {
    if (url === undefined) delete process.env['NEXT_PUBLIC_SUPABASE_URL']; else process.env['NEXT_PUBLIC_SUPABASE_URL'] = url
    if (key === undefined) delete process.env['SUPABASE_SERVICE_ROLE_KEY']; else process.env['SUPABASE_SERVICE_ROLE_KEY'] = key
  })
}

test('an out-of-range page reloads page one and retains the canonical total', async (t) => {
  const offsets: number[] = []
  stub(t, async (input, init) => {
    if (String(input).includes('/rpc/get_restaurant_customers')) {
      const body = JSON.parse(String(init?.body))
      offsets.push(body.p_offset)
      return json(body.p_offset === 0 ? [row] : [])
    }
    return json([{ id: customerId, email: null, auth_user_id: null }])
  })
  const result = await getRestaurantCustomers(restaurantId, { page: 2 }, { loyaltyScope: null, includeContactData: false })
  assert.equal(result.page, 1)
  assert.equal(result.total, 6)
  assert.deepEqual(offsets, [25, 0])
})

test('identity read failures are errors, not missing customer contact fields', async (t) => {
  stub(t, async (input) => String(input).includes('/rpc/') ? json([row]) : json({ message: 'identity unavailable' }, 400))
  await assert.rejects(getRestaurantCustomers(restaurantId, {}, { loyaltyScope: null }), /identities: identity unavailable/)
})

test('empty first pages stay empty without recursively retrying', async (t) => {
  let calls = 0
  stub(t, async () => { calls++; return json([]) })
  const result = await getRestaurantCustomers(restaurantId, {}, { loyaltyScope: null })
  assert.equal(result.total, 0)
  assert.equal(calls, 1)
})

test('global count includes all customers independently of built-in segment counts', async (t) => {
  stub(t, async (_input, init) => {
    const body = JSON.parse(String(init?.body))
    return json([{ ...row, total_count: body.p_segment ? 2 : 6 }])
  })
  assert.deepEqual(await getRestaurantCustomerSegmentCounts(restaurantId, { loyaltyScope: null }), { total: 6, new: 2, frequent: 2, lapsed: 2, consented: 2 })
})

test('failed tenant activity queries cannot masquerade as a missing customer', async (t) => {
  stub(t, async () => json({ message: 'activity unavailable' }, 400))
  await assert.rejects(getRestaurantCustomerDetail(restaurantId, customerId), /hasActivityAtVenue/)
})

test('segment updates atomically include tenant, id and expected version; zero matches conflict', async (t) => {
  const expectedUpdatedAt = '2026-09-06T10:00:00.123456+00:00'
  stub(t, async (input, init) => {
    const url = new URL(String(input))
    assert.equal(init?.method, 'PATCH')
    assert.equal(url.searchParams.get('restaurant_id'), `eq.${restaurantId}`)
    assert.equal(url.searchParams.get('id'), `eq.${customerId}`)
    assert.equal(url.searchParams.get('updated_at'), `eq.${expectedUpdatedAt}`)
    return json(null)
  })
  await assert.rejects(updateCustomerSegment({ restaurantId, segmentId: customerId, expectedUpdatedAt, name: 'Test', definition: {} }), /customer_segment_conflict/)
})

for (const failedRead of ['customers', 'get_restaurant_customer_summary']) {
  test(`detail ${failedRead} failure is surfaced instead of a zero summary or 404`, async (t) => {
    stub(t, async (input, init) => {
      const url = new URL(String(input))
      if (init?.method === 'HEAD') return new Response(null, { headers: { 'Content-Range': '0-0/1' } })
      if (url.pathname.endsWith(`/${failedRead}`)) return json({ message: 'detail read unavailable' }, 400)
      if (url.pathname.endsWith('/customers')) return json({ name: 'Test', phone: null, email: null, auth_user_id: null, created_at: '2026-09-06T10:00:00Z' })
      if (url.pathname.includes('/rpc/')) return json([])
      return json(null)
    })
    await assert.rejects(getRestaurantCustomerDetail(restaurantId, customerId), /getRestaurantCustomerDetail: detail read unavailable/)
  })
}
