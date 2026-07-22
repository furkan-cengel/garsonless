import { createClient } from '@supabase/supabase-js'
import { listPlatformTenants, readPlatformTenant } from '@garsonless/application/platform-admin-tenants'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { createServiceClient } from '../src/client'
import { createPlatformAdminTenantReadPort } from '../src/platform-admin-tenant-read-port'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

type DirectoryRpc = (
  name: 'list_platform_admin_tenants' | 'read_platform_admin_tenant',
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>

const forbiddenKeys = new Set([
  'ownerId', 'ownerEmail', 'contactEmail', 'settings', 'provider',
  'providerCustomerRef', 'providerSubscriptionRef', 'providerInvoiceRef',
  'failureMessage', 'lastError', 'payload',
])

function projectionIsSafe(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(projectionIsSafe)
  if (!value || typeof value !== 'object') return true
  return Object.entries(value).every(([key, nested]) => !forbiddenKeys.has(key) && projectionIsSafe(nested))
}

async function main() {
  const service = createServiceClient()
  const serviceRpc = service.rpc.bind(service) as unknown as DirectoryRpc
  const anon = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anonRpc = anon.rpc.bind(anon) as unknown as DirectoryRpc
  const actor: PlatformAdminActorContext = {
    actor: 'platform-admin',
    userId: '11111111-1111-4111-8111-111111111111',
    role: 'superadmin',
    aal: 'aal2',
  }
  const port = createPlatformAdminTenantReadPort(serviceRpc)
  const active = await listPlatformTenants(actor, { lifecycle: 'active', pageSize: 25 }, port)
  const all = await listPlatformTenants(actor, { lifecycle: 'all', pageSize: 25 }, port)
  if (!active.ok || !all.ok) throw new Error('Tenant directory application read failed')
  const first = all.value.items[0] ?? null
  const detail = first ? await readPlatformTenant(actor, first.id, port) : null
  if (detail && (!detail.ok || !detail.value)) throw new Error('Tenant detail application read failed')

  const anonList = await anonRpc('list_platform_admin_tenants', {
    p_search: null, p_plan: null, p_subscription_status: null, p_lifecycle: 'active', p_limit: 1, p_offset: 0,
  })
  const anonDetail = await anonRpc('read_platform_admin_tenant', {
    p_restaurant_id: first?.id ?? '11111111-1111-4111-8111-111111111111',
  })
  const invalid = await serviceRpc('list_platform_admin_tenants', {
    p_search: null, p_plan: null, p_subscription_status: null, p_lifecycle: 'active', p_limit: 51, p_offset: 0,
  })
  const raw = await serviceRpc('list_platform_admin_tenants', {
    p_search: first?.slug ?? null, p_plan: null, p_subscription_status: null, p_lifecycle: 'all', p_limit: 10, p_offset: 0,
  })

  console.log(JSON.stringify({
    project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
    counts: { active: active.value.totalCount, all: all.value.totalCount },
    sample: first ? {
      idSuffix: first.id.slice(-6),
      slug: first.slug,
      plan: first.plan,
      subscriptionStatus: first.subscription?.status ?? null,
      invoiceCount: detail?.ok && detail.value ? detail.value.invoices.length : 0,
    } : null,
    publicBoundary: {
      anonListCode: anonList.error?.code ?? null,
      anonDetailCode: anonDetail.error?.code ?? null,
      invalidInputCode: invalid.error?.code ?? null,
    },
    safeProjection: projectionIsSafe(raw.data),
    readOnly: true,
  }, null, 2))
}

void main()
