import assert from 'node:assert/strict'
import test from 'node:test'
import {
  customerListHref,
  parseCustomerListState,
  safeCustomerListReturnPath,
} from './customer-list-state'

test('customer list state round-trips canonical search, segment, sort and page', () => {
  const input = new URLSearchParams({
    q: '  Çağrı IŞIK  ',
    segment: 'lapsed',
    sort: 'spend',
    page: '3',
  })
  const state = parseCustomerListState(input)
  assert.deepEqual(state, {
    search: 'Çağrı IŞIK',
    segment: 'lapsed',
    customSegmentId: null,
    sort: 'spend',
    page: 3,
    customerId: null,
  })
  assert.equal(
    customerListHref('/dashboard/restaurant/customers', state),
    '/dashboard/restaurant/customers?q=%C3%87a%C4%9Fr%C4%B1+I%C5%9EIK&segment=lapsed&sort=spend&page=3',
  )
})

test('saved segments take precedence and malformed URL values fail closed', () => {
  const saved = '83a28220-8bc5-4a46-bf13-d2b286a29a84'
  assert.deepEqual(parseCustomerListState(new URLSearchParams({
    saved,
    segment: 'consented',
    sort: 'unknown',
    page: '-5',
  })), {
    search: '',
    segment: '',
    customSegmentId: saved,
    sort: 'last_seen',
    page: 1,
    customerId: null,
  })
})

test('the open profile survives a reload and only a customer id is accepted', () => {
  const customer = 'b7e9d88d-5a25-4a66-951f-4ea3ded5b8fb'
  const state = parseCustomerListState(new URLSearchParams({ segment: 'new', customer }))
  assert.equal(state.customerId, customer)
  assert.equal(customerListHref('/dashboard/r/customers', state), `/dashboard/r/customers?segment=new&customer=${customer}`)
  assert.equal(parseCustomerListState(new URLSearchParams({ customer: '../steal' })).customerId, null)
})

test('customer detail return path accepts only the same restaurant list route', () => {
  const restaurantId = 'restaurant-a'
  assert.equal(
    safeCustomerListReturnPath(restaurantId, `/dashboard/${restaurantId}/customers?q=ada&page=2`),
    `/dashboard/${restaurantId}/customers?q=ada&page=2`,
  )
  assert.equal(
    safeCustomerListReturnPath(restaurantId, '/dashboard/restaurant-b/customers?q=ada'),
    `/dashboard/${restaurantId}/customers`,
  )
  assert.equal(
    safeCustomerListReturnPath(restaurantId, 'https://example.com/steal'),
    `/dashboard/${restaurantId}/customers`,
  )
})
