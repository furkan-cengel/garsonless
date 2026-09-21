import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async (request) => {
  const secret = Deno.env.get("MEDIA_LIBRARY_CLEANUP_SECRET"),
    provided = request.headers.get("x-media-secret") ?? "";
  if (
    !secret ||
    secret.length !== provided.length ||
    !Array.from(secret).reduce(
      (ok, c, i) => ok & (c.charCodeAt(0) ^ provided.charCodeAt(i) ? 0 : 1),
      1,
    )
  )
    return new Response("Unauthorized", { status: 401 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: jobs, error } = await db.rpc("media_maintenance", {
    p_mode: "sweep",
    p_payload: {},
  });
  if (error)
    return Response.json({ error: "cleanup_unavailable" }, { status: 503 });
  let cleaned = 0,
    failed = 0;
  const start = Date.now();
  for (const job of jobs ?? []) {
    if (Date.now() - start > 40000) break;
    const result = await db.storage.from(job.bucket).remove([job.path]);
    if (result.error) {
      failed++;
      continue;
    }
    const done = await db.rpc("media_maintenance", {
      p_mode: "cleaned",
      p_payload: { id: job.id },
    });
    if (done.error) failed++;
    else cleaned++;
  }
  const audit = await db.rpc("audit_media_storage");
  const mismatches = Array.isArray(audit.data) ? audit.data.length : null;
  if (audit.error || mismatches)
    console.error("media_quota_reconciliation", {
      mismatches,
      unavailable: Boolean(audit.error),
    });
  return Response.json({ cleaned, failed, quotaMismatches: mismatches });
});
