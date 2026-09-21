import assert from "node:assert/strict";
import { parseEnv as parse } from "node:util";
import { randomUUID, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd(),
  app = resolve(root, "apps/dashboard"),
  req = createRequire(resolve(app, "package.json"));
const { createClient } = req("@supabase/supabase-js"),
  { createServerClient } = req("@supabase/ssr"),
  sharp = req("sharp");
const env = parse(await readFile(resolve(app, ".env.local"), "utf8"));
assert.equal(
  new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  "yxsegwkzyiscrxiwdeuf.supabase.co",
);
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const base = "http://localhost:3028",
  rid = randomUUID(),
  email = `media-${randomUUID()}@example.test`,
  password = randomBytes(32).toString("hex");
assert.equal(
  await fetch(base).then(
    () => true,
    () => false,
  ),
  false,
  "QA port must be free",
);
const backups = await Promise.all(
  ["tsconfig.json", "next-env.d.ts"].map(async (f) => [
    f,
    await readFile(resolve(app, f)),
  ]),
);
let user,
  server,
  logs = "",
  cookie = "",
  paths = [];
const checks = [];
function checked(r) {
  if (r.error)
    throw Error(
      `DEV fixture operation failed: ${r.error.code ?? r.error.message}`,
    );
  return r.data;
}
async function call(mode, payload = {}) {
  const r = await fetch(base + "/api/media-library", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    body: JSON.stringify({
      restaurantId: rid,
      context: "files",
      mode,
      payload,
    }),
  });
  const body = await r.json();
  if (!body.ok) throw Error(`API ${mode}: ${body.error}`);
  return body.data;
}
try {
  user = checked(
    await db.auth.admin.createUser({ email, password, email_confirm: true }),
  ).user;
  checked(
    await db
      .from("restaurants")
      .insert({
        id: rid,
        owner_id: user.id,
        name: "Media isolated QA",
        slug: `media-qa-${rid}`,
        plan: "starter",
      }),
  );
  const jar = new Map();
  const auth = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => {
          for (const v of values) jar.set(v.name, v.value);
        },
      },
    },
  );
  checked(await auth.auth.signInWithPassword({ email, password }));
  cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3028",
    ],
    {
      cwd: app,
      env: {
        ...process.env,
        ...env,
        DASHBOARD_DEVICE_SECURITY_ENABLED: "false",
        NEXT_DIST_DIR: ".next-media-storage-qa",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (x) => (logs += x));
  server.stderr.on("data", (x) => (logs += x));
  for (let i = 0; i < 180; i++) {
    if (
      await fetch(base + "/api/media-library", { method: "GET" }).then(
        (r) => r.status === 405,
        () => false,
      )
    )
      break;
    if (i === 179) throw Error("QA server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
  const initial = await call("list");
  assert.equal(initial.initialized, true);
  assert.equal(initial.used, 0);
  const bytes = await sharp({
    create: { width: 900, height: 600, channels: 3, background: "#42a576" },
  })
    .png()
    .toBuffer();
  async function upload() {
    const id = randomUUID();
    const ticket = await call("prepare", {
      id,
      name: "Integration.png",
      size: bytes.length,
      type: "image/png",
    });
    const path = `library/${rid}/${id}/source`;
    paths.push(["restaurant-media-staging", path]);
    const r = await fetch(ticket.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png", "x-upsert": "false" },
      body: bytes,
    });
    assert.ok(r.ok, "Storage signed upload failed");
    return { id, ...(await call("complete", { id })) };
  }
  const first = await upload();
  assert.ok(first.asset.menuUrl.endsWith("/menu.webp"));
  assert.ok(first.asset.logoUrl.endsWith("/logo.webp"));
  checks.push("real signed upload and server image conversion");
  const objects = checked(
    await db
      .from("media_asset_objects")
      .select("bucket,path,bytes")
      .eq("restaurant_id", rid),
  );
  paths.push(...objects.map((o) => [o.bucket, o.path]));
  const total = objects.reduce((n, o) => n + o.bytes, 0);
  assert.equal((await call("list")).used, total);
  assert.equal(
    (await call("complete", { id: first.id })).asset.id,
    first.asset.id,
  );
  const second = await upload();
  assert.equal(second.asset.id, first.asset.id);
  assert.equal((await call("list")).used, total);
  checks.push("idempotent completion and content deduplication");
  const logo = await call("resolve", { id: first.asset.id, purpose: "logo" });
  const response = await fetch(logo.url);
  assert.ok(response.ok);
  const dimensions = await sharp(
    Buffer.from(await response.arrayBuffer()),
  ).metadata();
  assert.ok(dimensions.width <= 512);
  checks.push("logo dimensions and public derivative");
  const source = objects.find((o) => o.bucket === "restaurant-media-sources");
  const privateResponse = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${source.bucket}/${source.path}`,
  );
  assert.equal(privateResponse.ok, false);
  checks.push("original remains private");
  await call("delete", { id: first.asset.id, version: first.asset.version });
  for (let i = 0; i < 40; i++) {
    if ((await call("list")).used === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal((await call("list")).used, 0);
  checks.push("physical cleanup releases quota");
  console.log(
    JSON.stringify({ target: "DEV isolated fixture", checks }, null, 2),
  );
} catch (e) {
  await writeFile("/tmp/media-storage-check.log", logs);
  throw e;
} finally {
  // Delete only exact paths and records created by this run.
  const remaining = await db
    .from("media_asset_objects")
    .select("bucket,path")
    .eq("restaurant_id", rid);
  for (const o of remaining.data ?? []) paths.push([o.bucket, o.path]);
  for (const [bucket, path] of paths)
    await db.storage.from(bucket).remove([path]);
  if (user) {
    checked(await db.from("restaurants").delete().eq("id", rid));
    checked(await db.auth.admin.deleteUser(user.id));
  }
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  for (const [f, b] of backups) await writeFile(resolve(app, f), b);
  await rm(resolve(app, ".next-media-storage-qa"), {
    recursive: true,
    force: true,
  });
}
