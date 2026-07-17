import { randomUUID } from 'node:crypto'
import { sendCustomerCampaign } from '@garsonless/application/campaigns'
import { createServiceClient } from '../src/client'
import { createCampaignApplicationPort } from '../src/campaign-application-port'
import { cancelOrderDB, markOrderPaidDB } from '../src/orders-update'
import { processDomainOutboxEvent, requestWelcomeBonus } from '../src/outbox-consumer-port'
import { createTableSessionPort } from '../src/table-command-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''
let otherRestaurantId = ''
let customerId = ''

async function eventFor(aggregateId: string, eventType: string) {
  const { data, error } = await service.from('domain_outbox')
    .select('id, event_type, idempotency_key')
    .eq('aggregate_id', aggregateId)
    .eq('event_type', eventType)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .single()
  if (error) throw error
  return data
}

async function main() {
  try {
    const { data: fixture, error: fixtureError } = await service.from('restaurants')
      .select('owner_id').eq('slug', 'test-cafe-b').single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const commonSettings = {
      loyalty: {
        stamp_enabled: true,
        stamp_goal: 10,
        points_enabled: true,
        points_per_lira: 1,
        points_redeem_rate: 10,
        welcome_bonus_points: 15,
        member_discount_pct: 0,
        scope: 'restaurant',
        earn_trigger: 'paid',
      },
    }
    const { data: restaurants, error: restaurantError } = await service.from('restaurants').insert([
      { owner_id: fixture.owner_id, slug: `outbox-${suffix}`, name: `Outbox ${suffix}`, settings: commonSettings },
      { owner_id: fixture.owner_id, slug: `outbox-other-${suffix}`, name: `Outbox other ${suffix}`, settings: commonSettings },
    ]).select('id, slug')
    if (restaurantError) throw restaurantError
    restaurantId = restaurants.find((row) => row.slug === `outbox-${suffix}`)?.id ?? ''
    otherRestaurantId = restaurants.find((row) => row.slug === `outbox-other-${suffix}`)?.id ?? ''
    assert(restaurantId && otherRestaurantId, 'Throwaway restaurants unavailable')

    const { data: customer, error: customerError } = await service.from('customers').insert({
      name: 'Outbox Runtime',
      phone: '+905321234567',
      email: `outbox-${suffix}@example.test`,
    }).select('id').single()
    if (customerError) throw customerError
    customerId = customer.id
    const association = await service.from('customer_restaurants').insert({
      customer_id: customerId,
      restaurant_id: restaurantId,
      source: 'activity',
    })
    if (association.error) throw association.error
    const consent = await service.from('customer_consents').insert({
      customer_id: customerId,
      restaurant_id: restaurantId,
      consent_type: 'marketing',
      granted_at: new Date().toISOString(),
      source: 'runtime',
    })
    if (consent.error) throw consent.error

    const { data: category, error: categoryError } = await service.from('menu_categories').insert({
      restaurant_id: restaurantId,
      name: 'Outbox category',
      position: 0,
    }).select('id').single()
    if (categoryError) throw categoryError
    const { data: item, error: itemError } = await service.from('menu_items').insert({
      category_id: category.id,
      name: 'Outbox item',
      price: 50,
      earns_stamp: true,
      position: 0,
    }).select('id').single()
    if (itemError) throw itemError
    const { data: tables, error: tablesError } = await service.from('tables').insert([
      { restaurant_id: restaurantId, label: 'Outbox 1' },
      { restaurant_id: restaurantId, label: 'Outbox 2' },
    ]).select('id')
    if (tablesError || tables.length !== 2) throw tablesError ?? new Error('Tables unavailable')

    const { data: session, error: sessionError } = await service.from('table_sessions').insert({
      restaurant_id: restaurantId,
      table_id: tables[0]!.id,
    }).select('id').single()
    if (sessionError) throw sessionError

    const paidOrderId = randomUUID()
    const compOrderId = randomUUID()
    const baseOrder = {
      restaurant_id: restaurantId,
      table_id: tables[0]!.id,
      table_session_id: session.id,
      session_id: randomUUID(),
      customer_id: customerId,
      items: [{ itemId: item.id, quantity: 2 }],
      total: 100,
      status: 'ready',
    }
    const ordersInsert = await service.from('orders').insert([
      { ...baseOrder, id: paidOrderId },
      { ...baseOrder, id: compOrderId, session_id: randomUUID(), total: 50, items: [{ itemId: item.id, quantity: 1 }] },
    ])
    if (ordersInsert.error) throw ordersInsert.error

    const paid = await markOrderPaidDB(paidOrderId, restaurantId, 'cash', fixture.owner_id)
    const comp = await markOrderPaidDB(compOrderId, restaurantId, 'comp', fixture.owner_id)
    assert(!paid.error && !comp.error, paid.error ?? comp.error ?? 'Settlement failed')

    const settledEvent = await eventFor(paidOrderId, 'order.settled')
    const duplicateOne = await processDomainOutboxEvent(settledEvent.id)
    const duplicateTwo = await processDomainOutboxEvent(settledEvent.id)
    assert(duplicateOne.ok && duplicateOne.value.duplicate, 'First settlement redelivery was not a receipt no-op')
    assert(duplicateTwo.ok && duplicateTwo.value.duplicate, 'Second settlement redelivery was not a receipt no-op')

    const [{ data: paidEarn }, { data: compEarn }] = await Promise.all([
      service.from('loyalty_transactions').select('type, delta, direction').eq('order_id', paidOrderId).eq('direction', 'earn'),
      service.from('loyalty_transactions').select('type, delta, direction').eq('order_id', compOrderId).eq('direction', 'earn'),
    ])
    assert((paidEarn ?? []).length === 2, 'Paid order did not create one points and one stamp row')
    assert((paidEarn ?? []).find((row) => row.type === 'points')?.delta === 100, 'Points amount mismatch')
    assert((paidEarn ?? []).find((row) => row.type === 'stamp')?.delta === 2, 'Stamp amount mismatch')
    assert((compEarn ?? []).length === 0, 'Comp settlement earned loyalty')

    const closed = await createTableSessionPort().closeSession({
      sessionId: session.id,
      restaurantId,
      abnormalReason: null,
    })
    assert(closed.ok && closed.value === 'closed_normal', 'Normal session close failed')
    const closedEvent = await eventFor(session.id, 'table_session.closed')
    await processDomainOutboxEvent(closedEvent.id)
    const { data: visits } = await service.from('loyalty_transactions')
      .select('id, delta').eq('session_id', session.id).eq('customer_id', customerId).eq('type', 'visit')
    assert((visits ?? []).length === 1 && visits?.[0]?.delta === 1, 'Visit was not credited exactly once')

    await Promise.all([
      requestWelcomeBonus({ customerId, restaurantId }),
      requestWelcomeBonus({ customerId, restaurantId }),
    ])
    const welcomeEvent = await eventFor(customerId, 'customer.welcome_bonus_requested')
    await processDomainOutboxEvent(welcomeEvent.id)
    const { data: welcome } = await service.from('loyalty_transactions')
      .select('id, delta').eq('customer_id', customerId).eq('restaurant_id', restaurantId).eq('reason', 'welcome')
    assert((welcome ?? []).length === 1 && welcome?.[0]?.delta === 15, 'Welcome bonus duplicate or amount mismatch')

    const { data: cancelSession, error: cancelSessionError } = await service.from('table_sessions').insert({
      restaurant_id: restaurantId,
      table_id: tables[1]!.id,
    }).select('id').single()
    if (cancelSessionError) throw cancelSessionError
    const cancelOrderId = randomUUID()
    const cancelInsert = await service.from('orders').insert({
      id: cancelOrderId,
      restaurant_id: restaurantId,
      table_id: tables[1]!.id,
      table_session_id: cancelSession.id,
      session_id: randomUUID(),
      customer_id: customerId,
      items: [],
      total: 20,
      status: 'pending',
    })
    if (cancelInsert.error) throw cancelInsert.error
    const redeemInsert = await service.from('loyalty_transactions').insert({
      customer_id: customerId,
      restaurant_id: restaurantId,
      scope_key: restaurantId,
      order_id: cancelOrderId,
      type: 'points',
      delta: -20,
      reason: 'redeem',
      direction: 'redeem',
    })
    if (redeemInsert.error) throw redeemInsert.error
    const cancelled = await cancelOrderDB(cancelOrderId, restaurantId, { reason: 'runtime', cancelledBy: fixture.owner_id })
    assert(!cancelled.error, cancelled.error ?? 'Cancel failed')
    const cancelledEvent = await eventFor(cancelOrderId, 'order.status_changed')
    await processDomainOutboxEvent(cancelledEvent.id)
    const { data: refunds } = await service.from('loyalty_transactions')
      .select('id, delta').eq('order_id', cancelOrderId).eq('type', 'points').eq('direction', 'refund')
    assert((refunds ?? []).length === 1 && refunds?.[0]?.delta === 20, 'Cancel refund was not exactly once')

    const actor = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['customers'],
    }
    const campaign = await sendCustomerCampaign(actor, {
      restaurantId,
      name: 'Outbox Runtime',
      message: 'Outbox runtime kampanya mesaji',
      audience: { segmentKind: 'all' },
    }, createCampaignApplicationPort())
    assert(campaign.ok && campaign.campaign.sentCount === 1, 'Campaign delivery did not complete')
    const campaignEvent = await eventFor(campaign.campaign.id, 'campaign.delivery_requested')
    const campaignRetry = await processDomainOutboxEvent(campaignEvent.id)
    assert(campaignRetry.ok && campaignRetry.value.duplicate, 'Campaign duplicate delivery was not suppressed')
    const [{ data: recipients }, { data: messages }] = await Promise.all([
      service.from('campaign_recipients').select('id, status, attempts').eq('campaign_id', campaign.campaign.id),
      service.from('message_events').select('id, event_type').eq('campaign_id', campaign.campaign.id),
    ])
    assert((recipients ?? []).length === 1 && recipients?.[0]?.status === 'sent' && recipients?.[0]?.attempts === 1, 'Recipient was sent more than once')
    assert((messages ?? []).length === 1 && messages?.[0]?.event_type === 'sent', 'Campaign terminal event duplicated')

    const crossTenant = await service.rpc('queue_campaign_delivery_atomic', {
      p_restaurant_id: otherRestaurantId,
      p_name: 'Cross tenant',
      p_message_body: 'Bu mesaj gonderilmemeli',
      p_segment_kind: 'all',
      p_builtin_segment: null,
      p_custom_segment_id: null,
      p_segment_definition: {},
      p_created_by: fixture.owner_id,
      p_contacts: [{ customerId, phone: '+905321234567' }],
      p_skipped_count: 0,
      p_segment_label: 'Cross tenant',
    })
    assert(crossTenant.error?.code === '42501', `Cross-tenant campaign recipient was not rejected: ${crossTenant.error?.code ?? 'none'}`)

    const { data: receipts } = await service.from('domain_outbox_receipts')
      .select('consumer, outbox_id')
      .in('consumer', ['loyalty-ledger', 'campaign-sms'])
      .in('outbox_id', [settledEvent.id, closedEvent.id, welcomeEvent.id, cancelledEvent.id, campaignEvent.id])

    console.log(JSON.stringify({
      settlement: { points: paidEarn?.find((row) => row.type === 'points')?.delta, stamps: paidEarn?.find((row) => row.type === 'stamp')?.delta, duplicateSuppressed: duplicateTwo.value.duplicate },
      comp: { earnRows: compEarn?.length ?? 0 },
      visit: { rows: visits?.length ?? 0, amount: visits?.[0]?.delta ?? 0 },
      welcome: { rows: welcome?.length ?? 0, amount: welcome?.[0]?.delta ?? 0 },
      cancellation: { refundRows: refunds?.length ?? 0, amount: refunds?.[0]?.delta ?? 0 },
      campaign: { id: campaign.campaign.id, sent: campaign.campaign.sentCount, recipientAttempts: recipients?.[0]?.attempts, terminalEvents: messages?.length ?? 0, duplicateSuppressed: campaignRetry.value.duplicate },
      crossTenantRpcCode: crossTenant.error?.code,
      durableReceipts: receipts?.length ?? 0,
    }, null, 2))
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    if (otherRestaurantId) await service.from('restaurants').delete().eq('id', otherRestaurantId)
    if (customerId) await service.from('customers').delete().eq('id', customerId)
    const [{ count: restaurants }, { count: customers }, { count: campaigns }, { count: ledger }, { count: outbox }] = await Promise.all([
      service.from('restaurants').select('id', { count: 'exact', head: true }).in('id', [restaurantId || randomUUID(), otherRestaurantId || randomUUID()]),
      service.from('customers').select('id', { count: 'exact', head: true }).eq('id', customerId || randomUUID()),
      service.from('campaigns').select('id', { count: 'exact', head: true }).in('restaurant_id', [restaurantId || randomUUID(), otherRestaurantId || randomUUID()]),
      service.from('loyalty_transactions').select('id', { count: 'exact', head: true }).in('restaurant_id', [restaurantId || randomUUID(), otherRestaurantId || randomUUID()]),
      service.from('domain_outbox').select('id', { count: 'exact', head: true }).in('restaurant_id', [restaurantId || randomUUID(), otherRestaurantId || randomUUID()]),
    ])
    console.log(JSON.stringify({ cleanup: { restaurants, customers, campaigns, ledger, outbox } }))
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ runtimeError: error instanceof Error ? error.message : error }, null, 2))
  process.exitCode = 1
})
