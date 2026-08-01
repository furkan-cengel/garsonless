import { randomUUID } from 'node:crypto'
import {
  ensureCustomerIdentity,
  grantCustomerStoreCredit,
} from '@garsonless/application/customers'
import { createServiceClient } from '../src/client'
import { createCustomerApplicationPort } from '../src/customer-application-port'
import { createCustomerIdentityApplicationPort } from '../src/customer-auth-application-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const db = createServiceClient()
const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const phoneBase = String(Number.parseInt(suffix.slice(0, 8), 16) % 1_000_000_000).padStart(9, '0')
const phones = [0, 1, 2].map((offset) => `+905${String((Number(phoneBase) + offset) % 1_000_000_000).padStart(9, '0')}`)
const authUserIds: string[] = []
const restaurantIds: string[] = []
const customerIds: string[] = []

async function createAuthUser(label: string) {
  const { data, error } = await db.auth.admin.createUser({
    email: `slice1-${label}-${suffix}@example.test`,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error(`Auth fixture unavailable: ${label}`)
  authUserIds.push(data.user.id)
  return data.user
}

async function createCustomer(input: { email?: string; phone?: string; name: string }) {
  const { data, error } = await db.from('customers').insert({
    email: input.email ?? null,
    phone: input.phone ?? null,
    name: input.name,
    verified_at: new Date().toISOString(),
  }).select('id').single()
  if (error) throw error
  customerIds.push(data.id)
  return data.id
}

async function cleanup() {
  if (restaurantIds.length > 0) {
    const { data: requests } = await db.from('manual_store_credit_requests')
      .select('request_id, loyalty_transaction_id')
      .in('restaurant_id', restaurantIds)
    const requestIds = (requests ?? []).map((row) => row.request_id)
    const transactionIds = (requests ?? []).flatMap((row) => row.loyalty_transaction_id ? [row.loyalty_transaction_id] : [])
    if (requestIds.length > 0) {
      await db.from('loyalty_transactions').update({ manual_credit_request_id: null }).in('manual_credit_request_id', requestIds)
      await db.from('manual_store_credit_requests').update({ loyalty_transaction_id: null }).in('request_id', requestIds)
    }
    if (transactionIds.length > 0) await db.from('loyalty_transactions').delete().in('id', transactionIds)
    if (requestIds.length > 0) await db.from('manual_store_credit_requests').delete().in('request_id', requestIds)
  }
  if (customerIds.length > 0) {
    await db.from('customer_identity_merge_audit').delete().in('survivor_customer_id', customerIds)
    await db.from('customer_identity_merge_audit').delete().in('merged_customer_id', customerIds)
    await db.from('customers').update({ merged_into_customer_id: null, merged_at: null }).in('id', customerIds)
  }
  for (const restaurantId of restaurantIds) await db.from('restaurants').delete().eq('id', restaurantId)
  for (const customerId of customerIds) await db.from('customers').delete().eq('id', customerId)
  for (const authUserId of authUserIds) await db.auth.admin.deleteUser(authUserId)
}

async function main() {
  let evidence: Record<string, unknown>
  try {
    const owner = await createAuthUser('owner')
    const identityUser = await createAuthUser('identity')
    const conflictUser = await createAuthUser('conflict')
    const reviewUser = await createAuthUser('review')

    const loyaltySettings = {
      loyalty: {
        stamp_enabled: true,
        stamp_goal: 10,
        points_enabled: true,
        points_per_lira: 1,
        points_redeem_rate: 10,
        welcome_bonus_points: 0,
        member_discount_pct: 0,
        scope: 'restaurant',
        earn_trigger: 'paid',
      },
    }
    const { data: restaurants, error: restaurantError } = await db.from('restaurants').insert([
      { owner_id: owner.id, slug: `slice1-${suffix}`, name: 'Slice 1 Runtime', plan: 'pro', settings: loyaltySettings },
      { owner_id: owner.id, slug: `slice1-other-${suffix}`, name: 'Slice 1 Other', plan: 'pro', settings: loyaltySettings },
    ]).select('id, slug')
    if (restaurantError || restaurants.length !== 2) throw restaurantError ?? new Error('Restaurant fixtures unavailable')
    const restaurantId = restaurants.find((row) => row.slug === `slice1-${suffix}`)!.id
    const otherRestaurantId = restaurants.find((row) => row.slug === `slice1-other-${suffix}`)!.id
    restaurantIds.push(restaurantId, otherRestaurantId)

    const creditCustomerId = await createCustomer({ name: 'Slice 1 Credit' })
    const foreignCustomerId = await createCustomer({ name: 'Slice 1 Foreign' })
    const association = await db.from('customer_restaurants').insert([
      { customer_id: creditCustomerId, restaurant_id: restaurantId, source: 'activity' },
      { customer_id: foreignCustomerId, restaurant_id: otherRestaurantId, source: 'activity' },
    ])
    if (association.error) throw association.error

    const actor = {
      actor: 'dashboard-member' as const,
      userId: owner.id,
      restaurantId,
      permissions: ['customers'],
      isOwner: true,
    }
    const customerPort = createCustomerApplicationPort()
    const requestId = randomUUID()
    const first = await grantCustomerStoreCredit(actor, {
      restaurantId, customerId: creditCustomerId, requestId, points: 125, note: 'slice1-runtime',
    }, customerPort)
    const replay = await grantCustomerStoreCredit(actor, {
      restaurantId, customerId: creditCustomerId, requestId, points: 125, note: 'slice1-runtime',
    }, customerPort)
    const conflict = await grantCustomerStoreCredit(actor, {
      restaurantId, customerId: creditCustomerId, requestId, points: 126, note: 'slice1-runtime',
    }, customerPort)
    const foreign = await grantCustomerStoreCredit(actor, {
      restaurantId, customerId: foreignCustomerId, requestId: randomUUID(), points: 50,
    }, customerPort)
    assert(first.ok && !first.value.replayed && first.value.granted === 125, 'First manual credit was not applied once')
    assert(replay.ok && replay.value.replayed && replay.value.granted === 125, 'Manual credit replay was not stable')
    assert(!conflict.ok && conflict.error === 'İstek kimliği farklı bir işlem için kullanılmış', 'Request conflict did not fail closed')
    assert(!foreign.ok, 'Cross-tenant customer credit was accepted')

    const concurrentRequestId = randomUUID()
    const concurrent = await Promise.all([
      grantCustomerStoreCredit(actor, {
        restaurantId, customerId: creditCustomerId, requestId: concurrentRequestId, points: 75,
      }, customerPort),
      grantCustomerStoreCredit(actor, {
        restaurantId, customerId: creditCustomerId, requestId: concurrentRequestId, points: 75,
      }, customerPort),
    ])
    assert(concurrent.every((result) => result.ok), 'Concurrent replay returned an error')
    assert(concurrent.filter((result) => result.ok && result.value.replayed).length === 1, 'Concurrent replay did not yield exactly one replay')
    const { count: manualLedgerCount } = await db.from('loyalty_transactions')
      .select('id', { count: 'exact', head: true })
      .in('manual_credit_request_id', [requestId, concurrentRequestId])
    assert(manualLedgerCount === 2, 'Manual credit request created duplicate ledger rows')

    const mergeEmail = identityUser.email!
    const emailCustomerId = await createCustomer({ email: mergeEmail, name: 'Email Identity' })
    const phoneCustomerId = await createCustomer({ phone: phones[0]!, name: 'Legacy Phone PII' })
    const mergeFixtures = await Promise.all([
      db.from('customer_restaurants').insert({ customer_id: phoneCustomerId, restaurant_id: restaurantId, source: 'activity' }),
      db.from('customer_consents').insert({
        customer_id: phoneCustomerId, restaurant_id: restaurantId, consent_type: 'contact_data',
        granted_at: new Date().toISOString(), source: 'join',
      }),
      db.from('loyalty_transactions').insert({
        customer_id: phoneCustomerId, restaurant_id: restaurantId, scope_key: restaurantId,
        type: 'points', delta: 11, direction: 'earn', reason: 'slice1_legacy',
      }),
    ])
    for (const result of mergeFixtures) if (result.error) throw result.error

    const merged = await ensureCustomerIdentity({
      authUserId: identityUser.id,
      email: mergeEmail,
      phone: phones[0]!,
      userMetadata: { full_name: 'Verified Identity' },
      appMetadata: {},
    }, {}, createCustomerIdentityApplicationPort())
    assert(merged.ok && merged.customer.id === emailCustomerId, 'Verified identity did not select the email survivor')

    const [{ data: loser }, { data: movedLedger }, { data: movedConsent }, { data: movedAssociation }, { data: mergeAudit }] = await Promise.all([
      db.from('customers').select('auth_user_id, email, phone, name, merged_into_customer_id, merged_at').eq('id', phoneCustomerId).single(),
      db.from('loyalty_transactions').select('customer_id').eq('reason', 'slice1_legacy').single(),
      db.from('customer_consents').select('customer_id').eq('restaurant_id', restaurantId).eq('customer_id', emailCustomerId).eq('consent_type', 'contact_data').single(),
      db.from('customer_restaurants').select('customer_id').eq('restaurant_id', restaurantId).eq('customer_id', emailCustomerId).single(),
      db.from('customer_identity_merge_audit').select('survivor_customer_id, merged_customer_id, moved_ledger_rows, merged_consents').eq('merged_customer_id', phoneCustomerId).single(),
    ])
    assert(loser?.merged_into_customer_id === emailCustomerId && Boolean(loser.merged_at), 'Merged identity tombstone is incomplete')
    assert(loser.auth_user_id === null && loser.email === null && loser.phone === null && loser.name === null, 'Merged identity retained PII')
    assert(movedLedger?.customer_id === emailCustomerId, 'Ledger history did not move to survivor')
    assert(movedConsent?.customer_id === emailCustomerId, 'Consent did not move to survivor')
    assert(movedAssociation?.customer_id === emailCustomerId, 'Tenant association did not move to survivor')
    assert(mergeAudit?.survivor_customer_id === emailCustomerId, 'Merge audit survivor mismatch')
    assert(mergeAudit?.merged_customer_id === phoneCustomerId && mergeAudit.moved_ledger_rows === 1, 'Merge audit counts mismatch')

    const protectedCustomerId = await createCustomer({ email: conflictUser.email!, name: 'Protected Identity' })
    const linkProtected = await db.from('customers').update({ auth_user_id: conflictUser.id }).eq('id', protectedCustomerId)
    if (linkProtected.error) throw linkProtected.error
    const otherAuth = await createAuthUser('other-auth')
    const protectedClaim = await db.rpc('claim_customer_identity_atomic', {
      p_auth_user_id: otherAuth.id,
      p_email: conflictUser.email!,
      p_name: null,
      p_verified_phone: null,
    })
    assert(protectedClaim.error?.code === '42501', 'Cross-auth identity claim was not rejected')

    const reviewEmailCustomer = await createCustomer({ email: reviewUser.email!, name: 'Review Email' })
    const reviewPhoneCustomer = await createCustomer({ phone: phones[1]!, name: 'Review Phone' })
    const reviewLedger = await db.from('loyalty_transactions').insert([
      { customer_id: reviewEmailCustomer, restaurant_id: restaurantId, scope_key: restaurantId, type: 'points', delta: 10, direction: 'earn', reason: 'welcome' },
      { customer_id: reviewPhoneCustomer, restaurant_id: restaurantId, scope_key: restaurantId, type: 'points', delta: 10, direction: 'earn', reason: 'welcome' },
    ])
    if (reviewLedger.error) throw reviewLedger.error
    const reviewClaim = await db.rpc('claim_customer_identity_atomic', {
      p_auth_user_id: reviewUser.id,
      p_email: reviewUser.email!,
      p_name: null,
      p_verified_phone: phones[1]!,
    })
    assert(reviewClaim.error?.code === 'GL002', 'Ambiguous loyalty merge did not require review')

    evidence = {
      ok: true,
      manualCredit: {
        firstApplied: first.ok && !first.value.replayed,
        replayStable: replay.ok && replay.value.replayed,
        conflictRejected: !conflict.ok,
        crossTenantRejected: !foreign.ok,
        concurrentSingleEffect: manualLedgerCount === 2,
      },
      identity: {
        verifiedMerge: merged.ok,
        loserPiiCleared: loser?.email === null && loser?.phone === null && loser?.name === null,
        ledgerMoved: movedLedger?.customer_id === emailCustomerId,
        consentMoved: movedConsent?.customer_id === emailCustomerId,
        tenantAssociationMoved: movedAssociation?.customer_id === emailCustomerId,
        auditRecorded: mergeAudit?.merged_customer_id === phoneCustomerId,
        crossAuthRejected: protectedClaim.error?.code === '42501',
        loyaltyConflictRequiresReview: reviewClaim.error?.code === 'GL002',
      },
      smsSent: false,
      syntheticOnly: true,
    }
  } finally {
    await cleanup()
  }

  const [restaurantResidue, customerResidue, ledgerResidue, requestResidue, users] = await Promise.all([
    db.from('restaurants').select('id', { count: 'exact', head: true }).ilike('slug', 'slice1-%'),
    db.from('customers').select('id', { count: 'exact', head: true }).ilike('email', 'slice1-%@example.test'),
    db.from('loyalty_transactions').select('id', { count: 'exact', head: true }).eq('reason', 'slice1_legacy'),
    db.from('manual_store_credit_requests').select('request_id', { count: 'exact', head: true }).eq('note', 'slice1-runtime'),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  const authResidue = users.data.users.filter((user) => user.email?.startsWith('slice1-') && user.email.endsWith('@example.test')).length
  const cleanupCounts = {
    restaurants: restaurantResidue.count ?? -1,
    customers: customerResidue.count ?? -1,
    ledger: ledgerResidue.count ?? -1,
    requests: requestResidue.count ?? -1,
    authUsers: authResidue,
  }
  assert(Object.values(cleanupCounts).every((count) => count === 0), `Synthetic cleanup incomplete: ${JSON.stringify(cleanupCounts)}`)
  console.log(JSON.stringify({ ...evidence, cleanup: cleanupCounts }, null, 2))
}

void main()
