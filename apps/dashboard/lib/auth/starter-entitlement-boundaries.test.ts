import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getFeatureEntitlement } from '@garsonless/domain/entitlements'
import { DASHBOARD_SECTION_FEATURES } from './dashboard-entitlements'
import { SETTINGS_SECTION_FEATURES } from '../../components/settings/settings-sections'

test('dashboard and settings navigation use the canonical feature boundaries', () => {
  assert.deepEqual(DASHBOARD_SECTION_FEATURES, {
    pano: 'analytics_basic',
    orders: 'staff_orders',
    menu: 'qr_menu',
    tables: 'qr_studio',
    customers: 'customer_accounts',
    analytics: 'analytics_basic',
    theme: 'theme_editor',
  })
  assert.equal(getFeatureEntitlement('starter', DASHBOARD_SECTION_FEATURES.tables!).allowed, true)
  assert.equal(getFeatureEntitlement('starter', DASHBOARD_SECTION_FEATURES.pano!).allowed, false)
  assert.equal(getFeatureEntitlement('starter', DASHBOARD_SECTION_FEATURES.orders!).allowed, false)
  assert.equal(getFeatureEntitlement('starter', DASHBOARD_SECTION_FEATURES.customers!).allowed, false)

  assert.deepEqual(SETTINGS_SECTION_FEATURES, {
    team: 'team_management',
    payments: 'online_payments',
    loyalty: 'loyalty',
    kitchen: 'kitchen_display',
    notifications: 'staff_orders',
  })
})

test('locked routes authorize RBAC first and return plan upsell before sensitive reads', () => {
  const root = new URL('../../app/dashboard/[restaurantId]/', import.meta.url)
  const cases = [
    ['page.tsx', 'analytics_basic'],
    ['orders/page.tsx', 'staff_orders'],
    ['customers/page.tsx', 'customer_accounts'],
    ['analytics/page.tsx', 'analytics_basic'],
    ['tables/page.tsx', 'table_management'],
  ] as const

  for (const [path, feature] of cases) {
    const source = readFileSync(new URL(path, root), 'utf8')
    assert.ok(source.indexOf('requireSection') < source.indexOf('canRestaurantUseFeature'))
    assert.match(source, new RegExp(`feature: '${feature}'|feature="${feature}"`))
    assert.match(source, /PlanLockedPanel/)
  }
})

test('QR Studio reads tokens only after the Starter entitlement succeeds', () => {
  const source = readFileSync(
    new URL('../../app/dashboard/[restaurantId]/tables/qr/page.tsx', import.meta.url),
    'utf8',
  )
  assert.ok(source.indexOf("feature: 'qr_studio'") < source.indexOf('listDashboardTableQrTokens('))
  assert.match(source, /feature: 'table_management'/)
})

test('table actions separate Starter QR directory access from live operations', () => {
  const source = readFileSync(
    new URL('../actions/tables.ts', import.meta.url),
    'utf8',
  )
  const directory = source.slice(
    source.indexOf('export async function getTableDirectory'),
    source.indexOf('export type TableLayoutSnapshot'),
  )
  const undo = source.slice(
    source.indexOf('export async function undoTransfer'),
    source.indexOf('export async function getTransferHistory'),
  )
  assert.match(directory, /resolveTableQrCommandActor\(restaurantId\)/)
  assert.match(undo, /assertRestaurantFeature\(parsed\.data\.restaurantId, 'table_management'\)/)
})
