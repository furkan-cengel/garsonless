import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SUPABASE_TARGETS } from "./supabase-target.mjs";

const script = fileURLToPath(
  new URL("./media-library/backfill.mjs", import.meta.url),
);
function denied(args, target, message) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `https://${SUPABASE_TARGETS[target]}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "test-placeholder-not-a-credential",
    },
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, message);
}
test("media import rejects an environment that does not match its explicit target", () => {
  denied([], "prod", /Environment does not match/);
});
test("production media inventory requires its exact project confirmation", () => {
  denied(["--target", "prod"], "prod", /PROD requires/);
  denied(
    ["--target", "prod", "--confirm-prod", SUPABASE_TARGETS.dev],
    "prod",
    /PROD requires/,
  );
});
test("development media writes require explicit apply confirmation", () => {
  denied(["--apply"], "dev", /Use --confirm-dev/);
});
