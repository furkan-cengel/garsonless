import { createClient } from "@supabase/supabase-js";
import { SUPABASE_TARGETS } from "../supabase-target.mjs";
const args = process.argv.slice(2);
const target = args.includes("--target")
  ? args[args.indexOf("--target") + 1]
  : "dev";
if (!(target in SUPABASE_TARGETS)) throw Error("Use --target dev|prod");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
if (
  !url ||
  !key ||
  new URL(url).origin !== `https://${SUPABASE_TARGETS[target]}.supabase.co`
)
  throw Error("Environment does not match the explicit target");
if (
  target === "prod" &&
  args[args.indexOf("--confirm-prod") + 1] !== SUPABASE_TARGETS.prod
)
  throw Error("PROD requires --confirm-prod with the production project ref");
if (apply && target === "dev" && !process.argv.includes("--confirm-dev"))
  throw Error("Use --confirm-dev for DEV catalogue import");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tenants = new Map(),
  unknown = [];
async function scan(prefix = "") {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage
      .from("restaurant-assets")
      .list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw error;
    for (const f of data ?? []) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      if (!f.id) {
        await scan(path);
        continue;
      }
      const match =
        /^restaurants\/([0-9a-f-]{36})\/(?:items|categories|theme|gallery|sections)\//i.exec(
          path,
        ) ?? /^[0-9a-f-]{36}\/([0-9a-f-]{36})\/logo(?:-|\.)/i.exec(path);
      if (!match) {
        if (!path.includes("/library/")) unknown.push(path);
        continue;
      }
      const bytes = Number(f.metadata?.size),
        mime = f.metadata?.mimetype;
      if (!Number.isSafeInteger(bytes) || bytes < 0 || typeof mime !== "string")
        throw Error(`Missing metadata for ${path}`);
      const objects = tenants.get(match[1]) ?? [];
      objects.push({
        path,
        name: f.name,
        mime,
        bytes,
        url: db.storage.from("restaurant-assets").getPublicUrl(path).data
          .publicUrl,
      });
      tenants.set(match[1], objects);
    }
    if ((data?.length ?? 0) < 100) break;
  }
}
await scan();
if (apply && unknown.length)
  throw Error(
    "Unclassified objects must be reviewed before applying the catalogue import",
  );
const { data: restaurants, error } = await db
  .from("restaurants")
  .select("id,owner_id")
  .is("deleted_at", null);
if (error) throw error;
const report = [];
for (const r of restaurants ?? []) {
  const objects = tenants.get(r.id) ?? [];
  if (apply) {
    // Existing URLs remain immutable; import registers objects without moving or rewriting them.
    for (let i = 0; i < objects.length; i += 50) {
      const result = await db.rpc("media_maintenance", {
        p_mode: "import",
        p_payload: { restaurantId: r.id, objects: objects.slice(i, i + 50) },
      });
      if (result.error) throw result.error;
    }
    const result = await db.rpc("media_maintenance", {
      p_mode: "initialize",
      p_payload: { restaurantId: r.id },
    });
    if (result.error) throw result.error;
    const check = await db.rpc("media_command", {
      p_restaurant: r.id,
      p_actor: r.owner_id,
      p_context: "files",
      p_mode: "list",
      p_payload: {},
    });
    if (check.error) throw check.error;
    if (check.data.used < objects.reduce((n, o) => n + o.bytes, 0))
      throw Error("Catalogue byte mismatch");
  }
  report.push({
    restaurantId: r.id,
    objects: objects.length,
    bytes: objects.reduce((n, o) => n + o.bytes, 0),
  });
}
console.log(
  JSON.stringify(
    {
      target: target.toUpperCase(),
      applied: apply,
      tenants: report,
      unclassifiedObjects: unknown.length,
      unclassifiedPaths: unknown,
    },
    null,
    2,
  ),
);
