/**
 * Real DEV runtime matrix for the notification e-mail channel (Faz 4, slice 2).
 * Uses the REAL port + DB against a throwaway tenant with a test-double
 * provider — no real e-mail leaves this script. Cleans up to zero orphans.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types.gen'
import {
  consumeNotificationEmail,
  type NotificationEmailProvider,
} from '@garsonless/application/notification-emails'
import {
  createNotificationEmailPort,
  upsertNotificationPreferences,
} from '../src/notification-email-port'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const fixtureSlug = process.env.INBOX_TEST_RESTAURANT_SLUG ?? 'test-cafe-b'

assert(url && anonKey && serviceRoleKey, 'Supabase env is required')

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
    type: 'magiclink', token_hash: linkData.properties.hashed_token,
  })
  assert.ifError(verifyError)
  assert(verified.session)
  return client
}

const marker = `email-verify-${Date.now()}`
let restaurantId: string | null = null
let templateId: string | null = null
const outboxIds: string[] = []

function makeProvider(outcome: 'sent' | 'failed') {
  const sends: Array<{ to: string; subject: string; html: string }> = []
  const provider: NotificationEmailProvider = {
    send: async (input) => {
      sends.push(input)
      return outcome === 'sent'
        ? { outcome: 'sent', messageId: `mock-${randomUUID().slice(0, 8)}` }
        : { outcome: 'failed', error: 'mock smtp 500' }
    },
  }
  return { provider, sends }
}

async function enqueue(payload: Record<string, unknown>) {
  const { data, error } = await admin.from('domain_outbox').insert({
    restaurant_id: restaurantId!,
    aggregate_type: 'order',
    aggregate_id: randomUUID(),
    event_type: 'order.created',
    payload,
    idempotency_key: `${marker}:${randomUUID()}`,
  }).select('id, aggregate_id').single()
  assert.ifError(error)
  outboxIds.push(data!.id)
  return data!
}

async function main() {
  const { data: fixture } = await admin
    .from('restaurants').select('owner_id').eq('slug', fixtureSlug).maybeSingle()
  assert(fixture, `Fixture ${fixtureSlug} not found`)
  const ownerId = fixture.owner_id
  const { data: ownerUser } = await admin.auth.admin.getUserById(ownerId)
  const ownerEmail = ownerUser.user?.email
  assert(ownerEmail, 'Fixture owner must have an email')

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .insert({ name: `Email Verify ${marker}`, slug: marker, owner_id: ownerId })
    .select('id').single()
  assert.ifError(restaurantError)
  restaurantId = restaurant!.id
  const { data: table } = await admin
    .from('tables').insert({ restaurant_id: restaurantId, label: 'Masa 9' }).select('id').single()

  const port = createNotificationEmailPort()

  // A — default prefs: e-mail is opt-in, so the owner is muted; receipt lands.
  const eventA = await enqueue({ total: 120, tableId: table!.id })
  const providerA = makeProvider('sent')
  const a = await consumeNotificationEmail(eventA.id, port, providerA.provider)
  assert(a.ok, a.ok ? '' : a.error)
  assert.deepEqual(a.value, { duplicate: false, recipients: 1, sent: 0, muted: 1, dead: 0 })
  assert.equal(providerA.sends.length, 0)
  console.log('A ✅ varsayılan tercih → muted, e-posta yok, receipt var')

  // B — opt-in → real delivery row + exactly one provider call.
  const optIn = await upsertNotificationPreferences({
    restaurantId, userId: ownerId, prefs: { email: { order: true } },
  })
  assert(optIn.ok)
  const eventB = await enqueue({ total: 240, tableId: table!.id })
  const providerB = makeProvider('sent')
  const b = await consumeNotificationEmail(eventB.id, port, providerB.provider)
  assert(b.ok, b.ok ? '' : b.error)
  assert.deepEqual(b.value, { duplicate: false, recipients: 1, sent: 1, muted: 0, dead: 0 })
  assert.equal(providerB.sends.length, 1)
  assert.equal(providerB.sends[0]!.to, ownerEmail)
  assert.match(providerB.sends[0]!.subject, /Email Verify/)
  assert.match(providerB.sends[0]!.subject, /Masa 9/)
  const { data: deliveryB } = await admin.from('notification_deliveries')
    .select('status, attempts, recipient_address, provider_message_id, dedupe_key')
    .eq('restaurant_id', restaurantId).eq('dedupe_key', `order.created:${eventB.aggregate_id}`)
    .single()
  assert.equal(deliveryB!.status, 'sent')
  assert.equal(deliveryB!.attempts, 1)
  assert.equal(deliveryB!.recipient_address, ownerEmail)
  assert.match(deliveryB!.provider_message_id ?? '', /^mock-/)
  console.log('B ✅ opt-in → 1 gönderim, delivery satırı sent + provider id')

  // C — replay: duplicate receipt, provider untouched.
  const providerC = makeProvider('sent')
  const c = await consumeNotificationEmail(eventB.id, port, providerC.provider)
  assert(c.ok && c.value.duplicate === true)
  assert.equal(providerC.sends.length, 0)
  console.log('C ✅ replay → duplicate, ikinci e-posta yok')

  // D — transient failure: err without receipt; a later redispatch succeeds.
  const eventD = await enqueue({ total: 300, tableId: table!.id })
  const providerD1 = makeProvider('failed')
  const d1 = await consumeNotificationEmail(eventD.id, port, providerD1.provider)
  assert(!d1.ok)
  const { data: receiptD } = await admin.from('domain_outbox_receipts')
    .select('outbox_id').eq('outbox_id', eventD.id).eq('consumer', 'notification-email').maybeSingle()
  assert.equal(receiptD, null)
  const dedupeD = `order.created:${eventD.aggregate_id}`
  const { data: failedRow } = await admin.from('notification_deliveries')
    .select('status, attempts').eq('restaurant_id', restaurantId).eq('dedupe_key', dedupeD).single()
  assert.equal(failedRow!.status, 'failed')
  assert.equal(failedRow!.attempts, 1)
  const providerD2 = makeProvider('sent')
  const d2 = await consumeNotificationEmail(eventD.id, port, providerD2.provider)
  assert(d2.ok && d2.value.sent === 1)
  const { data: retriedRow } = await admin.from('notification_deliveries')
    .select('status, attempts').eq('restaurant_id', restaurantId).eq('dedupe_key', dedupeD).single()
  assert.equal(retriedRow!.status, 'sent')
  assert.equal(retriedRow!.attempts, 2)
  console.log('D ✅ transient hata → receipt yok + failed(1); retry → sent(2) + receipt')

  // E — retry budget exhausted → dead-letter, event completes.
  const eventE = await enqueue({ total: 90, tableId: table!.id })
  const dedupeE = `order.created:${eventE.aggregate_id}`
  const { error: seedError } = await admin.from('notification_deliveries').insert({
    outbox_id: eventE.id,
    restaurant_id: restaurantId,
    recipient_user_id: ownerId,
    channel: 'email',
    category: 'order',
    dedupe_key: dedupeE,
    recipient_address: ownerEmail,
    status: 'failed',
    attempts: 5,
  })
  assert.ifError(seedError)
  const providerE = makeProvider('sent')
  const e = await consumeNotificationEmail(eventE.id, port, providerE.provider)
  assert(e.ok, e.ok ? '' : e.error)
  assert.deepEqual(e.value, { duplicate: false, recipients: 1, sent: 0, muted: 0, dead: 1 })
  assert.equal(providerE.sends.length, 0)
  const { data: deadRow } = await admin.from('notification_deliveries')
    .select('status, last_error').eq('restaurant_id', restaurantId).eq('dedupe_key', dedupeE).single()
  assert.equal(deadRow!.status, 'dead')
  assert.match(deadRow!.last_error ?? '', /budget/i)
  console.log('E ✅ 5 deneme sonrası dead-letter, event receipt ile tamamlandı')

  // F — DB template override wins over the code default.
  const { data: template, error: templateError } = await admin.from('notification_templates').insert({
    category: 'order', channel: 'email',
    subject: `ÖZEL ${marker} {{restaurantName}}`,
    body_html: '<p>{{tableLabel}}</p>',
  }).select('id').single()
  assert.ifError(templateError)
  templateId = template!.id
  const eventF = await enqueue({ total: 55, tableId: table!.id })
  const providerF = makeProvider('sent')
  const f = await consumeNotificationEmail(eventF.id, port, providerF.provider)
  assert(f.ok && f.value.sent === 1)
  assert.match(providerF.sends[0]!.subject, new RegExp(`^ÖZEL ${marker}`))
  console.log('F ✅ DB template override kod varsayılanını ezdi')

  // G — deliveries/templates are invisible to both browser roles.
  const anon = createClient<Database>(url!, anonKey!, clientOptions)
  const anonDeliveries = await anon.from('notification_deliveries').select('id').limit(1)
  assert(anonDeliveries.error && anonDeliveries.error.code === '42501')
  const anonTemplates = await anon.from('notification_templates').select('id').limit(1)
  assert(anonTemplates.error && anonTemplates.error.code === '42501')
  const ownerClient = await authenticatedClient(ownerId)
  const authDeliveries = await ownerClient.from('notification_deliveries').select('id').limit(1)
  assert(authDeliveries.error && authDeliveries.error.code === '42501')
  console.log('G ✅ anon + gerçek authenticated session → deliveries/templates 42501')
}

async function cleanup() {
  if (templateId) await admin.from('notification_templates').delete().eq('id', templateId)
  if (outboxIds.length > 0) await admin.from('domain_outbox').delete().in('id', outboxIds)
  if (restaurantId) {
    await admin.from('restaurants').delete().eq('id', restaurantId)
    const { count: deliveryOrphans } = await admin.from('notification_deliveries')
      .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const { count: prefOrphans } = await admin.from('notification_preferences')
      .select('user_id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const { count: outboxOrphans } = await admin.from('domain_outbox')
      .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const { count: templateOrphans } = await admin.from('notification_templates')
      .select('id', { count: 'exact', head: true }).like('subject', `%${marker}%`)
    console.log(`CLEANUP → deliveries:${deliveryOrphans} prefs:${prefOrphans} outbox:${outboxOrphans} templates:${templateOrphans}`)
    assert.equal(deliveryOrphans, 0)
    assert.equal(prefOrphans, 0)
    assert.equal(outboxOrphans, 0)
    assert.equal(templateOrphans, 0)
  }
}

main()
  .then(async () => { await cleanup(); console.log('\nNOTIFICATION EMAIL RUNTIME MATRIX ✅ 7/7') })
  .catch(async (error) => {
    console.error('\nMATRIX FAILED:', error)
    await cleanup().catch((cleanupError) => console.error('CLEANUP FAILED:', cleanupError))
    process.exitCode = 1
  })
