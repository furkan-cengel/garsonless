import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parse } from "dotenv";
import { SUPABASE_TARGETS, supabaseProcessEnv } from "../supabase-target.mjs";

// Uses explicit target matching. Uploads only two worker settings, never the app env file.
const args = process.argv.slice(2);
const target = args[0];
assert(
  target === "dev" || target === "prod",
  "Usage: configure-worker.mjs dev|prod [--confirm-prod PROJECT_REF]",
);
assert(
  target === "dev"
    ? args.length === 1
    : args.length === 3 &&
        args[1] === "--confirm-prod" &&
        args[2] === SUPABASE_TARGETS.prod,
  "Production requires an explicit matching --confirm-prod project ref",
);
const ref = SUPABASE_TARGETS[target];
const env = parse(
  readFileSync(
    new URL(
      `../../../../apps/dashboard/.env.${target === "dev" ? "local" : "production"}`,
      import.meta.url,
    ),
  ),
);
const origin = `https://${ref}.supabase.co`;
assert.equal(
  env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, ""),
  origin,
  "Environment/project mismatch",
);
assert(env.SUPABASE_SERVICE_ROLE_KEY, "Missing server credential");
const secret = randomBytes(32).toString("hex");
const endpoint = `${origin}/functions/v1/media-library-cleanup`;
const db = createClient(origin, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
try {
  // Use stdin: no secret command argument, log or temporary file.
  const result = spawnSync(
    `${packageRoot}/node_modules/.bin/supabase`,
    ["secrets", "set", "--project-ref", ref, "--env-file", "/dev/stdin"],
    {
      encoding: "utf8",
      cwd: packageRoot,
      env: supabaseProcessEnv(),
      input: `MEDIA_LIBRARY_CLEANUP_SECRET=${secret}\n`,
      timeout: 60000,
    },
  );
  if (result.status !== 0)
    throw new Error("Edge secret setup failed. No secret output was logged.");
  const { data, error } = await db.rpc("configure_media_cleanup_vault", {
    p_url: endpoint,
    p_secret: secret,
  });
  if (error)
    throw new Error(
      `Vault setup failed (${error.code}). Re-run this command to reconcile the worker and Vault secrets.`,
    );
  assert(
    data?.configured && data?.cronScheduled,
    "Worker configuration or cron is incomplete",
  );
  const unauthorized = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(
    unauthorized.status,
    401,
    "Worker must reject unauthenticated calls",
  );
  const probe = await fetch(endpoint, {
    method: "POST",
    headers: { "x-media-secret": secret },
    signal: AbortSignal.timeout(55000),
  });
  assert(probe.ok, "Worker runtime check failed");
  console.log(
    JSON.stringify(
      {
        target,
        project: ref,
        vaultConfigured: true,
        cronScheduled: true,
        unauthorizedRejected: true,
        workerReachable: true,
        cleanupReady: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  // Never stringify provider/SDK response bodies or credentials.
  console.error(
    error instanceof Error ? error.message : "Worker configuration failed",
  );
  process.exitCode = 1;
}
