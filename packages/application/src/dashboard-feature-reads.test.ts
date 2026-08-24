import assert from 'node:assert/strict'
import test from 'node:test'
import { ok, type DashboardActorContext } from '@garsonless/domain'
import {
  listDashboardRestaurants,
  readDashboardRestaurant,
  type DashboardRestaurantReadModelPort,
} from './restaurants'
import {
  readMenuKitchenStations,
  readMenuManagement,
  type MenuManagementReadModelPort,
} from './menu'
import {
  readThemeMenuReferences,
  type ThemeMenuReferenceReadModelPort,
} from './themes'
import {
  readDashboardTables,
  type DashboardTablesReadModelPort,
} from './tables'
import {
  readDashboardSettings,
  type DashboardSettingsReadModelPort,
} from './settings'
import {
  DASHBOARD_FEATURE_READ_OPERATIONS,
  DASHBOARD_FEATURE_READ_POLICIES,
} from './dashboard-feature-read-models'

const restaurantId = 'restaurant-a'

function actor(permissions: string[], target = restaurantId): DashboardActorContext {
  return {
    actor: 'dashboard-member',
    userId: 'user-a',
    restaurantId: target,
    permissions,
  }
}

test('restaurant portfolio uses the authenticated user while tenant reads reject cross-tenant replay', async () => {
  let reads = 0
  const port: DashboardRestaurantReadModelPort<{ id: string }> = {
    async listAccessible(input) {
      assert.deepEqual(input, { userId: 'user-a', operation: 'restaurant.portfolio' })
      return ok([{ id: restaurantId }])
    },
    async readById({ restaurantId: id, operation }) {
      reads += 1
      assert.equal(operation, 'restaurant.detail')
      return ok({ id })
    },
  }

  const portfolio = await listDashboardRestaurants(
    { actor: 'dashboard-user', userId: 'user-a' },
    port,
  )
  assert.equal(portfolio.ok, true)

  const rejected = await readDashboardRestaurant(actor([], 'restaurant-b'), restaurantId, port)
  assert.deepEqual(rejected, { ok: false, error: 'Not authorized' })
  assert.equal(reads, 0)

  const accepted = await readDashboardRestaurant(actor([]), restaurantId, port)
  assert.equal(accepted.ok, true)
  assert.equal(reads, 1)
})

test('menu management and kitchen station reads enforce their explicit section policies', async () => {
  let managementReads = 0
  let stationReads = 0
  const port: MenuManagementReadModelPort<string, string, string> = {
    async readManagementData(input) {
      managementReads += 1
      assert.deepEqual(input, { restaurantId, operation: 'menu.management' })
      return ok({ categories: ['category'], items: ['item'], kitchenStations: ['station'] })
    },
    async readKitchenStations(input) {
      stationReads += 1
      assert.deepEqual(input, { restaurantId, operation: 'menu.kitchen-stations' })
      return ok(['station'])
    },
  }

  const rejected = await readMenuManagement(actor(['settings']), restaurantId, port)
  assert.deepEqual(rejected, { ok: false, error: 'Not authorized' })
  assert.equal(managementReads, 0)

  const settingsStations = await readMenuKitchenStations(actor(['settings']), restaurantId, port)
  assert.deepEqual(settingsStations, { ok: true, value: ['station'] })
  assert.equal(stationReads, 1)

  const crossTenant = await readMenuKitchenStations(actor(['settings'], 'restaurant-b'), restaurantId, port)
  assert.deepEqual(crossTenant, { ok: false, error: 'Not authorized' })
  assert.equal(stationReads, 1)
})

test('theme menu references never reach persistence without theme authority', async () => {
  let reads = 0
  const port: ThemeMenuReferenceReadModelPort<string, string> = {
    async readMenuReferences(input) {
      reads += 1
      assert.deepEqual(input, { restaurantId, operation: 'theme.menu-references' })
      return ok({ categories: ['category'], items: ['item'] })
    },
  }

  const rejected = await readThemeMenuReferences(actor(['menu']), restaurantId, port)
  assert.deepEqual(rejected, { ok: false, error: 'Not authorized' })
  assert.equal(reads, 0)

  const accepted = await readThemeMenuReferences(actor(['theme']), restaurantId, port)
  assert.equal(accepted.ok, true)
  assert.equal(reads, 1)
})

test('tables read rejects missing permission and cross-tenant contexts before the adapter', async () => {
  let reads = 0
  const port: DashboardTablesReadModelPort<string> = {
    async readTables(input) {
      reads += 1
      assert.deepEqual(input, { restaurantId, operation: 'tables.list' })
      return ok(['table'])
    },
  }

  assert.deepEqual(
    await readDashboardTables(actor(['menu']), restaurantId, port),
    { ok: false, error: 'Not authorized' },
  )
  assert.deepEqual(
    await readDashboardTables(actor(['tables'], 'restaurant-b'), restaurantId, port),
    { ok: false, error: 'Not authorized' },
  )
  assert.equal(reads, 0)

  assert.deepEqual(
    await readDashboardTables(actor(['tables']), restaurantId, port),
    { ok: true, value: ['table'] },
  )
  assert.equal(reads, 1)
})

test('settings read limits owner-only projections and rejects replay before the adapter', async () => {
  const inputs: Array<{
    restaurantId: string
    userId: string
    includeOwnerData: boolean
    scopes: Array<'team' | 'kitchen' | 'security'>
    operation: 'settings.snapshot'
  }> = []
  const port: DashboardSettingsReadModelPort<string, string, string, string> = {
    async readSettings(input) {
      inputs.push(input)
      return ok({ hasKitchenAccess: true, kitchenStations: [], teamMembers: [], teamAuditEvents: [], securityEvents: [] })
    },
  }

  assert.deepEqual(
    await readDashboardSettings(actor(['customers']), restaurantId, port),
    { ok: false, error: 'Not authorized' },
  )
  assert.deepEqual(
    await readDashboardSettings(actor(['settings'], 'restaurant-b'), restaurantId, port),
    { ok: false, error: 'Not authorized' },
  )
  assert.equal(inputs.length, 0)

  const member = await readDashboardSettings(actor(['settings']), restaurantId, port)
  assert.equal(member.ok, true)
  assert.deepEqual(inputs[0], {
    restaurantId, userId: 'user-a', includeOwnerData: false, scopes: ['team', 'kitchen', 'security'], operation: 'settings.snapshot',
  })

  const owner = await readDashboardSettings({ ...actor(['settings']), isOwner: true }, restaurantId, port)
  assert.equal(owner.ok, true)
  assert.deepEqual(inputs[1], {
    restaurantId, userId: 'user-a', includeOwnerData: true, scopes: ['team', 'kitchen', 'security'], operation: 'settings.snapshot',
  })
})

test('feature read operation vocabulary is closed and each tenant snapshot has an explicit policy', () => {
  assert.deepEqual(DASHBOARD_FEATURE_READ_OPERATIONS, [
    'restaurant.portfolio',
    'restaurant.detail',
    'menu.management',
    'menu.kitchen-stations',
    'theme.menu-references',
    'tables.list',
    'settings.snapshot',
  ])
  assert.deepEqual(DASHBOARD_FEATURE_READ_POLICIES['menu.kitchen-stations'].permissions, ['menu', 'settings'])
  assert.deepEqual(DASHBOARD_FEATURE_READ_POLICIES['restaurant.detail'].permissions, [])
})
