import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  readPlatformTenantServiceControl,
  setPlatformTenantServiceStatus,
} from '@garsonless/application/platform-admin-tenant-operations'
import { createDashboardOrder, placePublicOrder } from '@garsonless/application/orders'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { createDashboardOrderPort, createPublicOrderPort } from '../src/order-command-port'
import {
  createPlatformAdminTenantOperationsPort,
  readTenantOrderIngressStatus,
} from '../src/platform-admin-tenant-operations-port'
import type { Database } from '../src/types.gen'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type RawOperationsRpc = (
  name: 'read_platform_admin_tenant_service_control' | 'set_platform_admin_tenant_service_status',
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function countOrders() {
  const { count, error } = await service
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  if (error) throw error
  return count ?? -1
}

async function main() {
  let primaryError: unknown = null
  let immutableAuditRows = 0

  try {
    const [{ data: fixture, error: fixtureError }, { data: identity, error: identityError }] = await Promise.all([
      service.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single(),
      service.from('platform_admin_users')
        .select('user_id, role, status')
        .eq('role', 'superadmin')
        .eq('status', 'active')
        .limit(1)
        .single(),
    ])
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')
    if (identityError || !identity) throw identityError ?? new Error('Active superadmin unavailable')

    const actor: PlatformAdminActorContext = {
      actor: 'platform-admin',
      userId: identity.user_id,
      role: 'superadmin',
      aal: 'aal2',
    }
    const operationsPort = createPlatformAdminTenantOperationsPort()

    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .insert({
        owner_id: fixture.owner_id,
        slug: `platform-control-${suffix}`,
        name: `Platform control ${suffix}`,
        settings: { runtimeVerification: true },
      })
      .select('id, slug')
      .single()
    if (restaurantError || !restaurant) throw restaurantError ?? new Error('Throwaway tenant unavailable')
    restaurantId = restaurant.id

    const [{ data: table, error: tableError }, { data: category, error: categoryError }] = await Promise.all([
      service.from('tables').insert({ restaurant_id: restaurantId, label: 'Runtime table' }).select('id').single(),
      service.from('menu_categories').insert({ restaurant_id: restaurantId, name: 'Runtime category' }).select('id').single(),
    ])
    if (tableError || !table) throw tableError ?? new Error('Runtime table unavailable')
    if (categoryError || !category) throw categoryError ?? new Error('Runtime category unavailable')
    const { data: item, error: itemError } = await service.from('menu_items').insert({
      category_id: category.id,
      name: 'Runtime item',
      price: 42,
    }).select('id').single()
    if (itemError || !item) throw itemError ?? new Error('Runtime item unavailable')

    const initial = await readPlatformTenantServiceControl(actor, restaurantId, operationsPort)
    assert(initial.ok && initial.value.status === 'active' && initial.value.version === 0, 'Missing control was not active')
    assert(await readTenantOrderIngressStatus(restaurantId) === 'active', 'Initial ingress was not active')

    const supportDenied = await setPlatformTenantServiceStatus(
      { ...actor, role: 'support' },
      {
        restaurantId,
        status: 'suspended',
        reason: 'Runtime support role denial check',
        requestId: randomUUID(),
      },
      operationsPort,
    )
    assert(!supportDenied.ok && supportDenied.error === 'Not authorized', 'Support role reached mutation')
    const financeDenied = await setPlatformTenantServiceStatus(
      { ...actor, role: 'finance' },
      {
        restaurantId,
        status: 'suspended',
        reason: 'Runtime finance role denial check',
        requestId: randomUUID(),
      },
      operationsPort,
    )
    assert(!financeDenied.ok && financeDenied.error === 'Not authorized', 'Finance role reached mutation')

    const rawRpc = service.rpc.bind(service) as unknown as RawOperationsRpc
    const forgedRole = await rawRpc('set_platform_admin_tenant_service_status', {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actor.userId,
      p_actor_role: 'ops',
      p_status: 'suspended',
      p_reason: 'Runtime forged role must be rejected',
      p_request_id: randomUUID(),
    })
    assert(forgedRole.error?.code === '42501', 'Database accepted a forged platform role')

    const anon = createClient<Database>(
      env('NEXT_PUBLIC_SUPABASE_URL'),
      env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const anonTable = await anon.from('tenant_service_controls').select('restaurant_id').limit(1)
    const anonRpc = anon.rpc.bind(anon) as unknown as RawOperationsRpc
    const anonRead = await anonRpc('read_platform_admin_tenant_service_control', {
      p_restaurant_id: restaurantId,
    })
    assert(anonTable.error?.code === '42501' && anonRead.error?.code === '42501', 'Public boundary opened')

    const suspendRequestId = randomUUID()
    const suspended = await setPlatformTenantServiceStatus(actor, {
      restaurantId,
      status: 'suspended',
      reason: 'Runtime sipariş erişimi askıya alma doğrulaması',
      requestId: suspendRequestId,
    }, operationsPort)
    assert(suspended.ok && suspended.value.changed && suspended.value.status === 'suspended', 'Suspend failed')
    const replay = await setPlatformTenantServiceStatus(actor, {
      restaurantId,
      status: 'suspended',
      reason: 'Runtime sipariş erişimi askıya alma doğrulaması',
      requestId: suspendRequestId,
    }, operationsPort)
    assert(replay.ok && replay.value.requestId === suspendRequestId, 'Suspend replay failed')

    const dashboardContext = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['orders'],
    }
    const heldDashboard = await createDashboardOrder(dashboardContext, {
      restaurantId,
      tableId: table.id,
      lines: [{ itemId: item.id, quantity: 1 }],
    }, createDashboardOrderPort())
    assert(!heldDashboard.ok && heldDashboard.error === 'İşletme şu anda yeni sipariş almıyor.', 'Dashboard order was not blocked')

    const tableToken = randomUUID()
    const sessionId = randomUUID()
    const heldPublic = await placePublicOrder(
      { actor: 'table-guest', restaurantId, tableId: table.id, tableToken, sessionId },
      {
        restaurantId,
        slug: restaurant.slug,
        tableToken,
        tableId: table.id,
        sessionId,
        requestId: randomUUID(),
        lines: [{ itemId: item.id, quantity: 1 }],
        customerId: null,
        redeemPoints: 0,
        redeemStampClaim: false,
        catalogItemId: null,
        rateLimitKey: `platform-control-${suffix}`,
        tableRateLimitKey: `platform-control-table-${suffix}`,
      },
      createPublicOrderPort(),
    )
    assert(!heldPublic.ok && heldPublic.error === 'İşletme şu anda yeni sipariş almıyor.', 'Public order was not blocked')
    assert(await countOrders() === 0, 'Held tenant wrote an order')

    const holdRequestId = randomUUID()
    const manualHold = await setPlatformTenantServiceStatus(actor, {
      restaurantId,
      status: 'manual_hold',
      reason: 'Runtime manuel güvenlik incelemesi doğrulaması',
      requestId: holdRequestId,
    }, operationsPort)
    assert(manualHold.ok && manualHold.value.status === 'manual_hold', 'Manual hold failed')
    const manualHoldIngress = await readTenantOrderIngressStatus(restaurantId)
    assert(manualHoldIngress === 'manual_hold', 'Manual hold did not reach ingress')

    const activeRequestId = randomUUID()
    const active = await setPlatformTenantServiceStatus(actor, {
      restaurantId,
      status: 'active',
      reason: 'Runtime incelemesi tamamlandı sipariş erişimi açıldı',
      requestId: activeRequestId,
    }, operationsPort)
    assert(active.ok && active.value.status === 'active', 'Reactivate failed')

    const reopenedOrder = await createDashboardOrder(dashboardContext, {
      restaurantId,
      tableId: table.id,
      lines: [{ itemId: item.id, quantity: 1 }],
    }, createDashboardOrderPort())
    assert(reopenedOrder.ok, reopenedOrder.ok ? '' : reopenedOrder.error)
    assert(await countOrders() === 1, 'Reactivated tenant could not create exactly one order')

    const { count: replayAuditCount, error: replayAuditError } = await service
      .from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor_user_id', actor.userId)
      .eq('request_id', suspendRequestId)
      .eq('target_id', restaurantId)
    if (replayAuditError) throw replayAuditError
    assert(replayAuditCount === 1, 'Idempotent replay wrote duplicate audit rows')

    const { count: auditCount, error: auditError } = await service
      .from('platform_admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'restaurant')
      .eq('target_id', restaurantId)
    if (auditError) throw auditError
    immutableAuditRows = auditCount ?? -1
    assert(immutableAuditRows === 3, 'Unexpected immutable lifecycle audit count')

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      tenant: { idSuffix: restaurantId.slice(-6), initial: initial.value },
      authorization: {
        support: supportDenied,
        finance: financeDenied,
        forgedRoleCode: forgedRole.error?.code ?? null,
        anonTableCode: anonTable.error?.code ?? null,
        anonRpcCode: anonRead.error?.code ?? null,
      },
      idempotency: {
        requestIdSuffix: suspendRequestId.slice(-6),
        replayAccepted: replay.ok,
        auditRows: replayAuditCount,
      },
      ingress: {
        suspended: { dashboard: heldDashboard, public: heldPublic, orderRows: 0 },
        manualHold: manualHoldIngress,
        reactivated: { orderCreated: reopenedOrder.ok, orderRows: await countOrders() },
      },
      immutableAuditEvidence: immutableAuditRows,
    }, null, 2))
  } catch (error) {
    primaryError = error
  }

  if (restaurantId) {
    const { error: controlDeleteError } = await service
      .from('tenant_service_controls')
      .delete()
      .eq('restaurant_id', restaurantId)
    if (controlDeleteError) throw controlDeleteError
    const { error: restaurantDeleteError } = await service
      .from('restaurants')
      .delete()
      .eq('id', restaurantId)
    if (restaurantDeleteError) throw restaurantDeleteError
  }

  const marker = restaurantId || randomUUID()
  const [{ count: restaurants }, { count: controls }, { count: orders }, { count: tables }, { count: categories }] = await Promise.all([
    service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', marker),
    service.from('tenant_service_controls').select('restaurant_id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
    service.from('menu_categories').select('id', { count: 'exact', head: true }).eq('restaurant_id', marker),
  ])
  console.log(JSON.stringify({
    cleanup: { restaurants, controls, orders, tables, categories },
    immutableAuditEvidence: immutableAuditRows,
  }))
  assert(
    restaurants === 0 && controls === 0 && orders === 0 && tables === 0 && categories === 0,
    'Runtime cleanup left mutable orphan rows',
  )
  if (primaryError) throw primaryError
}

void main()
