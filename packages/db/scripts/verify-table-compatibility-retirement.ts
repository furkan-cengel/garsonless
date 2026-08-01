import { randomUUID } from 'node:crypto'
import {
  createDashboardTable,
  deleteDashboardTable,
  listDashboardTableQrTokens,
  readPublicTableOrderStatus,
  readPublicTableState,
  renameDashboardTable,
  resolvePublicTableContext,
  rotateDashboardTableQrToken,
  saveDashboardQrStyle,
} from '@garsonless/application/tables'
import { createClient, createServiceClient } from '../src/client'
import { createDashboardTablePort } from '../src/table-command-port'
import { createPublicTableQueryPort } from '../src/table-qr-tokens'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  let primaryError: unknown = null
  try {
    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const slug = `table-port-${suffix}`
    const { data: restaurant, error: restaurantError } = await service.from('restaurants').insert({
      owner_id: fixture.owner_id,
      slug,
      name: `Table port ${suffix}`,
      settings: { runtimeMarker: suffix },
    }).select('id').single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Restaurant unavailable')
    restaurantId = restaurant.id

    const context = {
      actor: 'dashboard-member' as const,
      restaurantId,
      userId: fixture.owner_id,
      permissions: ['tables'],
    }
    const dashboardPort = createDashboardTablePort()
    const publicPort = createPublicTableQueryPort()

    const created = await createDashboardTable(context, { restaurantId, label: 'Port Table' }, dashboardPort)
    assert(created.ok, created.ok ? '' : created.error)
    const tableId = created.value.id
    const initialToken = created.value.token

    const listed = await listDashboardTableQrTokens(context, restaurantId, dashboardPort)
    assert(listed.ok && listed.value[tableId] === initialToken, 'Dashboard token projection mismatch')
    const resolved = await resolvePublicTableContext(initialToken, publicPort)
    assert(resolved.ok && resolved.value?.tableId === tableId, 'Public token context was not resolved')

    const renamed = await renameDashboardTable(
      context,
      { restaurantId, tableId, label: 'Renamed Port Table' },
      dashboardPort,
    )
    assert(renamed.ok, renamed.ok ? '' : renamed.error)
    const resolvedAfterRename = await resolvePublicTableContext(initialToken, publicPort)
    assert(
      resolvedAfterRename.ok && resolvedAfterRename.value?.tableLabel === 'Renamed Port Table',
      'Rename did not update the public projection',
    )

    const baseUrl = `https://menu.masabu.co/${slug}`
    const styled = await saveDashboardQrStyle(
      context,
      { restaurantId, style: { baseUrl, runtimeMarker: suffix }, baseUrl, menuOrigin: 'https://menu.masabu.co' },
      dashboardPort,
    )
    assert(styled.ok, styled.ok ? '' : styled.error)
    const { data: settingsRow, error: settingsError } = await service.from('restaurants')
      .select('settings').eq('id', restaurantId).single()
    if (settingsError) throw settingsError
    const qrStyle = (settingsRow.settings as Record<string, unknown> | null)?.['qr_style'] as Record<string, unknown> | undefined
    assert(qrStyle?.['runtimeMarker'] === suffix, 'QR style patch was not persisted')

    const { data: session, error: sessionError } = await service.from('table_sessions').insert({
      restaurant_id: restaurantId,
      table_id: tableId,
    }).select('id').single()
    if (sessionError || !session) throw sessionError ?? new Error('Session unavailable')
    const { data: order, error: orderError } = await service.from('orders').insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      table_session_id: session.id,
      session_id: session.id,
      status: 'sent_to_kitchen',
      items: [{ name: 'Compatibility item', quantity: 1 }],
      total: 42,
      request_id: randomUUID(),
    }).select('id').single()
    if (orderError || !order) throw orderError ?? new Error('Order unavailable')

    const state = await readPublicTableState(initialToken, publicPort)
    assert(state.ok && state.value?.orders.length === 1, 'Narrow public state did not return the active order')
    const status = await readPublicTableOrderStatus({
      token: initialToken,
      sessionId: session.id,
      orderId: order.id,
    }, publicPort)
    assert(status.ok && status.value?.status === 'sent_to_kitchen', 'Scoped order status query failed')

    const blockedDelete = await deleteDashboardTable(context, { restaurantId, tableId }, dashboardPort)
    assert(blockedDelete.ok && blockedDelete.value === 'open_session', 'Open-session delete was not blocked')

    const rotated = await rotateDashboardTableQrToken(context, { restaurantId, tableId }, dashboardPort)
    assert(rotated.ok && rotated.value && rotated.value !== initialToken, 'QR rotation did not issue a new token')
    const [oldContext, newContext] = await Promise.all([
      resolvePublicTableContext(initialToken, publicPort),
      resolvePublicTableContext(rotated.value, publicPort),
    ])
    assert(oldContext.ok && oldContext.value === null, 'Old QR token remained valid after rotation')
    assert(newContext.ok && newContext.value?.tableId === tableId, 'Rotated QR token did not resolve')

    const { error: closeError } = await service.from('table_sessions')
      .update({ closed_at: new Date().toISOString(), close_reason: 'runtime_cleanup' })
      .eq('id', session.id).eq('restaurant_id', restaurantId)
    if (closeError) throw closeError
    const deleted = await deleteDashboardTable(context, { restaurantId, tableId }, dashboardPort)
    assert(deleted.ok && deleted.value === 'deleted', 'Closed table was not soft-deleted')
    const afterDelete = await resolvePublicTableContext(rotated.value, publicPort)
    assert(afterDelete.ok && afterDelete.value === null, 'Soft-deleted table token remained valid')

    const anon = createClient()
    const [anonResolve, anonList, anonRotate, anonPatch] = await Promise.all([
      anon.rpc('resolve_active_table_qr_token', { p_token: rotated.value }),
      anon.rpc('list_active_table_qr_tokens', { p_restaurant_id: restaurantId }),
      anon.rpc('rotate_table_qr_token', {
        p_restaurant_id: restaurantId,
        p_table_id: tableId,
        p_revoked_by: fixture.owner_id,
        p_reason: 'forbidden',
      }),
      anon.rpc('patch_restaurant_qr_style', {
        p_restaurant_id: restaurantId,
        p_qr_style: {},
        p_expected_revision: 0,
      }),
    ])
    const anonCodes = [anonResolve, anonList, anonRotate, anonPatch].map((result) => result.error?.code)
    assert(anonCodes.every((code) => code === '42501'), 'Anon could execute a table credential/style RPC')

    console.log(JSON.stringify({
      dashboard: {
        created: true,
        listed: true,
        renamedLabel: resolvedAfterRename.value.tableLabel,
        qrStylePatched: true,
        openSessionDelete: blockedDelete.value,
        closedTableDelete: deleted.value,
      },
      public: {
        initialResolved: true,
        orderCount: state.value.orders.length,
        orderStatus: status.value.status,
        oldTokenAfterRotation: oldContext.value,
        newTokenResolved: newContext.value?.tableId === tableId,
        tokenAfterDelete: afterDelete.value,
      },
      access: { anonRpcCodes: anonCodes },
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error } = await service.from('restaurants').delete().eq('id', restaurantId)
    if (error) throw error
  }
  const marker = restaurantId || randomUUID()
  const [restaurants, tables, sessions, orders, tokens] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('table_sessions').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('table_qr_tokens').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  const cleanup = {
    restaurants: restaurants.count,
    tables: tables.count,
    sessions: sessions.count,
    orders: orders.count,
    tokens: tokens.count,
  }
  console.log(JSON.stringify({ cleanup }))
  assert(Object.values(cleanup).every((count) => count === 0), 'Table compatibility runtime left orphan rows')
  if (primaryError) throw primaryError
}

void main()
