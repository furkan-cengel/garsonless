import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  erasePlatformTenantPrivacyData,
  exportPlatformTenantPrivacyData,
  type PlatformTenantPrivacyPort,
} from '@garsonless/application/platform-admin-privacy'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { createPlatformAdminPrivacyPort } from '../src/platform-admin-privacy-port'
import type { Database } from '../src/types.gen'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type RawRpc = (
  name: 'export_platform_admin_tenant_privacy_data' | 'erase_platform_admin_tenant_privacy_data',
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
const created = { restaurants: [] as string[], customer: '', tableSessions: [] as string[], tables: [] as string[], orders: [] as string[] }

async function main() {
  let primaryError: unknown = null
  try {
    const [{ data: ownerFixture, error: ownerError }, { data: identity, error: identityError }] = await Promise.all([
      service.from('restaurants').select('owner_id').is('deleted_at', null).limit(1).single(),
      service.from('platform_admin_users').select('user_id,role,status').eq('role', 'superadmin').eq('status', 'active').limit(1).single(),
    ])
    if (ownerError || !ownerFixture?.owner_id) throw ownerError ?? new Error('DEV owner fixture unavailable')
    if (identityError || !identity) throw identityError ?? new Error('Active DEV superadmin unavailable')
    const actor: PlatformAdminActorContext = { actor: 'platform-admin', userId: identity.user_id, role: 'superadmin', aal: 'aal2' }

    const { data: restaurants, error: restaurantsError } = await service.from('restaurants').insert([
      { owner_id: ownerFixture.owner_id, name: `Privacy A ${suffix}`, slug: `privacy-a-${suffix}` },
      { owner_id: ownerFixture.owner_id, name: `Privacy B ${suffix}`, slug: `privacy-b-${suffix}` },
    ]).select('id')
    if (restaurantsError || !restaurants || restaurants.length !== 2) throw restaurantsError ?? new Error('Throwaway tenants unavailable')
    created.restaurants.push(...restaurants.map((item) => item.id))
    const [tenantA, tenantB] = created.restaurants

    const { data: tables, error: tablesError } = await service.from('tables').insert([
      { restaurant_id: tenantA, label: 'Privacy A masa' },
      { restaurant_id: tenantB, label: 'Privacy B masa' },
    ]).select('id,restaurant_id')
    if (tablesError || !tables || tables.length !== 2) throw tablesError ?? new Error('Throwaway tables unavailable')
    created.tables.push(...tables.map((item) => item.id))
    const tableA = tables.find((item) => item.restaurant_id === tenantA)?.id
    const tableB = tables.find((item) => item.restaurant_id === tenantB)?.id
    assert(tableA && tableB, 'Tenant tables were not resolved')

    const { data: sessions, error: sessionsError } = await service.from('table_sessions').insert([
      { restaurant_id: tenantA, table_id: tableA },
      { restaurant_id: tenantB, table_id: tableB },
    ]).select('id,restaurant_id')
    if (sessionsError || !sessions || sessions.length !== 2) throw sessionsError ?? new Error('Throwaway sessions unavailable')
    created.tableSessions.push(...sessions.map((item) => item.id))
    const sessionA = sessions.find((item) => item.restaurant_id === tenantA)?.id
    assert(sessionA, 'Tenant A session was not resolved')

    const markerEmail = `privacy-${suffix}@example.invalid`
    const markerPhone = `+90555${suffix.replace(/[^0-9]/g, '').padEnd(7, '0').slice(0, 7)}`
    const { data: customer, error: customerError } = await service.from('customers').insert({ name: `Privacy Customer ${suffix}`, email: markerEmail, phone: markerPhone }).select('id').single()
    if (customerError || !customer) throw customerError ?? new Error('Throwaway customer unavailable')
    created.customer = customer.id

    const [{ error: linksError }, { error: consentError }, { data: order, error: orderError }, { error: billingError }] = await Promise.all([
      service.from('customer_restaurants').insert([
        { customer_id: customer.id, restaurant_id: tenantA, source: 'activity' },
        { customer_id: customer.id, restaurant_id: tenantB, source: 'activity' },
      ]),
      service.from('customer_consents').insert({ customer_id: customer.id, restaurant_id: tenantA, consent_type: 'marketing', granted_at: new Date().toISOString(), source: 'runtime.phase69' }),
      service.from('orders').insert({ customer_id: customer.id, restaurant_id: tenantA, session_id: sessionA, table_session_id: sessionA, table_id: tableA, total: 125, items: [{ name: 'Privacy fixture', quantity: 1, price: 125 }] }).select('id').single(),
      service.from('billing_customers').insert({ restaurant_id: tenantA, contact_email: `billing-${suffix}@example.invalid`, legal_name: `Privacy Billing ${suffix}` }),
    ])
    if (linksError || consentError || orderError || billingError || !order) throw linksError ?? consentError ?? orderError ?? billingError ?? new Error('Throwaway relation unavailable')
    created.orders.push(order.id)
    const [{ error: loyaltyError }, { error: shareError }] = await Promise.all([
      service.from('loyalty_transactions').insert({ customer_id: customer.id, restaurant_id: tenantA, order_id: order.id, type: 'points', delta: 12, reason: 'runtime.phase69', scope_key: randomUUID() }),
      service.from('payment_shares').insert({ customer_id: customer.id, restaurant_id: tenantA, table_session_id: sessionA, amount: 125, label: 'Privacy Customer' }),
    ])
    if (loyaltyError || shareError) throw loyaltyError ?? shareError

    let deniedCalls = 0
    const deniedPort: PlatformTenantPrivacyPort = {
      async readOperations() { deniedCalls += 1; throw new Error('Denied actor reached persistence') },
      async exportData() { deniedCalls += 1; throw new Error('Denied actor reached persistence') },
      async eraseData() { deniedCalls += 1; throw new Error('Denied actor reached persistence') },
    }
    const denied = await exportPlatformTenantPrivacyData({ ...actor, role: 'ops' }, { restaurantId: tenantA, reason: 'Ops rolü PII dışa aktaramaz', requestId: randomUUID() }, deniedPort)
    assert(!denied.ok && denied.error === 'Not authorized' && deniedCalls === 0, 'Non-superadmin reached privacy persistence')

    const anon = createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
    const anonRpc = anon.rpc.bind(anon) as unknown as RawRpc
    const anonExport = await anonRpc('export_platform_admin_tenant_privacy_data', { p_restaurant_id: tenantA, p_actor_user_id: actor.userId, p_actor_role: actor.role, p_reason: 'Anonymous caller must be rejected', p_request_id: randomUUID() })
    const rawRpc = service.rpc.bind(service) as unknown as RawRpc
    const forged = await rawRpc('export_platform_admin_tenant_privacy_data', { p_restaurant_id: tenantA, p_actor_user_id: actor.userId, p_actor_role: 'ops', p_reason: 'Forged actor role must be rejected', p_request_id: randomUUID() })
    const invalid = await rawRpc('export_platform_admin_tenant_privacy_data', { p_restaurant_id: tenantA, p_actor_user_id: actor.userId, p_actor_role: actor.role, p_reason: 'short', p_request_id: randomUUID() })
    const { error: anonTableError } = await anon.from('platform_tenant_privacy_operations').select('id').limit(1)
    assert(anonExport.error?.code === '42501' && forged.error?.code === '42501' && anonTableError?.code === '42501', 'Privacy authorization failed open')
    assert(invalid.error?.code === '22023', 'Invalid privacy input reached persistence')

    const port = createPlatformAdminPrivacyPort()
    const exportRequestId = randomUUID()
    const exported = await exportPlatformTenantPrivacyData(actor, { restaurantId: tenantA, reason: 'Doğrulanmış müşteri veri erişim başvurusu', requestId: exportRequestId }, port)
    assert(exported.ok && exported.value.document.customers.length === 1, 'Privacy export did not include tenant customer')
    assert(exported.value.document.customers[0]?.email === markerEmail, 'Transient export did not contain requested PII')
    const { data: storedExport, error: storedExportError } = await service.from('platform_tenant_privacy_operations').select('result_summary').eq('request_id', exportRequestId).single()
    if (storedExportError || !storedExport) throw storedExportError ?? new Error('Export evidence unavailable')
    assert(!JSON.stringify(storedExport.result_summary).includes(markerEmail), 'Persistent export evidence contains customer PII')

    const eraseRequestId = randomUUID()
    const erased = await erasePlatformTenantPrivacyData(actor, { restaurantId: tenantA, reason: 'Doğrulanmış müşteri silme başvurusu uygulandı', confirmation: 'KVKK SİL', requestId: eraseRequestId }, port)
    assert(erased.ok && !erased.value.duplicate, 'Tenant privacy erasure failed')
    const replay = await erasePlatformTenantPrivacyData(actor, { restaurantId: tenantA, reason: 'Doğrulanmış müşteri silme başvurusu uygulandı', confirmation: 'KVKK SİL', requestId: eraseRequestId }, port)
    assert(replay.ok && replay.value.duplicate, 'Privacy erasure replay was not idempotent')
    const [{ count: replayOperationRows }, { count: replayAuditRows }] = await Promise.all([
      service.from('platform_tenant_privacy_operations').select('*', { count: 'exact', head: true }).eq('request_id', eraseRequestId),
      service.from('platform_admin_audit_log').select('*', { count: 'exact', head: true }).eq('request_id', eraseRequestId),
    ])
    assert(replayOperationRows === 1 && replayAuditRows === 1, 'Privacy erasure replay wrote duplicate evidence')

    const [{ data: preservedOrder }, { count: tenantALinks }, { count: tenantAConsents }, { count: tenantALoyalty }, { count: billingRows }, { data: sharedCustomer }] = await Promise.all([
      service.from('orders').select('id,customer_id,total').eq('id', order.id).single(),
      service.from('customer_restaurants').select('*', { count: 'exact', head: true }).eq('restaurant_id', tenantA),
      service.from('customer_consents').select('*', { count: 'exact', head: true }).eq('restaurant_id', tenantA),
      service.from('loyalty_transactions').select('*', { count: 'exact', head: true }).eq('restaurant_id', tenantA),
      service.from('billing_customers').select('*', { count: 'exact', head: true }).eq('restaurant_id', tenantA),
      service.from('customers').select('email,phone,name').eq('id', customer.id).single(),
    ])
    assert(preservedOrder?.customer_id === null && preservedOrder.total === 125, 'Operational order was removed or retained PII')
    assert(tenantALinks === 0 && tenantAConsents === 0 && tenantALoyalty === 0, 'Tenant PII relationships survived erasure')
    assert(billingRows === 1, 'Fiscal billing record was removed')
    assert(sharedCustomer?.email === markerEmail, 'Shared global customer was anonymized while another tenant still referenced it')

    const eraseB = await erasePlatformTenantPrivacyData(actor, { restaurantId: tenantB, reason: 'İkinci tenant bağlantısı için doğrulanmış silme', confirmation: 'KVKK SİL', requestId: randomUUID() }, port)
    assert(eraseB.ok, 'Second tenant erasure failed')
    const { data: anonymizedCustomer, error: anonymizedError } = await service.from('customers').select('email,phone,name,auth_user_id,verified_at').eq('id', customer.id).single()
    if (anonymizedError || !anonymizedCustomer) throw anonymizedError ?? new Error('Anonymized customer unavailable')
    assert(Object.values(anonymizedCustomer).every((value) => value === null), 'Unreferenced global customer PII was not anonymized')

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      authorization: { deniedApplication: !denied.ok, persistenceCalls: deniedCalls, anonRpcCode: anonExport.error?.code, anonTableCode: anonTableError.code, forgedRoleCode: forged.error?.code, invalidInputCode: invalid.error?.code },
      export: { customerCount: exported.value.document.customers.length, containsRequestedPii: true, persistedEvidenceContainsPii: false },
      erase: { replayDuplicate: replay.value.duplicate, replayOperationRows, replayAuditRows, tenantLinks: tenantALinks, tenantConsents: tenantAConsents, tenantLoyalty: tenantALoyalty, orderPreserved: preservedOrder.id === order.id, orderCustomerDetached: preservedOrder.customer_id === null, billingRowsPreserved: billingRows },
      sharedIdentity: { preservedWhileReferenced: sharedCustomer.email === markerEmail, anonymizedAfterLastTenant: true },
    }, null, 2))
  } catch (error) {
    console.error('privacy-runtime-primary-error', JSON.stringify(error, null, 2))
    primaryError = error instanceof Error ? error : new Error(JSON.stringify(error))
  }

  const cleanupErrors: string[] = []
  async function cleanup(result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result
    if (error) cleanupErrors.push(error.message)
  }
  for (const restaurantId of created.restaurants) {
    await cleanup(service.from('platform_tenant_privacy_operations').delete().eq('restaurant_id', restaurantId))
  }
  if (created.tableSessions.length) await cleanup(service.from('payment_shares').delete().in('table_session_id', created.tableSessions))
  if (created.orders.length) await cleanup(service.from('orders').delete().in('id', created.orders))
  if (created.restaurants.length) await cleanup(service.from('orders').delete().in('restaurant_id', created.restaurants))
  if (created.tableSessions.length) await cleanup(service.from('table_sessions').delete().in('id', created.tableSessions))
  if (created.tables.length) await cleanup(service.from('tables').delete().in('id', created.tables))
  if (created.customer) {
    await cleanup(service.from('customer_restaurants').delete().eq('customer_id', created.customer))
    await cleanup(service.from('customers').delete().eq('id', created.customer))
  }
  if (created.restaurants.length) {
    await cleanup(service.from('billing_customers').delete().in('restaurant_id', created.restaurants))
    await cleanup(service.from('restaurants').delete().in('id', created.restaurants))
  }
  const [{ count: tenantRows }, { count: customerRows }, { count: operationRows }] = await Promise.all([
    service.from('restaurants').select('*', { count: 'exact', head: true }).in('id', created.restaurants.length ? created.restaurants : [randomUUID()]),
    service.from('customers').select('*', { count: 'exact', head: true }).eq('id', created.customer || randomUUID()),
    service.from('platform_tenant_privacy_operations').select('*', { count: 'exact', head: true }).in('restaurant_id', created.restaurants.length ? created.restaurants : [randomUUID()]),
  ])
  console.log(JSON.stringify({ cleanup: { tenants: tenantRows, customers: customerRows, privacyOperations: operationRows, errors: cleanupErrors } }))
  if (primaryError) throw primaryError
  assert(cleanupErrors.length === 0 && tenantRows === 0 && customerRows === 0 && operationRows === 0, 'Privacy runtime cleanup left mutable rows')
}

void main()
