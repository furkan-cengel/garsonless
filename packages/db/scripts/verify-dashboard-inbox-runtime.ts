/**
 * Real DEV runtime matrix for the durable dashboard notification inbox
 * (roadmap Faz 4, slice 1). Creates a throwaway restaurant owned by the
 * test fixture owner, drives real outbox events through the actual consumer
 * + port, asserts idempotency/preference/RLS behaviour, then cleans up to
 * zero orphans. Tenant fixtures are never mutated.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'
import { consumeDashboardInbox } from '@garsonless/application/notifications'
import {
  createDashboardInboxPort,
  countUnreadInboxNotifications,
  listPendingDashboardInboxEventIds,
  listInboxNotifications,
  markInboxNotificationsRead,
} from '../src/dashboard-inbox-port'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const fixtureSlug = process.env.INBOX_TEST_RESTAURANT_SLUG ?? 'test-cafe-b'

assert(url, 'NEXT_PUBLIC_SUPABASE_URL is required')
assert(anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
assert(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required')

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } } as const
const admin = createClient<Database>(url, serviceRoleKey, clientOptions)

async function authenticatedClient(userId: string): Promise<SupabaseClient<Database>> {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  assert.ifError(userError)
  const email = userData.user?.email
  assert(email, `Auth user ${userId} has no email`)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  assert.ifError(linkError)
  const client = createClient<Database>(url!, anonKey!, clientOptions)
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  assert.ifError(verifyError)
  assert(verified.session, 'Expected a real session')
  return client
}

const marker = `inbox-verify-${Date.now()}`
let restaurantId: string | null = null
let throwawayUserId: string | null = null
const outboxIds: string[] = []

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error: unknown) => { clearTimeout(timer); reject(error) },
    )
  })
}

async function enqueue(eventType: 'order.created' | 'service_request.created', aggregateType: 'order' | 'service_request', payload: Record<string, unknown>) {
  const { data, error } = await admin.from('domain_outbox').insert({
    restaurant_id: restaurantId!,
    aggregate_type: aggregateType,
    aggregate_id: randomUUID(),
    event_type: eventType,
    payload,
    idempotency_key: `${marker}:${eventType}:${randomUUID()}`,
  }).select('id, aggregate_id').single()
  assert.ifError(error)
  outboxIds.push(data!.id)
  return data!
}

async function main() {
  // Fixture owner (recipient identity) — read-only use of the fixture tenant.
  const { data: fixture, error: fixtureError } = await admin
    .from('restaurants').select('owner_id').eq('slug', fixtureSlug).maybeSingle()
  assert.ifError(fixtureError)
  assert(fixture, `Fixture restaurant ${fixtureSlug} not found`)
  const ownerId = fixture.owner_id

  // Throwaway tenant + table.
  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .insert({ name: `Inbox Verify ${marker}`, slug: marker, owner_id: ownerId })
    .select('id').single()
  assert.ifError(restaurantError)
  restaurantId = restaurant!.id
  const { data: table, error: tableError } = await admin
    .from('tables').insert({ restaurant_id: restaurantId, label: 'Masa 7' }).select('id').single()
  assert.ifError(tableError)

  const port = createDashboardInboxPort()

  // A — order.created lands one entry for the owner with real content.
  const orderEvent = await enqueue('order.created', 'order', { total: 150, tableId: table!.id })
  const pendingBefore = await listPendingDashboardInboxEventIds({
    restaurantId,
    aggregateId: orderEvent.aggregate_id,
  })
  assert(pendingBefore.ok)
  assert.deepEqual(pendingBefore.value, [orderEvent.id])
  const first = await consumeDashboardInbox(orderEvent.id, port)
  assert(first.ok, `consume failed: ${first.ok ? '' : first.error}`)
  assert.deepEqual(first.value, { duplicate: false, recipients: 1, delivered: 1, muted: 0 })
  const { data: rows1 } = await admin.from('notification_inbox')
    .select('recipient_user_id, category, title, body, link_path, dedupe_key, read_at')
    .eq('restaurant_id', restaurantId)
  assert.equal(rows1!.length, 1)
  assert.equal(rows1![0]!.recipient_user_id, ownerId)
  assert.equal(rows1![0]!.category, 'order')
  assert.equal(rows1![0]!.title, 'Yeni sipariş')
  assert.match(rows1![0]!.body, /Masa 7/)
  assert.equal(rows1![0]!.link_path, `/dashboard/${restaurantId}/orders`)
  assert.equal(rows1![0]!.dedupe_key, `order.created:${orderEvent.aggregate_id}`)
  assert.equal(rows1![0]!.read_at, null)
  const pendingAfter = await listPendingDashboardInboxEventIds({
    restaurantId,
    aggregateId: orderEvent.aggregate_id,
  })
  assert(pendingAfter.ok)
  assert.deepEqual(pendingAfter.value, [])
  console.log('A ✅ order.created → 1 entry, doğru içerik + dedupe key')

  // B — replay is a duplicate no-op.
  const replay = await consumeDashboardInbox(orderEvent.id, port)
  assert(replay.ok)
  assert.equal(replay.value.duplicate, true)
  const { count: afterReplay } = await admin.from('notification_inbox')
    .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
  assert.equal(afterReplay, 1)
  console.log('B ✅ replay → duplicate, satır sayısı hâlâ 1')

  // C — a muted preference suppresses delivery but the receipt still lands.
  const { error: prefsError } = await admin.from('notification_preferences').insert({
    restaurant_id: restaurantId,
    user_id: ownerId,
    prefs: { inapp: { service_request: false } },
  })
  assert.ifError(prefsError)
  const requestEvent = await enqueue('service_request.created', 'service_request', { tableId: table!.id, requestType: 'water' })
  const muted = await consumeDashboardInbox(requestEvent.id, port)
  assert(muted.ok)
  assert.deepEqual(muted.value, { duplicate: false, recipients: 1, delivered: 0, muted: 1 })
  const { data: receipt } = await admin.from('domain_outbox_receipts')
    .select('outbox_id').eq('outbox_id', requestEvent.id).eq('consumer', 'dashboard-inbox').maybeSingle()
  assert(receipt, 'Muted consumption must still record its receipt')
  console.log('C ✅ kapalı tercih → teslim yok, receipt var')

  // D — unread counting incl. the unmutable-category filter used by the badge.
  const unreadAll = await countUnreadInboxNotifications({ restaurantId, userId: ownerId })
  assert(unreadAll.ok && unreadAll.value === 1)
  const unreadCritical = await countUnreadInboxNotifications({ restaurantId, userId: ownerId, categories: ['billing', 'system'] })
  assert(unreadCritical.ok && unreadCritical.value === 0)
  console.log('D ✅ unread=1, billing/system filtresi=0')

  // E — mark-read is scoped to the recipient: a foreign userId touches nothing.
  const wrongUser = await markInboxNotificationsRead({ restaurantId, userId: randomUUID() })
  assert(wrongUser.ok)
  const stillUnread = await countUnreadInboxNotifications({ restaurantId, userId: ownerId })
  assert(stillUnread.ok && stillUnread.value === 1)
  const marked = await markInboxNotificationsRead({ restaurantId, userId: ownerId })
  assert(marked.ok)
  const nowRead = await countUnreadInboxNotifications({ restaurantId, userId: ownerId })
  assert(nowRead.ok && nowRead.value === 0)
  console.log('E ✅ yabancı userId mark-read no-op, sahibi işaretleyince unread=0')

  // F — anon role is fully revoked from the inbox.
  const anon = createClient<Database>(url!, anonKey!, clientOptions)
  const anonRead = await anon.from('notification_inbox').select('id').eq('restaurant_id', restaurantId)
  assert(anonRead.error, 'Anon must not read notification_inbox')
  assert.equal(anonRead.error!.code, '42501')
  const anonPrefs = await anon.from('notification_preferences').select('user_id').eq('restaurant_id', restaurantId)
  assert(anonPrefs.error && anonPrefs.error.code === '42501')
  console.log('F ✅ anon inbox/preferences → 42501')

  // G — RLS: the owner reads own rows with a REAL session; a different
  // authenticated user sees zero rows.
  const ownerClient = await authenticatedClient(ownerId)
  const ownRows = await ownerClient.from('notification_inbox').select('id').eq('restaurant_id', restaurantId)
  assert.ifError(ownRows.error)
  assert.equal(ownRows.data!.length, 1)
  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email: `${marker}@example.test`,
    email_confirm: true,
  })
  assert.ifError(createUserError)
  throwawayUserId = created!.user!.id
  const strangerClient = await authenticatedClient(throwawayUserId)
  const strangerRows = await strangerClient.from('notification_inbox').select('id').eq('restaurant_id', restaurantId)
  assert.ifError(strangerRows.error)
  assert.equal(strangerRows.data!.length, 0)
  console.log('G ✅ gerçek session RLS: sahibi 1 satır, yabancı authenticated 0 satır')

  // H — authenticated Realtime: RestaurantShell sets the session JWT before
  // subscribing. Prove that both a consumer INSERT and the mark-read UPDATE
  // reach the RLS-scoped channel without a page refresh.
  const { data: ownerSession } = await ownerClient.auth.getSession()
  assert(ownerSession.session, 'Expected owner session for Realtime auth')
  await ownerClient.realtime.setAuth(ownerSession.session.access_token)

  let resolveInsert!: (rowId: string) => void
  let resolveUpdate!: (rowId: string) => void
  let resolveOrderInsert!: (rowId: string) => void
  const insertSeen = new Promise<string>((resolve) => { resolveInsert = resolve })
  const updateSeen = new Promise<string>((resolve) => { resolveUpdate = resolve })
  const orderInsertSeen = new Promise<string>((resolve) => { resolveOrderInsert = resolve })
  const realtimeChannel = ownerClient
    .channel(`inbox-runtime:${restaurantId}:${marker}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notification_inbox', filter: `restaurant_id=eq.${restaurantId}` },
      (payload) => resolveInsert(String(payload.new['id'])),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notification_inbox', filter: `restaurant_id=eq.${restaurantId}` },
      (payload) => resolveUpdate(String(payload.new['id'])),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
      (payload) => resolveOrderInsert(String(payload.new['id'])),
    )

  try {
    await withTimeout(new Promise<void>((resolve, reject) => {
      realtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime subscribe failed: ${status}`))
      })
    }), 'Realtime subscription')

    const liveEvent = await enqueue('order.created', 'order', { total: 175, tableId: table!.id })
    const liveConsumed = await consumeDashboardInbox(liveEvent.id, port)
    assert(liveConsumed.ok && liveConsumed.value.delivered === 1)

    const insertedId = await withTimeout(insertSeen, 'Realtime INSERT')
    const liveRow = await admin.from('notification_inbox')
      .select('id, read_at')
      .eq('recipient_user_id', ownerId)
      .eq('dedupe_key', `order.created:${liveEvent.aggregate_id}`)
      .single()
    assert.ifError(liveRow.error)
    assert.equal(insertedId, liveRow.data!.id)
    assert.equal(liveRow.data!.read_at, null)

    const liveMarked = await markInboxNotificationsRead({
      restaurantId,
      userId: ownerId,
      ids: [liveRow.data!.id],
    })
    assert(liveMarked.ok)
    const updatedId = await withTimeout(updateSeen, 'Realtime UPDATE')
    assert.equal(updatedId, liveRow.data!.id)

    const orderId = randomUUID()
    const { error: orderInsertError } = await admin.from('orders').insert({
      id: orderId,
      restaurant_id: restaurantId,
      table_id: table!.id,
      session_id: randomUUID(),
      status: 'pending_approval',
      items: [],
      total: 42,
    })
    assert.ifError(orderInsertError)
    assert.equal(await withTimeout(orderInsertSeen, 'Orders Realtime INSERT'), orderId)
  } finally {
    await ownerClient.removeChannel(realtimeChannel)
    ownerClient.realtime.disconnect()
  }
  console.log('H ✅ setAuth(JWT) Realtime: inbox INSERT/UPDATE + orders INSERT anında ulaştı')

  // I — the read projection used by the panel.
  const feed = await listInboxNotifications({ restaurantId, userId: ownerId })
  assert(feed.ok && feed.value.length === 2)
  assert.equal(feed.value[0]!.title, 'Yeni sipariş')
  assert(feed.value[0]!.readAt !== null)
  console.log('I ✅ panel feed projection doğru')
}

async function cleanup() {
  if (outboxIds.length > 0) await admin.from('domain_outbox').delete().in('id', outboxIds)
  if (restaurantId) await admin.from('restaurants').delete().eq('id', restaurantId)
  if (throwawayUserId) await admin.auth.admin.deleteUser(throwawayUserId)
  if (restaurantId) {
    const { count: inboxOrphans } = await admin.from('notification_inbox')
      .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const { count: prefOrphans } = await admin.from('notification_preferences')
      .select('user_id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const { count: outboxOrphans } = await admin.from('domain_outbox')
      .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    console.log(`CLEANUP → inbox:${inboxOrphans} prefs:${prefOrphans} outbox:${outboxOrphans} (hepsi 0 olmalı)`)
    assert.equal(inboxOrphans, 0)
    assert.equal(prefOrphans, 0)
    assert.equal(outboxOrphans, 0)
  }
}

main()
  .then(async () => { await cleanup(); console.log('\nDASHBOARD INBOX RUNTIME MATRIX ✅ 9/9') })
  .catch(async (error) => {
    console.error('\nMATRIX FAILED:', error)
    await cleanup().catch((cleanupError) => console.error('CLEANUP FAILED:', cleanupError))
    process.exitCode = 1
  })
