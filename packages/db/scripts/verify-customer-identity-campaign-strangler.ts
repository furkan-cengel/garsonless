import { randomUUID } from 'node:crypto'
import {
  ensureCustomerIdentity,
  updateCustomerConsent,
} from '@garsonless/application/customers'
import {
  previewCustomerCampaign,
  sendCustomerCampaign,
} from '@garsonless/application/campaigns'
import { createServiceClient } from '../src/client'
import {
  createCustomerConsentApplicationPort,
  createCustomerIdentityApplicationPort,
} from '../src/customer-auth-application-port'
import { createCampaignApplicationPort } from '../src/campaign-application-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''
let customerId = ''
let authUserId = ''

async function main() {
  try {
    const { data: fixture, error: fixtureError } = await service
      .from('restaurants')
      .select('owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .insert({
        owner_id: fixture.owner_id,
        slug: `identity-campaign-${suffix}`,
        name: `Identity campaign ${suffix}`,
        settings: {
          loyalty: {
            stamp_enabled: false,
            points_enabled: true,
            points_per_lira: 1,
            points_redeem_rate: 10,
            member_discount_pct: 0,
            welcome_bonus_points: 15,
            scope: 'restaurant',
            earn_trigger: 'paid',
          },
        },
      })
      .select('id')
      .single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const email = `identity-campaign-${suffix}@example.test`
    const { data: auth, error: authError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: 'Runtime Identity' },
    })
    if (authError || !auth.user) throw authError ?? new Error('Auth fixture unavailable')
    authUserId = auth.user.id

    const identity = {
      authUserId,
      email: auth.user.email ?? null,
      userMetadata: auth.user.user_metadata ?? {},
      appMetadata: auth.user.app_metadata ?? {},
    }
    const identityPort = createCustomerIdentityApplicationPort()
    const first = await ensureCustomerIdentity(identity, {
      restaurantId,
      consent: true,
      marketingConsent: false,
    }, identityPort)
    assert(first.ok, 'First identity link failed')
    customerId = first.customer.id

    const retry = await ensureCustomerIdentity(identity, {
      restaurantId,
      consent: true,
      marketingConsent: false,
    }, identityPort)
    assert(retry.ok && retry.customer.id === customerId, 'Identity retry was not idempotent')

    const [{ count: customerCount }, { data: roleUser }, { data: associations }, { data: consentRows }, { data: welcomeRows }] = await Promise.all([
      service.from('customers').select('id', { count: 'exact', head: true }).eq('email', email),
      service.auth.admin.getUserById(authUserId),
      service.from('customer_restaurants').select('customer_id, restaurant_id, source').eq('customer_id', customerId).eq('restaurant_id', restaurantId),
      service.from('customer_consents').select('consent_type, granted_at, revoked_at').eq('customer_id', customerId).eq('restaurant_id', restaurantId),
      service.from('loyalty_transactions').select('id, delta, reason').eq('customer_id', customerId).eq('restaurant_id', restaurantId).eq('reason', 'welcome'),
    ])
    assert(customerCount === 1, 'Identity retry created duplicate customers')
    assert(roleUser.user?.app_metadata?.['user_type'] === 'customer', 'Customer app_metadata stamp missing')
    assert((associations ?? []).length === 1, 'Customer restaurant association mismatch')
    assert((welcomeRows ?? []).length === 1 && Number(welcomeRows?.[0]?.delta) === 15, 'Welcome bonus was not exactly once')
    assert((consentRows ?? []).length === 1 && consentRows?.[0]?.consent_type === 'contact_data', 'Only affirmative contact consent should exist')

    await service.from('customers').update({ phone: '+905321234567' }).eq('id', customerId)
    const customerContext = {
      actor: 'customer-member' as const,
      authUserId,
      customerId,
      restaurantId,
    }
    const marketing = await updateCustomerConsent(customerContext, {
      restaurantId,
      grant: true,
      consentType: 'marketing',
    }, createCustomerConsentApplicationPort())
    assert(marketing.ok && marketing.value.marketingConsentGiven, 'Marketing consent command failed')

    const dashboardActor = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['customers'],
    }
    const campaignPort = createCampaignApplicationPort()
    const preview = await previewCustomerCampaign(dashboardActor, {
      restaurantId,
      audience: { segmentKind: 'all' },
    }, campaignPort)
    assert(preview.ok && preview.value.totalCandidates === 1 && preview.value.eligibleRecipients === 1, 'Campaign audience mismatch')

    const sent = await sendCustomerCampaign(dashboardActor, {
      restaurantId,
      name: 'Runtime Campaign',
      message: 'Runtime kampanya mesaji',
      audience: { segmentKind: 'all' },
    }, campaignPort)
    assert(sent.ok && sent.campaign.sentCount === 1, 'Campaign command failed')

    const crossTenant = await previewCustomerCampaign(dashboardActor, {
      restaurantId: randomUUID(),
      audience: { segmentKind: 'all' },
    }, campaignPort)
    assert(!crossTenant.ok && crossTenant.error === 'Not authorized', 'Cross-tenant campaign was not rejected')

    console.log(JSON.stringify({
      identity: {
        customerId,
        retrySameCustomer: retry.customer.id === customerId,
        customerRows: customerCount,
        appMetadataUserType: roleUser.user?.app_metadata?.['user_type'],
        restaurantAssociations: associations?.length ?? 0,
      },
      welcomeBonus: {
        rows: welcomeRows?.length ?? 0,
        amount: Number(welcomeRows?.[0]?.delta ?? 0),
      },
      consent: {
        firstLoginTypes: consentRows?.map((row) => row.consent_type) ?? [],
        snapshot: marketing.value,
      },
      campaign: {
        preview: preview.value,
        id: sent.campaign.id,
        sentCount: sent.campaign.sentCount,
        failedCount: sent.campaign.failedCount,
      },
      crossTenantRejected: !crossTenant.ok,
    }, null, 2))
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    if (customerId) await service.from('customers').delete().eq('id', customerId)
    if (authUserId) await service.auth.admin.deleteUser(authUserId)
    const [{ count: restaurantOrphans }, { count: customerOrphans }, { count: campaignOrphans }, { count: consentOrphans }, { count: associationOrphans }] = await Promise.all([
      service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId || randomUUID()),
      service.from('customers').select('id', { count: 'exact', head: true }).eq('id', customerId || randomUUID()),
      service.from('campaigns').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId || randomUUID()),
      service.from('customer_consents').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId || randomUUID()),
      service.from('customer_restaurants').select('customer_id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId || randomUUID()),
    ])
    console.log(JSON.stringify({ cleanup: { restaurantOrphans, customerOrphans, campaignOrphans, consentOrphans, associationOrphans } }))
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ runtimeError: error instanceof Error ? error.message : error }, null, 2))
  process.exitCode = 1
})
