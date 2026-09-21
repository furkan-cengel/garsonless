import assert from "node:assert/strict";
import { randomUUID as uuid } from "node:crypto";
import pg from "pg";
// Deliberately fixed localhost connection; never reads project/live credentials.
const connectionString =
  "postgresql://postgres:translation-test-only@127.0.0.1:55440/postgres";
const db = new pg.Client({ connectionString });
await db.connect();
const q = (sql: string, values: unknown[] = []) => db.query(sql, values);
const rid = uuid(),
  actor = uuid(),
  stranger = uuid(),
  member = uuid(),
  cat = uuid(),
  item = uuid();
const checks: string[] = [];
async function cmd(
  mode: string,
  payload: Record<string, unknown> = {},
  request = uuid(),
  who = actor,
) {
  return (
    await q("select execute_menu_translation($1,$2,$3,$4,$5) r", [
      rid,
      who,
      mode,
      request,
      payload,
    ])
  ).rows[0].r;
}
async function good(
  mode: string,
  payload: Record<string, unknown> = {},
  request = uuid(),
  who = actor,
) {
  const r = await cmd(mode, payload, request, who);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.data;
}
const publicView = async () =>
  (await q("select read_public_menu_translations($1) r", [rid])).rows[0].r;
try {
  await q(
    "truncate public.menu_translation_jobs, public.menu_translation_attempts, public.menu_translation_provider_spend cascade",
  );
  await q("update public.menu_translation_usage set reserved=0");
  await q("select set_config('request.jwt.claim.role','service_role',false)");
  for (const id of [actor, stranger, member])
    await q("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@translation.test`,
    ]);
  await q(
    "insert into restaurants(id,owner_id,name,slug,plan) values($1,$2,'Çeviri test',$3,'pro')",
    [rid, actor, `translation-${rid}`],
  );
  const customer = (
    await q(
      "insert into billing_customers(restaurant_id,legal_name,contact_email) values($1,'Çeviri test','test@translation.test') on conflict(restaurant_id) do update set legal_name=excluded.legal_name returning id",
      [rid],
    )
  ).rows[0].id;
  await q(
    "insert into billing_subscriptions(restaurant_id,billing_customer_id,plan,status,trial_ends_at) values($1,$2,'pro','trial',now()+interval '14 days') on conflict(restaurant_id) where status<>'cancelled' do update set status='trial',trial_ends_at=now()+interval '14 days'",
    [rid, customer],
  );
  await q(
    "insert into menu_categories(id,restaurant_id,name) values($1,$2,'Yemekler')",
    [cat, rid],
  );
  await q(
    "insert into menu_items(id,category_id,name,description,price,ingredients,modifier_groups) values($1,$2,'Mantı','250 g yoğurt ile',150,$3,$4)",
    [
      item,
      cat,
      JSON.stringify([{ id: "onion", name: "Soğan", removable: true }]),
      JSON.stringify([
        {
          id: "extra",
          name: "Ekstra",
          min: 0,
          max: 1,
          options: [{ id: "cheese", name: "Peynir", price_delta: 20 }],
        },
      ]),
    ],
  );
  assert.equal(
    (await cmd("snapshot", {}, uuid(), stranger)).error,
    "forbidden",
  );
  checks.push("cross-tenant/actor isolation");
  await q(
    "insert into restaurant_members(restaurant_id,user_id,email,status,permissions) values($1,$2,'member@translation.test','active','[\"menu\"]')",
    [rid, member],
  );
  assert.equal((await cmd("snapshot", {}, uuid(), member)).ok, true);
  assert.equal((await cmd("enable", {}, uuid(), member)).error, "forbidden");
  await q(
    "update restaurant_members set permissions='[]' where restaurant_id=$1",
    [rid],
  );
  assert.equal((await cmd("snapshot", {}, uuid(), member)).error, "forbidden");
  await q(
    "update restaurant_members set permissions='[\"menu\"]' where restaurant_id=$1",
    [rid],
  );
  checks.push("menu staff permissions and owner-only language control");
  let s = await good("snapshot");
  assert.equal(s.quota.limit, 100000);
  assert.equal(s.fields.length, 6);
  assert.equal((await cmd("enable")).error, "incomplete");
  assert.equal((await publicView()).enabled, false);
  checks.push("activation coverage gate");
  const key = `item/${item}/name`;
  const saveAll = s.fields.map((f: any) => ({
    key: f.key,
    version: f.version,
    sourceVersion: f.sourceVersion,
    text:
      f.source === "Mantı"
        ? "Manti"
        : f.source === "Yemekler"
          ? "Dishes"
          : f.source === "250 g yoğurt ile"
            ? "With 250 g yoghurt"
            : f.source === "Soğan"
              ? "Onion"
              : f.source === "Ekstra"
                ? "Extra"
                : "Cheese",
  }));
  const request = uuid();
  s = await good("save", { fields: saveAll }, request);
  const replay = await good("save", { fields: saveAll }, request);
  assert.deepEqual(replay.fields, s.fields);
  assert.equal(
    (await cmd("save", { fields: [] }, request)).error,
    "request_mismatch",
  );
  assert.equal((await publicView()).fields[key], undefined);
  checks.push("draft privacy and request replay");
  s = await good(
    "publish",
    {
      fields: s.fields.map((f: any) => ({
        key: f.key,
        version: f.version,
        sourceVersion: f.sourceVersion,
      })),
    },
    uuid(),
    member,
  );
  await good("enable");
  assert.equal((await publicView()).fields[key].text, "Manti");
  checks.push("manual publish and public projection");
  const f = s.fields.find((f: any) => f.key.endsWith("/description"));
  assert.equal(
    (await cmd("save", { fields: [{ ...f, text: "With 300 g yoghurt" }] }))
      .error,
    "invalid_numbers",
  );
  checks.push("quantity invariant");
  await q("update menu_items set name='Etli mantı' where id=$1", [item]);
  assert.equal((await publicView()).fields[key], undefined);
  assert.equal(
    (
      await cmd("publish", {
        fields: [s.fields.find((f: any) => f.key === key)],
      })
    ).error,
    "conflict",
  );
  checks.push("stale concurrent publish rejected");
  s = await good("snapshot");
  assert.equal(s.fields.find((f: any) => f.key === key).sourceVersion, 2);
  checks.push("source invalidation from database write");
  // Source update enqueued exactly one field, automatically, since activation initialized tracking.
  const jobs = (
    await q(
      "select * from menu_translation_jobs where restaurant_id=$1 and status='queued'",
      [rid],
    )
  ).rows;
  assert.equal(jobs.length, 1);
  let job = (await q("select claim_menu_translation_job() r")).rows[0].r;
  assert.ok(job);
  // Human saves while AI runs. Worker must not overwrite the edit.
  s = await good("snapshot");
  const current = s.fields.find((f: any) => f.key === key);
  await good("save", { fields: [{ ...current, text: "Meat dumplings" }] });
  await q("select finish_menu_translation_job($1,$2,$3,null,100,100)", [
    job.id,
    job.lease,
    { [key]: "Manti with meat" },
  ]);
  s = await good("snapshot");
  assert.equal(
    s.fields.find((f: any) => f.key === key).draft,
    "Meat dumplings",
  );
  assert.equal(s.quota.used, 0);
  assert.equal(s.quota.reserved, 0);
  checks.push("AI/manual concurrent edit and quota release");
  await good("generate", { keys: [key], regenerate: true });
  const a = new pg.Client({ connectionString }),
    b = new pg.Client({ connectionString });
  await a.connect();
  await b.connect();
  await Promise.all(
    [a, b].map((c) =>
      c.query(
        "select set_config('request.jwt.claim.role','service_role',false)",
      ),
    ),
  );
  const claims = await Promise.all(
    [a, b].map((c) => c.query("select claim_menu_translation_job() r")),
  );
  await a.end();
  await b.end();
  assert.equal(claims.filter((c) => c.rows[0].r).length, 1);
  job = claims.find((c) => c.rows[0].r)!.rows[0].r;
  await q("select finish_menu_translation_job($1,$2,$3,null,100,100)", [
    job.id,
    job.lease,
    { [key]: "Meat-filled Manti" },
  ]);
  const after = await good("snapshot");
  const generatedField = after.fields.find((f: any) => f.key === key);
  assert.equal(generatedField.draft, "Meat-filled Manti");
  assert.equal(generatedField.manualDraft.text, "Meat dumplings");
  checks.push(
    "previous manual translation remains available beside a new AI draft",
  );
  assert.equal(after.quota.used, Array.from("Etli mantı").length);
  assert.equal(
    (
      await q("select finish_menu_translation_job($1,$2,$3,null,100,100) r", [
        job.id,
        job.lease,
        { [key]: "Meat dumplings" },
      ])
    ).rows[0].r,
    "lease_lost",
  );
  assert.equal((await good("snapshot")).quota.used, after.quota.used);
  checks.push("competing workers and exactly-once quota");
  await q("update menu_items set description='300 g yoğurt ile' where id=$1", [
    item,
  ]);
  job = (await q("select claim_menu_translation_job() r")).rows[0].r;
  await q("select finish_menu_translation_job($1,$2,null,$3)", [
    job.id,
    job.lease,
    "provider_unavailable",
  ]);
  assert.equal(
    (await q("select status from menu_translation_jobs where id=$1", [job.id]))
      .rows[0].status,
    "queued",
  );
  checks.push("provider failure retries durably");
  await q(
    "update menu_translation_usage set used=100000 where restaurant_id=$1",
    [rid],
  );
  const beforeJobs = (
    await q(
      "select count(*) from menu_translation_jobs where restaurant_id=$1",
      [rid],
    )
  ).rows[0].count;
  await q("update menu_items set name='Yeni mantı' where id=$1", [item]);
  assert.equal(
    (
      await q(
        "select count(*) from menu_translation_jobs where restaurant_id=$1",
        [rid],
      )
    ).rows[0].count,
    beforeJobs,
  );
  checks.push("quota exhaustion without source-write failure");
  await q(
    "update menu_translation_jobs set status='failed' where restaurant_id=$1 and status='queued'",
    [rid],
  );
  await q(
    "update menu_translation_usage set used=$2,reserved=0 where restaurant_id=$1",
    [rid, 100000 - Array.from("Yeni mantı").length],
  );
  const racers = await Promise.all(
    [0, 1].map(async () => {
      const c = new pg.Client({ connectionString });
      await c.connect();
      try {
        await c.query(
          "select set_config('request.jwt.claim.role','service_role',false)",
        );
        return (
          await c.query("select execute_menu_translation($1,$2,$3,$4,$5) r", [
            rid,
            actor,
            "generate",
            uuid(),
            { keys: [key] },
          ])
        ).rows[0].r;
      } finally {
        await c.end();
      }
    }),
  );
  assert.equal(racers.filter((r) => r.ok).length, 1);
  const raced = await good("snapshot");
  assert.equal(raced.quota.used + raced.quota.reserved, 100000);
  checks.push("simultaneous quota reservation cannot exceed allowance");
  assert.equal(
    (await q("select claim_menu_translation_job(0) r")).rows[0].r,
    null,
  );
  checks.push("provider spending cap blocks new calls");
  await q("update restaurants set plan='plus' where id=$1", [rid]);
  assert.equal((await publicView()).enabled, false);
  await q("update restaurants set plan='pro' where id=$1", [rid]);
  assert.equal((await publicView()).enabled, false);
  checks.push("downgrade preserves records and requires reactivation");
  await q(
    "insert into theme_configs(restaurant_id,tokens,published_at) values($1,$2,now()) on conflict(restaurant_id) do update set tokens=excluded.tokens",
    [
      rid,
      {
        sections: ["hero"],
        sectionSettings: {
          hero: {
            title: "Menü başlığı",
            buttonText: "#ffffff",
            imageUrl: "https://example.test/logo.png",
          },
          "home-only": { title: "Vitrin başlığı" },
        },
        surfaces: { home: { sections: [{ id: "home-only" }] } },
      },
    ],
  );
  const sourceKeys = (await good("snapshot")).fields.map((f: any) => f.key);
  assert.ok(sourceKeys.includes("theme/section/hero/title"));
  assert.ok(!sourceKeys.includes("theme/section/hero/buttonText"));
  assert.ok(!sourceKeys.includes("theme/section/home-only/title"));
  checks.push(
    "explicit menu theme allowlist excludes storefront and design values",
  );
  await q(
    "update billing_subscriptions set trial_ends_at=now()-interval '1 second' where restaurant_id=$1",
    [rid],
  );
  assert.equal((await good("snapshot")).allowed, false);
  checks.push("expired trial closes access");
  await q("begin");
  try {
    const endpoint =
      "https://yxsegwkzyiscrxiwdeuf.supabase.co/functions/v1/menu-translation-worker";
    for (let i = 0; i < 2; i++) {
      const configured = (
        await q("select configure_menu_translation_worker_vault($1,$2) r", [
          endpoint,
          "isolated-test-only-worker-secret-123456789",
        ])
      ).rows[0].r;
      assert.equal(configured.configured, true);
      assert.equal(configured.cronScheduled, true);
    }
    assert.equal(
      Number(
        (
          await q(
            "select count(*) n from vault.secrets where name in ('menu_translation_worker_url','menu_translation_worker_secret')",
          )
        ).rows[0].n,
      ),
      2,
    );
  } finally {
    await q("rollback");
  }
  checks.push(
    "worker Vault provisioning is idempotent and does not return secrets",
  );
  await q("set role anon");
  assert.equal((await publicView()).enabled, false);
  await assert.rejects(q("select * from menu_translation_fields"));
  await assert.rejects(
    q("select execute_menu_translation($1,$2,$3,null,$4)", [
      rid,
      actor,
      "snapshot",
      {},
    ]),
  );
  await assert.rejects(
    q("select configure_menu_translation_worker_vault($1,$2)", [
      "https://yxsegwkzyiscrxiwdeuf.supabase.co/functions/v1/menu-translation-worker",
      "not-allowed",
    ]),
  );
  await q("reset role");
  checks.push("anonymous RPC/table permission boundary");
  await q("select set_config('request.jwt.claim.role','authenticated',false)");
  await q("set role authenticated");
  for (const identity of [actor, member, stranger]) {
    await q("select set_config('request.jwt.claim.sub',$1,false)", [identity]);
    const rows = (await q("select restaurant_id from menu_translation_fields"))
      .rows;
    if (identity === stranger) assert.equal(rows.length, 0);
    else {
      assert.ok(rows.length > 0);
      assert.ok(rows.every((row) => row.restaurant_id === rid));
    }
    await assert.rejects(
      q(
        "update menu_translation_fields set published='forged' where restaurant_id=$1",
        [rid],
      ),
    );
  }
  await q("reset role");
  checks.push(
    "authenticated RLS isolates tenants and forbids direct draft/publication writes",
  );
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  await db.end();
}
