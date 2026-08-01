import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { createServiceClient } from '../src/client'

const { Client } = pg
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const evidenceDir = `${repositoryRoot}test-results/customers-audit/final-evidence-gaps`
const evidencePath = `${evidenceDir}/local-volume-evidence.json`
const statePath = process.env['LOCAL_CUSTOMER_FIXTURE_STATE'] ?? '/private/tmp/garsonless-customer-local-fixture.json'

type FixtureState = {
  marker: string
  ownerId: string
  allowedMemberId: string
  deniedMemberId: string
  disabledMemberId: string
  foreignOwnerId: string
  restaurantId: string
  foreignRestaurantId: string
  authUserIds: string[]
}

type Timing = {
  iterations: number
  minMs: number
  medianMs: number
  p95Ms: number
  maxMs: number
}

function assertLocalEnvironment() {
  const api = new URL(process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '')
  const database = new URL(process.env['DB_URL'] ?? '')
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1'])
  if (!localHosts.has(api.hostname) || !localHosts.has(database.hostname)) {
    throw new Error('Refusing to create QA fixtures outside the local Docker Supabase stack')
  }
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) throw new Error('Missing local service role key')
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0
}

function summarize(values: number[]): Timing {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    iterations: values.length,
    minMs: Number((sorted[0] ?? 0).toFixed(1)),
    medianMs: Number(percentile(values, 0.5).toFixed(1)),
    p95Ms: Number(percentile(values, 0.95).toFixed(1)),
    maxMs: Number((sorted.at(-1) ?? 0).toFixed(1)),
  }
}

async function timed(client: pg.Client, sql: string, params: unknown[], iterations = 7): Promise<Timing> {
  await client.query(sql, params)
  const values: number[] = []
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now()
    await client.query(sql, params)
    values.push(performance.now() - started)
  }
  return summarize(values)
}

async function createAuthUser(label: string, marker: string) {
  const service = createServiceClient()
  const { data, error } = await service.auth.admin.createUser({
    email: `qa-${label}-${marker}@example.invalid`,
    email_confirm: true,
    user_metadata: { full_name: `QA ${label}` },
  })
  if (error || !data.user) throw error ?? new Error(`Could not create ${label} user`)
  return data.user.id
}

function readState(): FixtureState {
  return JSON.parse(readFileSync(statePath, 'utf8')) as FixtureState
}

async function setup() {
  assertLocalEnvironment()
  const marker = randomUUID().replaceAll('-', '').slice(0, 10)
  const authUserIds: string[] = []
  const ownerId = await createAuthUser('owner', marker); authUserIds.push(ownerId)
  const allowedMemberId = await createAuthUser('member-customers', marker); authUserIds.push(allowedMemberId)
  const deniedMemberId = await createAuthUser('member-denied', marker); authUserIds.push(deniedMemberId)
  const disabledMemberId = await createAuthUser('member-disabled', marker); authUserIds.push(disabledMemberId)
  const foreignOwnerId = await createAuthUser('foreign-owner', marker); authUserIds.push(foreignOwnerId)

  const client = new Client({ connectionString: process.env['DB_URL'] })
  await client.connect()
  let state: FixtureState | null = null
  try {
    const restaurant = await client.query<{ id: string }>(`
      insert into public.restaurants (slug, name, owner_id, plan, settings)
      values ($1, 'QA Yerel Müşteri Hacim', $2, 'pro', $3::jsonb)
      returning id
    `, [
      `qa-customer-volume-${marker}`,
      ownerId,
      JSON.stringify({ loyalty: { points_enabled: true, points_per_lira: 1, points_redeem_rate: 10, scope: 'restaurant', earn_trigger: 'paid' } }),
    ])
    const foreign = await client.query<{ id: string }>(`
      insert into public.restaurants (slug, name, owner_id, plan, settings)
      values ($1, 'QA Yabancı Tenant', $2, 'pro', '{}'::jsonb)
      returning id
    `, [`qa-customer-foreign-${marker}`, foreignOwnerId])
    const restaurantId = restaurant.rows[0]!.id
    const foreignRestaurantId = foreign.rows[0]!.id
    state = {
      marker,
      ownerId,
      allowedMemberId,
      deniedMemberId,
      disabledMemberId,
      foreignOwnerId,
      restaurantId,
      foreignRestaurantId,
      authUserIds,
    }
    writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 })

    await client.query(`
      insert into public.restaurant_members
        (restaurant_id, user_id, email, permissions, status, invited_by, accepted_at)
      values
        ($1, $2, $3, '["customers"]'::jsonb, 'active', $5, now()),
        ($1, $4, $6, '["orders"]'::jsonb, 'active', $5, now()),
        ($1, $7, $8, '["customers"]'::jsonb, 'disabled', $5, now())
    `, [
      restaurantId,
      allowedMemberId,
      `qa-member-customers-${marker}@example.invalid`,
      deniedMemberId,
      ownerId,
      `qa-member-denied-${marker}@example.invalid`,
      disabledMemberId,
      `qa-member-disabled-${marker}@example.invalid`,
    ])

    await client.query(`
      insert into public.customers (phone, email, name, verified_at, created_at)
      select
        '+90555' || lpad(series::text, 7, '0'),
        'qa-customer-' || $1 || '-' || series || '@example.invalid',
        'QA Yerel ' || $1 || ' ' || lpad(series::text, 5, '0'),
        now(),
        now() - ((series % 100) * interval '1 day')
      from generate_series(1, 10000) series
    `, [marker])

    const listSql = `
      select * from public.get_restaurant_customers(
        $1::uuid, $1::uuid, $2::text, $3::text, $4::text,
        25, 0, $5::jsonb
      )
    `
    const volumeResults: Array<Record<string, unknown>> = []
    let previous = 0
    for (const volume of [25, 1000, 10000]) {
      await client.query(`
        with selected as (
          select id, row_number() over (order by name) as sequence
          from public.customers
          where name like $1
        )
        insert into public.customer_restaurants (customer_id, restaurant_id, source, linked_at)
        select id, $2, 'activity', now() - ((sequence % 100) * interval '1 day')
        from selected where sequence > $3 and sequence <= $4
        on conflict do nothing
      `, [`QA Yerel ${marker} %`, restaurantId, previous, volume])
      await client.query(`
        with selected as (
          select id, row_number() over (order by name) as sequence
          from public.customers
          where name like $1
        )
        insert into public.loyalty_transactions
          (customer_id, restaurant_id, scope_key, type, delta, reason, direction, created_at)
        select id, $2, $2, 'visit', case when sequence % 4 = 0 then 3 else 1 end,
               'qa_local_volume', 'earn', now() - ((sequence % 100) * interval '1 day')
        from selected where sequence > $3 and sequence <= $4
      `, [`QA Yerel ${marker} %`, restaurantId, previous, volume])
      await client.query(`
        with selected as (
          select id, row_number() over (order by name) as sequence
          from public.customers
          where name like $1
        )
        insert into public.customer_consents
          (customer_id, restaurant_id, consent_type, granted_at, source)
        select id, $2, 'contact_data', now(), 'member_sheet'
        from selected where sequence > $3 and sequence <= $4 and sequence % 3 = 0
        on conflict do nothing
      `, [`QA Yerel ${marker} %`, restaurantId, previous, volume])

      const list = await timed(client, listSql, [restaurantId, null, 'last_seen', null, null])
      const search = await timed(client, listSql, [restaurantId, `${marker} 099`, 'last_seen', null, null])
      const frequent = await timed(client, listSql, [restaurantId, null, 'last_seen', 'frequent', null])
      const count = await client.query<{ count: string }>(`
        select count(*)::text as count from public.customer_restaurants where restaurant_id = $1
      `, [restaurantId])
      const explain = await client.query(`
        explain (analyze, buffers, format json)
        select * from public.get_restaurant_customers(
          $1::uuid, $1::uuid, null, 'last_seen', null, 25, 0, null
        )
      `, [restaurantId])
      const plan = explain.rows[0]?.['QUERY PLAN']?.[0]?.Plan
      volumeResults.push({
        volume,
        associatedRows: Number(count.rows[0]!.count),
        list,
        search,
        frequentSegment: frequent,
        explain: {
          nodeType: plan?.['Node Type'] ?? null,
          actualTotalTimeMs: Number(Number(plan?.['Actual Total Time'] ?? 0).toFixed(1)),
          sharedHitBlocks: plan?.['Shared Hit Blocks'] ?? null,
          sharedReadBlocks: plan?.['Shared Read Blocks'] ?? null,
          tempReadBlocks: plan?.['Temp Read Blocks'] ?? null,
          tempWrittenBlocks: plan?.['Temp Written Blocks'] ?? null,
        },
      })
      previous = volume
    }

    await client.query(`
      with foreign_customer as (
        insert into public.customers (phone, email, name, verified_at)
        values ('+90554' || lpad((abs(hashtext($1)) % 10000000)::text, 7, '0'),
                'qa-foreign-' || $1 || '@example.invalid', 'QA Yabancı ' || $1, now())
        returning id
      )
      insert into public.customer_restaurants (customer_id, restaurant_id, source)
      select id, $2, 'activity' from foreign_customer
    `, [marker, foreignRestaurantId])

    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(evidencePath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      environment: 'local-docker-supabase',
      productionTouched: false,
      syntheticOnly: true,
      smsSent: false,
      volumes: volumeResults,
    }, null, 2))
    process.stdout.write(JSON.stringify({
      ok: true,
      environment: 'local-docker-supabase',
      productionTouched: false,
      syntheticCustomers: 10001,
      activeCustomersMember: true,
      deniedMember: true,
      disabledMember: true,
      volumeEvidence: volumeResults.map(({ volume, list, search, frequentSegment }) => ({ volume, list, search, frequentSegment })),
      stateStoredOutsideRepository: true,
    }, null, 2))
  } catch (error) {
    if (state) process.stderr.write(`Fixture state retained for cleanup at ${statePath}\n`)
    throw error
  } finally {
    await client.end()
  }
}

async function cleanup() {
  assertLocalEnvironment()
  const state = readState()
  const client = new Client({ connectionString: process.env['DB_URL'] })
  await client.connect()
  try {
    await client.query('delete from public.restaurants where id = any($1::uuid[])', [[state.restaurantId, state.foreignRestaurantId]])
    await client.query('delete from public.customers where name like $1 or email = $2', [
      `QA Yerel ${state.marker} %`,
      `qa-foreign-${state.marker}@example.invalid`,
    ])
  } finally {
    await client.end()
  }
  const service = createServiceClient()
  for (const userId of state.authUserIds) await service.auth.admin.deleteUser(userId)

  const verifier = new Client({ connectionString: process.env['DB_URL'] })
  await verifier.connect()
  const residue = await verifier.query<{ restaurants: string; customers: string; ledger: string; members: string }>(`
    select
      (select count(*) from public.restaurants where slug like $1)::text as restaurants,
      (select count(*) from public.customers where name like $2)::text as customers,
      (select count(*) from public.loyalty_transactions where reason = 'qa_local_volume')::text as ledger,
      (select count(*) from public.restaurant_members where email like $3)::text as members
  `, [`qa-customer-%-${state.marker}`, `QA Yerel ${state.marker} %`, `qa-%-${state.marker}@example.invalid`])
  await verifier.end()
  const cleanupCounts = Object.fromEntries(Object.entries(residue.rows[0]!).map(([key, value]) => [key, Number(value)]))
  if (!Object.values(cleanupCounts).every((count) => count === 0)) {
    throw new Error(`Local fixture cleanup incomplete: ${JSON.stringify(cleanupCounts)}`)
  }
  unlinkSync(statePath)
  process.stdout.write(JSON.stringify({ ok: true, cleanup: cleanupCounts, productionTouched: false }, null, 2))
}

const mode = process.argv[2]
if (mode === 'setup') void setup().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
else if (mode === 'cleanup') void cleanup().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
else {
  console.error('Usage: customer-local-evidence-fixture.ts <setup|cleanup>')
  process.exitCode = 2
}
