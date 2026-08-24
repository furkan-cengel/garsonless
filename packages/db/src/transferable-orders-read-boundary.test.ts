import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const portSource = readFileSync(`${directory}/order-command-port.ts`, 'utf8')
const serverSource = readFileSync(`${directory}/server.ts`, 'utf8')
const migrationSource = readFileSync(`${directory}/../supabase/migrations/20260822030000_transferable_orders_fast_read.sql`, 'utf8')
const criticalPathMigration = readFileSync(`${directory}/../supabase/migrations/20260822040000_tables_critical_path_reads.sql`, 'utf8')

test('transferable order reader stays tenant and session scoped behind the server boundary', () => {
  const reader = portSource.slice(
    portSource.indexOf('export async function readTransferableOrdersForSession'),
    portSource.indexOf('/** Supabase adapter for KDS commands'),
  )
  assert.match(reader, /createServiceClient\(\)/)
  assert.match(reader, /\.eq\('restaurant_id', input\.restaurantId\)/)
  assert.match(reader, /\.eq\('table_session_id', input\.sessionId\)/)
  assert.match(reader, /\.is\('deleted_at', null\)/)
  assert.match(reader, /\.neq\('status', 'cancelled'\)/)
  assert.match(reader, /abortSignal\(signal\)/)
  assert.match(serverSource, /readTransferableOrdersForSession/)
})

test('settlement order reader uses the same service-only tenant boundary', () => {
  const reader = portSource.slice(
    portSource.indexOf('export async function readOrdersForSettlement'),
    portSource.indexOf('/** Service-only, tenant-scoped read model'),
  )
  assert.match(reader, /createServiceClient\(\)/)
  assert.match(reader, /\.eq\('restaurant_id', input\.restaurantId\)/)
  assert.match(reader, /\.eq\('table_session_id', input\.sessionId\)/)
  assert.match(reader, /abortSignal\(signal\)/)
  assert.match(serverSource, /readOrdersForSettlement/)
})

test('fast transfer read verifies actor access and keeps the RPC service-only', () => {
  assert.match(migrationSource, /security definer/)
  assert.match(migrationSource, /set search_path = public, pg_temp/)
  assert.match(migrationSource, /restaurant\.owner_id = p_actor_user_id/)
  assert.match(migrationSource, /member\.permissions \? 'tables'/)
  assert.match(migrationSource, /organization_members member/)
  assert.match(migrationSource, /read_restaurant_entitlement_context/)
  assert.match(migrationSource, /orders\.restaurant_id = p_restaurant_id/)
  assert.match(migrationSource, /orders\.table_session_id = p_session_id/)
  assert.match(migrationSource, /revoke all on function public\.read_transferable_session_orders_bundle\(uuid,uuid,uuid\)[\s\S]*from public, anon, authenticated/)
  assert.match(migrationSource, /grant execute on function public\.read_transferable_session_orders_bundle\(uuid,uuid,uuid\)[\s\S]*to service_role/)
  assert.match(portSource, /export async function readTransferableOrdersAccessBundle/)
  assert.match(portSource, /PGRST202/)
  assert.match(serverSource, /readTransferableOrdersAccessBundle/)
})

test('critical settlement reads and writes collapse round trips without weakening tenant scope', () => {
  assert.match(criticalPathMigration, /read_tables_command_access_bundle/)
  assert.match(criticalPathMigration, /security definer/)
  assert.match(criticalPathMigration, /set search_path = public, pg_temp/)
  assert.match(criticalPathMigration, /restaurant\.owner_id = p_actor_user_id/)
  assert.match(criticalPathMigration, /member\.permissions \? 'tables'/)
  assert.match(criticalPathMigration, /orders\.restaurant_id = p_restaurant_id/)
  assert.match(criticalPathMigration, /orders\.table_session_id = p_session_id/)
  assert.match(criticalPathMigration, /payment_shares share[\s\S]*share\.restaurant_id = p_restaurant_id[\s\S]*share\.table_session_id = p_session_id/)
  assert.match(criticalPathMigration, /settle_session_and_close_atomic/)
  assert.match(criticalPathMigration, /for update/)
  assert.match(criticalPathMigration, /orders\.paid_at is null/)
  assert.match(criticalPathMigration, /close_table_session_atomic\(p_session_id, p_restaurant_id, null\)/)
  assert.match(criticalPathMigration, /revoke all on function[\s\S]*settle_session_and_close_atomic\(uuid,uuid,uuid,jsonb\)[\s\S]*from public, anon, authenticated/)
  assert.match(criticalPathMigration, /grant execute on function[\s\S]*settle_session_and_close_atomic\(uuid,uuid,uuid,jsonb\)[\s\S]*to service_role/)
  assert.match(portSource, /export async function readSessionSettlementAccessBundle/)
  assert.match(portSource, /export async function settleSessionAndCloseAtomic/)
  assert.match(serverSource, /settleSessionAndCloseAtomic/)
})
