import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./dashboard-feature-read-model-port.ts', import.meta.url), 'utf8')
const contractSource = readFileSync(new URL('./dashboard-feature-read-model-contract.ts', import.meta.url), 'utf8')

test('dashboard feature adapter keeps access predicates explicit and tenant scopes every feature read', () => {
  assert.match(source, /\.eq\('owner_id', userId\)/)
  assert.match(source, /\.eq\('user_id', userId\)/)
  assert.match(source, /\.eq\('status', 'active'\)/)
  assert.match(source, /\.eq\('restaurant_id', restaurantId\)/)
  assert.match(source, /\.is\('deleted_at', null\)/)
})

test('dashboard feature adapter remains infrastructure-only', () => {
  assert.match(source, /createServiceClient/)
  assert.doesNotMatch(source, /auth\.getUser|DashboardActorContext|permissions\.includes/)
})

test('organization rollout does not erase existing owner or direct-member portfolios', () => {
  assert.match(source, /function isMissingRpc[\s\S]+PGRST202/)
  assert.match(source, /organizationError && !isMissingRpc\(organizationError\)/)
  assert.match(source, /!organizationError && Array\.isArray\(organizationRestaurants\)/)
})

test('feature snapshots use pinned projections and do not resurrect wildcard or dead QR reads', () => {
  assert.match(source, /DASHBOARD_FEATURE_READ_PROJECTIONS/)
  assert.doesNotMatch(source, /\.select\('\*'\)|\.select\("\*"\)/)
  assert.match(source, /select\(projection\.restaurant\)/)
  assert.match(source, /select\(projection\.menuCategory\)/)
  assert.match(source, /select\(projection\.menuItem\)/)
  assert.match(source, /select\(projection\.kitchenStation\)/)
  assert.match(source, /select\(projection\.table\)/)
  assert.match(source, /isUndefinedColumn/)
  assert.match(source, /projection\.restaurantBeforeTableLayout/)
  assert.match(source, /projection\.tableBeforeFloorLayout/)
  assert.match(source, /withDefaultTableLayoutRestaurant/)
  assert.match(source, /withDefaultTableLayoutTable/)
  assert.match(contractSource, /DASHBOARD_FEATURE_READ_PROJECTIONS/)
  assert.match(contractSource, /qr_code_url.*retired/)
  assert.doesNotMatch(contractSource, /'qr_code_url'/)
})

test('settings snapshot scopes security history to the verified user and owner data opt-in', () => {
  assert.match(source, /\.eq\('user_id', userId\)/)
  assert.match(source, /includeOwnerData/)
  assert.match(source, /listTeamMembers\(restaurantId\)/)
  assert.match(source, /\.from\('kitchen_stations'\)/)
})
