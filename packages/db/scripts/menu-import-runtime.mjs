import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'

// Local fixture DB only. DDL, cron registration and every fixture are rolled back.
// Reuses the schema installed by scripts/menu-translation/setup-local.mjs.
const db = new pg.Client({ connectionString: 'postgresql://postgres:translation-test-only@127.0.0.1:55440/postgres' })
await db.connect()
const q = (sql, args = []) => db.query(sql, args)
const actor = randomUUID(), outsider = randomUUID(), restaurant = randomUUID(), id = randomUUID()
const row = { category: 'Test Çorbalar', name: 'Mercimek', description: '', price: 120 }
async function denied(sql, args, pattern) {
  await q('savepoint expected_error')
  await assert.rejects(() => q(sql, args), pattern)
  await q('rollback to savepoint expected_error')
}
async function asUser(id) {
  await q('reset role')
  await q("select set_config('request.jwt.claim.sub',$1,true)", [id])
  await q('set local role authenticated')
}
try {
  await q('begin')
  await q(readFileSync(new URL('../supabase/migrations/20261012140000_guided_menu_import.sql', import.meta.url), 'utf8'))
  await q("insert into auth.users(id,email) values($1,'guide-owner@test.invalid'),($2,'guide-outsider@test.invalid')", [actor, outsider])
  await q("insert into restaurants(id,owner_id,name,slug,plan) values($1,$2,'Guide test',$3,'pro')", [restaurant, actor, `guide-${restaurant}`])
  const enqueue = 'select enqueue_menu_import($1,$2,$3,$4,$5,$6,$7) job'
  const args = [restaurant, actor, id, 'menu.pdf', 'application/pdf', 'JVBERi0=', 'a'.repeat(64)]
  await denied(enqueue, [restaurant, outsider, randomUUID(), ...args.slice(3)], /forbidden/)
  const created = (await q(enqueue, args)).rows[0].job
  assert.equal(created.status, 'queued')
  assert.equal((await q(enqueue, args)).rows[0].job.id, id)
  await denied(enqueue, [restaurant, actor, id, ...args.slice(3,6), 'b'.repeat(64)], /request_mismatch/)
  await denied(enqueue, [restaurant, actor, randomUUID(), ...args.slice(3)], /active_job_exists/)
  const claimed = (await q('select claim_menu_import() job')).rows[0].job
  assert.equal(claimed.id, id)
  assert.equal((await q('select claim_menu_import() job')).rows[0].job, null)
  assert.equal((await q('select finish_menu_import($1,$2,$3) saved', [id, randomUUID(), JSON.stringify([row])])).rows[0].saved, false)
  assert.equal((await q('select finish_menu_import($1,$2,$3) saved', [id, claimed.lease, JSON.stringify([row])])).rows[0].saved, true)
  assert.equal((await q('select source_data from menu_import_jobs where id=$1', [id])).rows[0].source_data, null)
  await asUser(outsider)
  await denied('select read_menu_imports($1)', [restaurant], /forbidden/)
  await denied('select * from menu_import_jobs', [], /permission denied/)
  await denied(enqueue, args, /permission denied/)
  await asUser(actor)
  const snapshot = (await q('select read_menu_imports($1) snapshot', [restaurant])).rows[0].snapshot
  assert.equal(snapshot.jobs[0].status, 'review')
  assert.equal(JSON.stringify(snapshot).includes('source_data'), false)
  const revision = snapshot.jobs[0].revision
  const review = 'select review_menu_import($1,$2,$3,$4,$5) job'
  await denied(review, [restaurant, id, revision - 1, 'save', JSON.stringify([row])], /revision_conflict/)
  await denied(review, [restaurant, id, revision, 'apply', JSON.stringify([{ ...row, price: null }])], /missing_price/)
  await denied(review, [restaurant, id, revision, 'apply', JSON.stringify([row, row])], /menu_conflict/)
  assert.equal((await q('select read_menu_imports($1) snapshot', [restaurant])).rows[0].snapshot.itemCount, 0)
  const applied = (await q(review, [restaurant, id, revision, 'apply', JSON.stringify([row])])).rows[0].job
  assert.equal(applied.status, 'applied')
  assert.equal(applied.imported_count, 1)
  assert.deepEqual((await q(review, [restaurant, id, revision, 'apply', JSON.stringify([row])])).rows[0].job, applied)
  assert.equal((await q('select read_menu_imports($1) snapshot', [restaurant])).rows[0].snapshot.itemCount, 1)
  await q(review, [restaurant, id, applied.revision, 'dismiss', null])
  await q('reset role')
  const cancelId = randomUUID()
  await q(enqueue, [restaurant, actor, cancelId, ...args.slice(3)])
  const cancelClaim = (await q('select claim_menu_import() job')).rows[0].job
  await asUser(actor)
  const cancelJob = (await q('select read_menu_imports($1) snapshot', [restaurant])).rows[0].snapshot.jobs[0]
  await q(review, [restaurant, cancelId, cancelJob.revision, 'dismiss', null])
  await q('reset role')
  assert.equal((await q('select finish_menu_import($1,$2,$3) saved', [cancelId, cancelClaim.lease, JSON.stringify([row])])).rows[0].saved, false)
  assert.equal((await q('select source_data from menu_import_jobs where id=$1', [cancelId])).rows[0].source_data, null)
  for (let index = 0; index < 3; index++) {
    const extra = randomUUID()
    await q(enqueue, [restaurant, actor, extra, ...args.slice(3)])
    await asUser(actor)
    await q(review, [restaurant, extra, 0, 'dismiss', null])
    await q('reset role')
  }
  await denied(enqueue, [restaurant, actor, randomUUID(), ...args.slice(3)], /quota_exceeded/)
  await q("update menu_import_jobs set status='queued',source_data='cHJpdmF0ZQ==',created_at=now()-interval '2 days' where id=$1", [cancelId])
  await q('select expire_menu_imports()')
  const expired = (await q('select status,source_data from menu_import_jobs where id=$1', [cancelId])).rows[0]
  assert.deepEqual(expired, { status: 'failed', source_data: null })
  console.log('PASS: migration, tenant isolation, private sources, idempotent enqueue/apply, daily quota, leases, CAS, atomic rollback, cancellation and independent source expiry')
} finally {
  await q('rollback')
  await db.end()
}
