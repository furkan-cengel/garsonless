import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient, createServiceClient } from '../src/client'
import {
  getRestaurantCustomerDetail,
  getRestaurantCustomerTimeline,
} from '../src/customers'

const root = fileURLToPath(new URL('../../../', import.meta.url))
if (!process.env['NEXT_PUBLIC_SUPABASE_URL']) loadEnvFile(`${root}apps/dashboard/.env.local`)

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

type Candidate = { restaurantId: string; customerId: string; activityCount: number }

async function main() {
  const service = createServiceClient()

  const [{ data: activeRestaurants, error: restaurantError }, { data: orders, error: orderError }, { data: ledger, error: ledgerError }] = await Promise.all([
    service.from('restaurants').select('id').is('deleted_at', null),
    service.from('orders').select('id, restaurant_id, customer_id, total, status, paid_at, payment_method, created_at, deleted_at').not('customer_id', 'is', null).limit(2_000),
    service.from('loyalty_transactions').select('id, restaurant_id, customer_id, type, direction, delta, reason, created_at').limit(2_000),
  ])
  if (restaurantError) throw restaurantError
  if (orderError) throw orderError
  if (ledgerError) throw ledgerError
  assert(activeRestaurants?.length, 'No active DEV tenant is available')

  const activeIds = new Set(activeRestaurants.map((row) => row.id))
  const candidates = new Map<string, Candidate>()
  const addCandidate = (restaurantId: string, customerId: string | null) => {
    if (!customerId || !activeIds.has(restaurantId)) return
    const key = `${restaurantId}:${customerId}`
    const existing = candidates.get(key)
    candidates.set(key, {
      restaurantId,
      customerId,
      activityCount: (existing?.activityCount ?? 0) + 1,
    })
  }
  for (const row of orders ?? []) if (!row.deleted_at) addCandidate(row.restaurant_id, row.customer_id)
  for (const row of ledger ?? []) addCandidate(row.restaurant_id, row.customer_id)
  const primary = [...candidates.values()].sort((left, right) => right.activityCount - left.activityCount)[0]
  assert(primary, 'No DEV customer activity is available')

  const customerOrders = (orders ?? []).filter((row) => (
    row.restaurant_id === primary.restaurantId
    && row.customer_id === primary.customerId
    && !row.deleted_at
  ))
  const customerLedger = (ledger ?? []).filter((row) => (
    row.restaurant_id === primary.restaurantId
    && row.customer_id === primary.customerId
    && ['stamp', 'points', 'visit'].includes(row.type)
    && ['earn', 'redeem', 'refund'].includes(row.direction)
  ))
  const canonicalSpend = customerOrders.reduce((sum, row) => (
    row.paid_at
    && row.status !== 'cancelled'
    && (row.payment_method === null || row.payment_method !== 'comp')
      ? sum + Number(row.total)
      : sum
  ), 0)
  const canonicalVisits = customerLedger.reduce((sum, row) => row.type === 'visit' ? sum + row.delta : sum, 0)

  const detail = await getRestaurantCustomerDetail(primary.restaurantId, primary.customerId, { includeContactData: false })
  assert(detail, 'Customer detail was unavailable after migration')
  assert(Math.abs(detail.spend - canonicalSpend) < 0.0001, 'Detail spend diverged from canonical collected orders')
  assert(detail.visits === canonicalVisits, 'Detail visits diverged from the visit ledger')

  const expectedTimelineCount = customerOrders.length + customerLedger.length
  assert(detail.timeline.length === Math.min(30, expectedTimelineCount), 'Initial timeline page has an unexpected size')
  assert(detail.timelineHasMore === (expectedTimelineCount > 30), 'Initial timeline hasMore is incorrect')
  assert(Boolean(detail.timelineNextCursor) === (expectedTimelineCount > 30), 'Initial timeline cursor is incorrect')

  const repeated = await getRestaurantCustomerTimeline(primary.restaurantId, primary.customerId)
  assert(repeated, 'Repeated timeline read was unavailable')
  assert(
    repeated.events.map((event) => event.id).join(',') === detail.timeline.map((event) => event.id).join(','),
    'Repeated timeline ordering was unstable',
  )

  const allEvents = [...detail.timeline]
  let cursor = detail.timelineNextCursor
  let hasMore = detail.timelineHasMore
  let pageCount = 1
  while (hasMore) {
    assert(cursor, 'Timeline reported more rows without a cursor')
    const page = await getRestaurantCustomerTimeline(primary.restaurantId, primary.customerId, cursor)
    assert(page, 'Timeline cursor page was unavailable')
    allEvents.push(...page.events)
    cursor = page.nextCursor
    hasMore = page.hasMore
    pageCount += 1
    assert(pageCount <= 100, 'Timeline cursor did not terminate')
  }
  assert(new Set(allEvents.map((event) => event.id)).size === allEvents.length, 'Timeline cursor repeated an event')
  assert(allEvents.length === expectedTimelineCount, 'Timeline cursor skipped one or more events')

  const firstRaw = await service.rpc('get_restaurant_customer_timeline', {
    p_restaurant_id: primary.restaurantId,
    p_customer_id: primary.customerId,
    p_limit: 1,
  })
  if (firstRaw.error) throw firstRaw.error
  const firstRows = firstRaw.data ?? []
  assert(firstRows.length === Math.min(2, expectedTimelineCount), 'RPC limit+1 sentinel is incorrect')
  let lowLimitCursorAdvanced: boolean | null = null
  if (firstRows.length === 2) {
    const first = firstRows[0]!
    const nextRaw = await service.rpc('get_restaurant_customer_timeline', {
      p_restaurant_id: primary.restaurantId,
      p_customer_id: primary.customerId,
      p_before_at: first.event_at,
      p_before_kind: first.event_kind,
      p_before_id: first.event_id,
      p_limit: 1,
    })
    if (nextRaw.error) throw nextRaw.error
    lowLimitCursorAdvanced = nextRaw.data?.[0]?.event_id === firstRows[1]?.event_id
    assert(lowLimitCursorAdvanced, 'Low-limit RPC cursor skipped or repeated its next event')
  }

  const anonymous = createClient()
  const anonymousResult = await anonymous.rpc('get_restaurant_customer_timeline', {
    p_restaurant_id: '00000000-0000-4000-8000-000000000001',
    p_customer_id: '00000000-0000-4000-8000-000000000002',
    p_limit: 1,
  })
  assert(Boolean(anonymousResult.error), 'Anonymous role unexpectedly executed the timeline RPC')

  let foreignTenantExcluded: boolean | null = null
  const foreignRestaurant = activeRestaurants.find((restaurant) => (
    restaurant.id !== primary.restaurantId
    && !(orders ?? []).some((row) => row.restaurant_id === restaurant.id && row.customer_id === primary.customerId && !row.deleted_at)
    && !(ledger ?? []).some((row) => row.restaurant_id === restaurant.id && row.customer_id === primary.customerId)
  ))
  if (foreignRestaurant) {
    const foreignDetail = await getRestaurantCustomerTimeline(foreignRestaurant.id, primary.customerId)
    foreignTenantExcluded = foreignDetail === null
    assert(foreignTenantExcluded, 'Customer timeline crossed the restaurant boundary')
  }

  const compRows = customerOrders.filter((row) => row.paid_at && row.status !== 'cancelled' && row.payment_method === 'comp').length
  const cancelledRows = customerOrders.filter((row) => row.status === 'cancelled').length
  const unpaidRows = customerOrders.filter((row) => !row.paid_at).length
  const softDeletedRows = (orders ?? []).filter((row) => (
    row.restaurant_id === primary.restaurantId
    && row.customer_id === primary.customerId
    && Boolean(row.deleted_at)
  )).length

  console.log(JSON.stringify({
    mutationPerformed: false,
    smsSent: false,
    productionTouched: false,
    dataset: {
      activeTenantCount: activeRestaurants.length,
      candidateCustomerActivityCount: candidates.size,
      selectedTimelineEventCount: expectedTimelineCount,
      timelinePagesRead: pageCount,
    },
    metrics: {
      spendMatchesCanonicalCollectedOrders: true,
      visitsMatchLedger: true,
      compRowsCoveredAtRuntime: compRows,
      cancelledRowsCoveredAtRuntime: cancelledRows,
      unpaidRowsCoveredAtRuntime: unpaidRows,
      softDeletedRowsCoveredAtRuntime: softDeletedRows,
    },
    timeline: {
      initialPageBounded: true,
      hasMoreAndCursorCorrect: true,
      repeatedReadOrderStable: true,
      allPagesNoSkipOrDuplicate: true,
      lowLimitCursorAdvanced,
      highVolumeMultiPageCovered: expectedTimelineCount > 30,
    },
    security: {
      anonymousExecuteRejected: true,
      foreignTenantExcluded,
      contactProjectionRequested: false,
    },
  }, null, 2))
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Slice 3 runtime verification failed')
  process.exitCode = 1
})
