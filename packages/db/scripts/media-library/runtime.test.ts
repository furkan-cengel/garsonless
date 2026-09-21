import assert from "node:assert/strict";
import { randomUUID as uuid } from "node:crypto";
import pg from "pg";
const connectionString =
  "postgresql://postgres:translation-test-only@127.0.0.1:55440/postgres";
const db = new pg.Client({ connectionString });
await db.connect();
const q = (s: string, v: unknown[] = []) => db.query(s, v);
const rid = uuid(),
  owner = uuid(),
  outsider = uuid(),
  member = uuid(),
  cat = uuid(),
  assetId = uuid(),
  url = `https://media.test/storage/v1/object/public/restaurant-assets/restaurants/${rid}/library/${assetId}/image.webp`;
const checks: string[] = [];
const command = async (
  mode: string,
  payload: Record<string, unknown> = {},
  actor = owner,
  context = "files",
) =>
  (
    await q("select media_command($1,$2,$3,$4,$5) r", [
      rid,
      actor,
      context,
      mode,
      payload,
    ])
  ).rows[0].r;
async function fail(
  mode: string,
  payload: Record<string, unknown>,
  pattern: RegExp,
  actor = owner,
  context = "files",
) {
  await assert.rejects(command(mode, payload, actor, context), pattern);
}
try {
  await q("select set_config('request.jwt.claim.role','service_role',false)");
  for (const id of [owner, outsider, member])
    await q("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${id}@media.test`,
    ]);
  await q(
    "insert into restaurants(id,owner_id,name,slug,plan) values($1,$2,'Media test',$3,'starter')",
    [rid, owner, `media-${rid}`],
  );
  await q(
    "select media_maintenance('initialize',jsonb_build_object('restaurantId',$1::text))",
    [rid],
  );
  assert.equal((await command("list")).limit, 250000000);
  await fail("list", {}, /forbidden/, outsider);
  checks.push("tenant boundary");
  await q(
    "insert into restaurant_members(restaurant_id,user_id,email,status,permissions) values($1,$2,$3,'active','[\"menu\"]')",
    [rid, member, `${member}@media.test`],
  );
  await command("list", {}, member, "menu");
  await fail("list", {}, /forbidden/, member);
  checks.push("scoped team access");
  const input = {
    id: assetId,
    name: "Menu.webp",
    size: 100,
    type: "image/webp",
  };
  const session = await command("prepare", input);
  await command("prepare", input);
  assert.equal((await command("list")).reserved, session.reserved);
  await fail("prepare", { ...input, name: "Different" }, /request_mismatch/);
  checks.push("idempotent quota reservation");
  const claim = await command("claim", { id: assetId });
  assert.equal(await command("claim", { id: assetId }), null);
  await command("hash", {
    id: assetId,
    token: claim.token,
    hash: "a".repeat(64),
  });
  await command("finish", {
    id: assetId,
    token: claim.token,
    width: 10,
    height: 10,
    objects: [
      {
        role: "image",
        bucket: "restaurant-assets",
        path: `restaurants/${rid}/library/${assetId}/image.webp`,
        bytes: 80,
        url,
      },
    ],
  });
  await command("finish", { id: assetId, token: claim.token, objects: [] });
  assert.equal((await command("list")).used, 80);
  assert.equal((await command("list")).reserved, 0);
  checks.push("finish replay and actual bytes");
  const second = uuid();
  await command("prepare", { ...input, id: second });
  const c2 = await command("claim", { id: second });
  const dedup = await command("hash", {
    id: second,
    token: c2.token,
    hash: "a".repeat(64),
  });
  assert.equal(dedup.result_id, assetId);
  assert.equal((await command("list")).used, 80);
  assert.equal((await command("list")).reserved, 0);
  checks.push("dedup does not double charge");
  await q(
    "insert into menu_categories(id,restaurant_id,name,image_url) values($1,$2,$3,$4)",
    [cat, rid, "Category", url],
  );
  const item = uuid();
  await q(
    "insert into menu_items(id,category_id,name,price,images) values($1,$2,$3,1,$4)",
    [item, cat, "Item", JSON.stringify([url])],
  );
  assert.equal((await command("asset", { id: assetId })).uses.length, 2);
  await q("delete from menu_items where id=$1", [item]);
  const a = await command("asset", { id: assetId });
  assert.equal(a.uses.length, 1);
  await fail("delete", { id: assetId, version: 1 }, /in_use/);
  await fail(
    "metadata",
    { id: assetId, version: 1, name: "X", alt: "" },
    /forbidden/,
    member,
    "menu",
  );
  checks.push("references protect deletion and metadata permission");
  await q("update menu_categories set image_url=null where id=$1", [cat]);
  await command("metadata", {
    id: assetId,
    version: 1,
    name: "Updated",
    alt: "Image",
  });
  await fail(
    "metadata",
    { id: assetId, version: 1, name: "Stale", alt: "" },
    /conflict/,
  );
  await command("delete", { id: assetId, version: 2 });
  assert.equal((await command("list")).used, 80);
  await assert.rejects(
    q("update menu_categories set image_url=$1 where id=$2", [url, cat]),
    /media_not_available/,
  );
  const jobs = (await q("select media_maintenance('sweep') r")).rows[0].r;
  for (const j of jobs.filter(
    (j: { asset_id: string }) => j.asset_id === assetId,
  ))
    await q(
      "select media_maintenance('cleaned',jsonb_build_object('id',$1::bigint))",
      [j.id],
    );
  assert.equal((await command("list")).used, 0);
  await assert.rejects(
    q("update menu_categories set image_url=$1 where id=$2", [url, cat]),
    /media_not_available/,
  );
  checks.push(
    "delete releases only after cleanup and tombstones block stale attach",
  );

  const legacyPath = `restaurants/${rid}/items/legacy.webp`,
    legacyUrl = `https://media.test/storage/v1/object/public/restaurant-assets/${legacyPath}`;
  await q("select media_maintenance('import',$1)", [
    {
      restaurantId: rid,
      objects: [
        {
          path: legacyPath,
          url: legacyUrl,
          name: "Legacy",
          mime: "image/webp",
          bytes: 90,
        },
      ],
    },
  ]);
  const legacy = (await command("list")).assets[0];
  const derivation = await command("derive", { id: legacy.id });
  const lease = await command("claim", { id: derivation.id });
  await command("fail", { id: derivation.id, token: lease.token });
  const derivedJobs = (
    await q("select media_maintenance('sweep') r")
  ).rows[0].r.filter((j: { asset_id: string }) => j.asset_id === legacy.id);
  assert.equal(derivedJobs.length, 2);
  assert.ok(
    derivedJobs.every(
      (j: { path: string }) =>
        j.path.endsWith("/menu.webp") || j.path.endsWith("/logo.webp"),
    ),
  );
  for (const j of derivedJobs)
    await q(
      "select media_maintenance('cleaned',jsonb_build_object('id',$1::bigint))",
      [j.id],
    );
  assert.equal((await command("asset", { id: legacy.id })).url, legacyUrl);
  assert.equal((await command("list")).reserved, 0);
  const retry = await command("derive", { id: legacy.id });
  const retryLease = await command("claim", { id: retry.id });
  await command("finish", {
    id: retry.id,
    token: retryLease.token,
    objects: ["menu", "logo"].map((role) => ({
      role,
      bucket: "restaurant-assets",
      path: `restaurants/${rid}/library/${legacy.id}/${role}.webp`,
      bytes: 20,
      url: `https://media.test/${role}.webp`,
    })),
  });
  assert.equal((await command("list")).used, 130);
  assert.equal((await command("derive", { id: legacy.id })).status, "complete");
  checks.push("legacy derivation failure, cleanup, retry and accounting");
  await command("delete", { id: legacy.id, version: 1 });
  const deletion = (
    await q("select media_maintenance('sweep') r")
  ).rows[0].r.filter((j: { asset_id: string }) => j.asset_id === legacy.id);
  for (const j of deletion)
    await q(
      "select media_maintenance('cleaned',jsonb_build_object('id',$1::bigint))",
      [j.id],
    );
  assert.equal((await command("list")).used, 0);
  // Two independent connections contend for the final reservation.
  await q(
    "update media_storage_usage set used=230000000 where restaurant_id=$1",
    [rid],
  );
  const race = await Promise.all(
    [1, 2].map(async () => {
      const c = new pg.Client({ connectionString });
      await c.connect();
      try {
        await c.query(
          "select set_config('request.jwt.claim.role','service_role',false)",
        );
        await c.query("select media_command($1,$2,$3,$4,$5)", [
          rid,
          owner,
          "files",
          "prepare",
          { id: uuid(), name: "Race", size: 100, type: "image/png" },
        ]);
        return true;
      } catch (e) {
        assert.match(String(e), /quota_exceeded/);
        return false;
      } finally {
        await c.end();
      }
    }),
  );
  assert.equal(race.filter(Boolean).length, 1);
  checks.push("concurrent quota race");
  await q("update media_storage_usage set used=0 where restaurant_id=$1", [
    rid,
  ]);
  await q(
    "update media_upload_sessions set expires_at=now()-interval '1 day' where restaurant_id=$1 and status='pending'",
    [rid],
  );
  const expired = (await q("select media_maintenance('sweep') r")).rows[0].r;
  for (const j of expired.filter(
    (j: { restaurant_id: string }) => j.restaurant_id === rid,
  ))
    await q(
      "select media_maintenance('cleaned',jsonb_build_object('id',$1::bigint))",
      [j.id],
    );
  assert.equal((await command("list")).reserved, 0);
  checks.push("expired reservations reclaimed after cleanup");
  await q("set role authenticated");
  await q("select set_config('request.jwt.claim.sub',$1,false)", [outsider]);
  assert.equal((await q("select * from media_assets")).rows.length, 0);
  await assert.rejects(
    q("select media_command($1,$2,$3,$4,$5)", [
      rid,
      owner,
      "files",
      "list",
      {},
    ]),
    /permission denied/,
  );
  await q("reset role");
  checks.push("RLS and direct RPC denial");
  const audit = (await q("select audit_media_storage() r")).rows[0].r;
  assert.equal(
    audit.filter((r: { restaurant_id: string }) => r.restaurant_id === rid)
      .length,
    0,
  );
  assert.ok(
    (
      await q(
        "select count(*)::int n from media_operation_events where restaurant_id=$1",
        [rid],
      )
    ).rows[0].n > 0,
  );
  checks.push("operation evidence and quota reconciliation");
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  await q("reset role");
  await q("delete from menu_categories where restaurant_id=$1", [rid]);
  await q("delete from restaurants where id=$1", [rid]);
  for (const id of [owner, outsider, member])
    await q("delete from auth.users where id=$1", [id]);
  await db.end();
}
