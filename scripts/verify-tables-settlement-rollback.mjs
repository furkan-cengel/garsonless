// Executes the repository's PL/pgSQL in an isolated PostgreSQL WASM instance.
// PGLITE_MODULE_PATH can point to a temporary install; no live credentials used.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite')
const db = new PGlite()
const migrations = new URL('../packages/db/supabase/migrations/', import.meta.url)
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table table_sessions(id uuid primary key, restaurant_id uuid, closed_at timestamptz, updated_at timestamptz, close_reason text);
    create table orders(id uuid primary key, restaurant_id uuid, table_session_id uuid, status text default 'served', deleted_at timestamptz, paid_at timestamptz, payment_method text, settled_by uuid, updated_at timestamptz);
    create table payment_shares(id uuid primary key, restaurant_id uuid, table_session_id uuid, status text, method text, checkout_reserved_until timestamptz, checkout_amount numeric, updated_at timestamptz);
    create table payment_share_tokens(share_id uuid, token text);
    create function read_tables_command_access_bundle(uuid,uuid) returns jsonb language sql as $$ select '{"authorized":true}'::jsonb $$;
  `)
  const closeMigration = await readFile(new URL('20260716100000_atomic_table_close_service_request_and_kitchen_transition.sql', migrations), 'utf8')
  await db.exec(closeMigration.slice(0, closeMigration.indexOf('create or replace function public.create_table_service_request_atomic')))
  await db.exec(await readFile(new URL('20260905090000_tables_settlement_rollback.sql', migrations), 'utf8'))
  const tenant = randomUUID(), actor = randomUUID()
  const fixture = async () => {
    const session = randomUUID(), orders = [randomUUID(), randomUUID()]
    await db.query('insert into table_sessions(id,restaurant_id) values ($1,$2)', [session, tenant])
    for (const order of orders) await db.query('insert into orders(id,restaurant_id,table_session_id) values ($1,$2,$3)', [order, tenant, session])
    return { session, orders }
  }
  const settle = async ({ session, orders }) => (await db.query('select settle_session_and_close_atomic($1,$2,$3,$4) as result', [tenant, session, actor, JSON.stringify(orders.map(order_id => ({ order_id, method: 'cash' })))])).rows[0].result
  for (const outcome of ['unpaid', 'payment_pending', 'closed_normal', 'already_closed']) {
    const f = await fixture()
    if (outcome === 'payment_pending') await db.query("insert into payment_shares(id,restaurant_id,table_session_id,status,method,checkout_reserved_until) values ($1,$2,$3,'declared','iyzico',now()+interval '10 minutes')", [randomUUID(), tenant, f.session])
    if (outcome === 'already_closed') await db.query('update table_sessions set closed_at=now() where id=$1', [f.session])
    const result = await settle({ ...f, orders: outcome === 'unpaid' ? f.orders.slice(0, 1) : f.orders })
    assert.equal(result.outcome, outcome)
    const paid = (await db.query('select paid_at,payment_method,settled_by from orders where table_session_id=$1', [f.session])).rows
    if (outcome === 'closed_normal') {
      assert.equal(result.settledOrderIds.length, 2)
      assert.ok(paid.every(row => row.paid_at && row.payment_method === 'cash' && row.settled_by === actor))
      assert.equal((await settle(f)).outcome, 'already_closed')
    } else {
      assert.deepEqual(result.settledOrderIds, [])
      assert.ok(paid.every(row => row.paid_at === null && row.payment_method === null && row.settled_by === null))
    }
    const closed = (await db.query('select closed_at from table_sessions where id=$1', [f.session])).rows[0].closed_at
    assert.equal(Boolean(closed), ['closed_normal', 'already_closed'].includes(outcome))
    console.log(`PASS ${outcome}: payment and close state agree`)
  }
  const own = await fixture(), other = await fixture()
  await assert.rejects(settle({ session: own.session, orders: other.orders }), /settlement_order_scope_mismatch/)
  console.log('PASS mismatched session rejected before writes')
} finally { await db.close() }
