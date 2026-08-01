import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient, createServiceClient } from '../src/client'
import {
  getRestaurantCustomerSegmentCounts,
  getRestaurantCustomers,
} from '../src/customers'
import type { CustomerSegment } from '@garsonless/domain/customers'

const root = fileURLToPath(new URL('../../../', import.meta.url))
if (!process.env['NEXT_PUBLIC_SUPABASE_URL']) loadEnvFile(`${root}apps/dashboard/.env.local`)

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function normalizeText(value: string): Promise<string> {
  const { data, error } = await createServiceClient().rpc('normalize_customer_search_text', { p_value: value })
  if (error) throw error
  return data
}

async function normalizePhone(value: string): Promise<string> {
  const { data, error } = await createServiceClient().rpc('normalize_customer_search_phone', { p_value: value })
  if (error) throw error
  return data
}

function formattedPhoneVariant(value: string): string {
  const digits = value.replace(/\D/g, '')
  const national = digits.startsWith('90') ? `0${digits.slice(2)}` : digits.startsWith('0') ? digits : `0${digits}`
  return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7, 9)} ${national.slice(9)}`.trim()
}

function collectPlanFacts(value: unknown): {
  nodeTypes: string[]
  indexNames: string[]
  planningMs: number | null
  executionMs: number | null
} {
  const nodeTypes = new Set<string>()
  const indexNames = new Set<string>()
  let planningMs: number | null = null
  let executionMs: number | null = null

  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      for (const item of current) visit(item)
      return
    }
    if (!current || typeof current !== 'object') return
    const record = current as Record<string, unknown>
    if (typeof record['Node Type'] === 'string') nodeTypes.add(record['Node Type'])
    if (typeof record['Index Name'] === 'string') indexNames.add(record['Index Name'])
    if (typeof record['Planning Time'] === 'number') planningMs = record['Planning Time']
    if (typeof record['Execution Time'] === 'number') executionMs = record['Execution Time']
    for (const child of Object.values(record)) visit(child)
  }
  visit(value)
  return { nodeTypes: [...nodeTypes].sort(), indexNames: [...indexNames].sort(), planningMs, executionMs }
}

async function main() {
  const service = createServiceClient()

  const textResults = await Promise.all([
    normalizeText('ÇAĞRI IŞIK'),
    normalizeText('Çağrı İŞİK'),
    normalizeText('  cagri   isik  '),
  ])
  assert(textResults.every((value) => value === 'cagri isik'), 'Turkish name variants did not normalize identically')

  const phoneResults = await Promise.all([
    normalizePhone('+90 532 123 45 67'),
    normalizePhone('0090 (532) 123-45-67'),
    normalizePhone('0532.123.45.67'),
    normalizePhone('5321234567'),
  ])
  assert(phoneResults.every((value) => value === '5321234567'), 'Phone variants did not normalize identically')

  const anonymous = createClient()
  const anonymousNormalizer = await anonymous.rpc('normalize_customer_search_text', { p_value: 'public probe' })
  assert(Boolean(anonymousNormalizer.error), 'Anonymous role unexpectedly executed the service-only normalizer')

  const { data: restaurants, error: restaurantsError } = await service
    .from('restaurants')
    .select('id')
    .is('deleted_at', null)
  if (restaurantsError) throw restaurantsError
  assert(restaurants?.length, 'No active DEV tenant is available')

  const ranked = await Promise.all(restaurants.map(async (restaurant) => {
    const result = await service
      .from('customer_restaurants')
      .select('customer_id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
    if (result.error) throw result.error
    return { restaurantId: restaurant.id, count: result.count ?? 0 }
  }))
  ranked.sort((left, right) => right.count - left.count)
  const primary = ranked[0]!
  assert(primary.count > 0, 'No associated DEV customer is available')

  const { data: associations, error: associationsError } = await service
    .from('customer_restaurants')
    .select('customer_id')
    .eq('restaurant_id', primary.restaurantId)
    .limit(100)
  if (associationsError) throw associationsError
  const customerIds = (associations ?? []).map((row) => row.customer_id)
  const { data: identities, error: identitiesError } = await service
    .from('customers')
    .select('id, name, phone')
    .in('id', customerIds)
  if (identitiesError) throw identitiesError
  const nameCandidate = (identities ?? []).find((row) => row.name?.trim()) ?? null
  const phoneCandidate = (identities ?? []).find((row) => row.phone?.trim()) ?? null

  let nameSearchMatches = false
  if (nameCandidate?.name) {
    const result = await getRestaurantCustomers(primary.restaurantId, {
      search: nameCandidate.name.toLocaleUpperCase('tr-TR'),
      pageSize: 100,
    })
    nameSearchMatches = result.customers.some((row) => row.customerId === nameCandidate.id)
    assert(nameSearchMatches, 'Canonical name search did not return its associated customer')
  }

  let phoneSearchMatches = false
  if (phoneCandidate?.phone) {
    const result = await getRestaurantCustomers(primary.restaurantId, {
      search: formattedPhoneVariant(phoneCandidate.phone),
      pageSize: 100,
    })
    phoneSearchMatches = result.customers.some((row) => row.customerId === phoneCandidate.id)
    assert(phoneSearchMatches, 'Canonical phone search did not return its associated customer')
  }

  const foreign = ranked.find((row) => row.restaurantId !== primary.restaurantId) ?? null
  let foreignTenantExcluded: boolean | null = null
  if (foreign && nameCandidate?.name) {
    const result = await getRestaurantCustomers(foreign.restaurantId, {
      search: nameCandidate.name,
      pageSize: 100,
    })
    foreignTenantExcluded = !result.customers.some((row) => row.customerId === nameCandidate.id)
    assert(foreignTenantExcluded, 'Search crossed the restaurant candidate boundary')
  }

  const repeatedA = await getRestaurantCustomers(primary.restaurantId, { sort: 'last_seen', pageSize: 100 })
  const repeatedB = await getRestaurantCustomers(primary.restaurantId, { sort: 'last_seen', pageSize: 100 })
  assert(
    repeatedA.customers.map((row) => row.customerId).join(',') === repeatedB.customers.map((row) => row.customerId).join(','),
    'Deterministic customer ordering changed between identical reads',
  )

  const counts = await getRestaurantCustomerSegmentCounts(primary.restaurantId)
  const segmentTotals: Record<CustomerSegment, number> = { new: 0, frequent: 0, lapsed: 0, consented: 0 }
  let newWindowRowCoverage = 0
  let lapsedWindowRowCoverage = 0
  const nowBefore = Date.now()
  for (const segment of Object.keys(segmentTotals) as CustomerSegment[]) {
    const page = await getRestaurantCustomers(primary.restaurantId, { segment, pageSize: 100 })
    segmentTotals[segment] = page.total
    assert(page.total === counts[segment], `${segment} segment count diverged from canonical list total`)
    if (segment === 'new') {
      assert(page.customers.every((row) => row.firstSeen && new Date(row.firstSeen).getTime() >= nowBefore - 30 * 86_400_000), 'New segment admitted an older customer')
      newWindowRowCoverage = page.customers.length
    }
    if (segment === 'lapsed') {
      const nowAfter = Date.now()
      assert(page.customers.every((row) => row.lastSeen && new Date(row.lastSeen).getTime() <= nowAfter - 60 * 86_400_000), 'Lapsed segment admitted a recent customer')
      lapsedWindowRowCoverage = page.customers.length
    }
  }

  const punctuationOnly = await getRestaurantCustomers(primary.restaurantId, { search: '---', pageSize: 100 })
  assert(punctuationOnly.total === 0, 'Punctuation-only phone search widened to every customer')

  let explain: { available: boolean; usedSearchIndex?: boolean; nodeTypes?: string[]; planningMs?: number | null; executionMs?: number | null } = { available: false }
  const scopeKey = primary.restaurantId
  const planResult = await service.rpc('get_restaurant_customers', {
    p_restaurant_id: primary.restaurantId,
    p_scope_key: scopeKey,
    p_search: 'Çağrı IŞIK',
    p_sort: 'last_seen',
    p_limit: 25,
    p_offset: 0,
  }).explain({ analyze: true, buffers: true, format: 'json' })
  if (!planResult.error) {
    const facts = collectPlanFacts(planResult.data)
    explain = {
      available: true,
      usedSearchIndex: facts.indexNames.some((name) => name === 'customers_search_name_trgm_idx' || name === 'customers_search_phone_trgm_idx'),
      nodeTypes: facts.nodeTypes,
      planningMs: facts.planningMs,
      executionMs: facts.executionMs,
    }
  }

  console.log(JSON.stringify({
    mutationPerformed: false,
    smsSent: false,
    normalizers: {
      turkishNameVariantsCanonical: true,
      phoneVariantsCanonical: true,
      anonymousExecuteRejected: true,
    },
    dataset: {
      activeTenantCount: ranked.length,
      primaryAssociatedCustomerCount: primary.count,
      nameCandidateAvailable: Boolean(nameCandidate),
      phoneCandidateAvailable: Boolean(phoneCandidate),
    },
    search: {
      nameSearchMatches: nameCandidate ? nameSearchMatches : null,
      phoneSearchMatches: phoneCandidate ? phoneSearchMatches : null,
      punctuationOnlyReturnsEmpty: true,
      foreignTenantExcluded,
    },
    segments: {
      countsMatchCanonicalLists: true,
      newWindowReturnedRowsChecked: newWindowRowCoverage,
      lapsedWindowReturnedRowsChecked: lapsedWindowRowCoverage,
      exactThirtyAndSixtyDayEdgeFixtureAvailable: false,
      totals: segmentTotals,
    },
    pagination: { repeatedReadOrderStable: true },
    explain,
  }, null, 2))
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Slice 2 runtime verification failed')
  process.exitCode = 1
})
