import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260901120000_subscription_lifecycle_notifications.sql',
  import.meta.url,
), 'utf8')
const scopeMigration = readFileSync(new URL(
  '../supabase/migrations/20260901121000_subscription_lifecycle_notification_scope.sql',
  import.meta.url,
), 'utf8')
const inboxMigration = readFileSync(new URL(
  '../supabase/migrations/20260901122000_notification_inbox_lifecycle_category.sql',
  import.meta.url,
), 'utf8')
const healthRoutingMigration = readFileSync(new URL(
  '../supabase/migrations/20260901123000_notification_delivery_health_routing.sql',
  import.meta.url,
), 'utf8')
const worker = readFileSync(new URL('../supabase/functions/outbox-worker/index.ts', import.meta.url), 'utf8')

test('trial and onboarding occurrences are transactional, bounded and idempotent', () => {
  assert.match(migration, /create function public\.enqueue_subscription_lifecycle_notifications/)
  assert.match(migration, /subscription\.trial_expiring_7/)
  assert.match(migration, /subscription\.trial_expiring_3/)
  assert.match(migration, /subscription\.trial_expiring_1/)
  assert.match(migration, /subscription\.trial_expired/)
  assert.match(migration, /onboarding\.incomplete/)
  assert.match(migration, /for update of subscription skip locked/i)
  assert.match(migration, /for update of state skip locked/i)
  assert.match(migration, /on conflict \(idempotency_key\) do nothing/i)
})

test('service-role runtime can scope time travel to one explicit DEV tenant', () => {
  assert.match(scopeMigration, /p_restaurant_id uuid default null/)
  assert.match(scopeMigration, /p_restaurant_id is null or subscription\.restaurant_id = p_restaurant_id/)
  assert.match(scopeMigration, /p_restaurant_id is null or state\.restaurant_id = p_restaurant_id/)
  assert.match(scopeMigration, /revoke all on function public\.enqueue_subscription_lifecycle_notifications\(integer,timestamptz,uuid\)/)
})

test('lifecycle category is accepted by inbox, e-mail delivery and template ledgers', () => {
  assert.match(migration, /notification_templates_category_check[\s\S]*'lifecycle'/)
  assert.match(migration, /notification_deliveries_category_check[\s\S]*'lifecycle'/)
  assert.match(inboxMigration, /notification_inbox_category_check[\s\S]*'lifecycle'/)
})

test('trial/onboarding fan out to inbox and e-mail without enabling web push', () => {
  const push = worker.match(/const isDashboardPushEvent[\s\S]*?\.includes\(eventType\)/)?.[0] ?? ''
  const inbox = worker.match(/const isDashboardInboxEvent[\s\S]*?\.includes\(eventType\)/)?.[0] ?? ''
  const email = worker.match(/const isNotificationEmailEvent[\s\S]*?\.includes\(eventType\)/)?.[0] ?? ''
  assert.doesNotMatch(push, /subscription\.trial|onboarding\.incomplete/)
  assert.match(inbox, /subscription\.trial_expiring_7/)
  assert.match(inbox, /onboarding\.incomplete/)
  assert.match(email, /subscription\.trial_expired/)
  assert.match(email, /onboarding\.incomplete/)
})

test('trial expiry writes lifecycle audit and never fabricates payment state', () => {
  assert.match(migration, /tenant_lifecycle_events/)
  assert.match(migration, /trial_ended_without_payment/)
  assert.match(migration, /set status = 'trial_expired'/)
  assert.doesNotMatch(migration, /set status = 'paid'|amount_paid_minor\s*=/i)
})

test('fiscal e-mail identity is stored before ready event and provider outcomes stay service-only', () => {
  assert.match(migration, /record_accounting_invoice_email_delivery/)
  assert.match(migration, /'fiscal_document\.ready'/)
  assert.match(migration, /notification_delivery_provider_events/)
  assert.match(migration, /record_resend_notification_event/)
  assert.match(migration, /'bounced', 'complained', 'suppressed', 'failed'/)
  assert.match(migration, /force row level security/)
  assert.match(migration, /revoke all on public\.notification_delivery_provider_events from public, anon, authenticated/i)
})

test('delivery health includes mandatory billing events and provider failures', () => {
  assert.match(healthRoutingMigration, /create or replace function public\.get_notification_delivery_health/)
  assert.match(healthRoutingMigration, /provider_delivery_status in \('bounced', 'complained', 'suppressed', 'failed'\)/)
  assert.match(healthRoutingMigration, /fiscal_document\.ready/)
})

test('delivery health follows the worker consumer routing contract', () => {
  assert.match(
    healthRoutingMigration,
    /values \('dashboard-inbox'::text\), \('notification-email'::text\)/,
  )
  assert.match(
    healthRoutingMigration,
    /'dashboard-push'::text as consumer[\s\S]*event\.event_type in \('order\.created', 'service_request\.created'\)/,
  )
  assert.doesNotMatch(
    healthRoutingMigration,
    /'dashboard-push'::text as consumer[\s\S]*event\.event_type in \([^)]*subscription\.trial/,
  )
})
