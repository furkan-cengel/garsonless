import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// A DEV-only queue probe. It never edits catalog/settings/publications or reads the OpenAI secret.
const [mode, restaurantId, output] = process.argv.slice(2);
assert(
  ["smoke", "evaluation"].includes(mode),
  "Mode must be smoke or evaluation",
);
assert(
  /^[0-9a-f-]{36}$/.test(restaurantId ?? ""),
  "A DEV restaurant ID is required",
);
assert(output, "An output report path is required");
const env = parse(
  await readFile(
    new URL("../../../../apps/dashboard/.env.local", import.meta.url),
    "utf8",
  ),
);
const origin = "https://yxsegwkzyiscrxiwdeuf.supabase.co";
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, origin, "DEV project mismatch");
const db = createClient(origin, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function checked(query) {
  const r = await query;
  if (r.error) throw new Error(`Database operation failed (${r.error.code})`);
  return r.data;
}
assert.equal(
  await checked(
    db.rpc("menu_translation_allowed", { p_restaurant: restaurantId }),
  ),
  true,
  "Test restaurant must have translation access",
);
const pending = await checked(
  db
    .from("menu_translation_jobs")
    .select("id")
    .in("status", ["queued", "running"])
    .limit(1),
);
assert.equal(
  pending.length,
  0,
  "Wait for normal translation jobs before running verification",
);
const cases =
  mode === "smoke"
    ? [
        {
          key: "allergen",
          label: "Alerjen notu",
          source: "Süt ve yumurta içerir.",
        },
        {
          key: "quantity",
          label: "Ürün açıklaması",
          source: "250 g dana eti ile hazırlanır.",
        },
        {
          key: "removal",
          label: "Çıkarılabilir malzeme",
          source: "Soğan olmasın",
        },
      ]
    : JSON.parse(
        await readFile(
          new URL(
            "../../../../docs/menu-translation/2026-09-18/evaluation-cases.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
const runId = randomUUID(),
  prefix = `setup-verification/${runId}/`,
  period = `verification-${runId}`;
const fields = cases.map((c) => ({
  ...c,
  key: prefix + c.key,
  sourceVersion: 1,
  version: 1,
}));
const keys = fields.map((f) => f.key),
  jobIds = [];
const report = {
  checkedAt: new Date().toISOString(),
  project: "yxsegwkzyiscrxiwdeuf",
  mode,
  runId,
  model: "gpt-5.4-mini-2026-03-17",
  passed: false,
  results: [],
  jobs: [],
  cleanupComplete: false,
  humanReviewComplete: false,
};
const path = resolve(output);
await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
let terminal = true;
try {
  await checked(
    db
      .from("menu_translation_fields")
      .insert(
        fields.map((f) => ({
          restaurant_id: restaurantId,
          key: f.key,
          label: `Kurulum doğrulaması: ${f.label}`,
          source: f.source,
        })),
      ),
  );
  await checked(
    db
      .from("menu_translation_usage")
      .insert({
        restaurant_id: restaurantId,
        period,
        used: 0,
        reserved: fields.reduce((n, f) => n + Array.from(f.source).length, 0),
      }),
  );
  for (let i = 0; i < fields.length; i += 20) {
    const batch = fields.slice(i, i + 20),
      id = randomUUID();
    jobIds.push(id);
    await checked(
      db
        .from("menu_translation_jobs")
        .insert({
          id,
          restaurant_id: restaurantId,
          fields: batch.map(
            ({ key, label, source, sourceVersion, version }) => ({
              key,
              label,
              source,
              sourceVersion,
              version,
            }),
          ),
          glossary: {},
          period,
          characters: batch.reduce(
            (n, f) => n + Array.from(f.source).length,
            0,
          ),
        }),
    );
    terminal = false;
    await checked(db.rpc("invoke_menu_translation_worker"));
    const deadline = Date.now() + 210000;
    let job;
    while (Date.now() < deadline) {
      job = await checked(
        db
          .from("menu_translation_jobs")
          .select("id,status,error,attempts,input_tokens,output_tokens")
          .eq("id", id)
          .single(),
      );
      if (job.status === "queued" && job.error) {
        await checked(
          db
            .from("menu_translation_jobs")
            .update({ status: "failed" })
            .eq("id", id)
            .eq("status", "queued"),
        );
        continue;
      }
      if (["complete", "failed", "superseded"].includes(job.status)) {
        terminal = true;
        break;
      }
      await delay(1500);
    }
    assert(
      terminal,
      "Verification timed out; its records were retained to avoid deleting an active lease",
    );
    report.jobs.push(job);
    if (job.status !== "complete")
      throw new Error(
        `Provider verification did not complete (${job.error ?? job.status})`,
      );
  }
  const drafts = await checked(
    db
      .from("menu_translation_fields")
      .select("key,draft,source,published,draft_source_version")
      .eq("restaurant_id", restaurantId)
      .in("key", keys),
  );
  report.results = cases.map((c) => ({
    ...c,
    translation: drafts.find((d) => d.key === prefix + c.key)?.draft ?? null,
    acceptable: null,
    criticalError: null,
    reviewer: "",
    note: "",
  }));
  assert(
    drafts.length === fields.length &&
      drafts.every(
        (d) => d.draft && d.published === null && d.draft_source_version === 1,
      ),
    "Every result must be an unpublished current draft",
  );
  const usage = await checked(
    db
      .from("menu_translation_usage")
      .select("used,reserved")
      .eq("restaurant_id", restaurantId)
      .eq("period", period)
      .single(),
  );
  assert.equal(usage.reserved, 0);
  assert.equal(
    usage.used,
    fields.reduce((n, f) => n + Array.from(f.source).length, 0),
  );
  report.usage = usage;
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : "Verification failed";
  process.exitCode = 1;
} finally {
  if (terminal) {
    // Remove only this run's temporary private records. Provider spending totals remain accurate.
    if (jobIds.length) {
      await checked(
        db.from("menu_translation_attempts").delete().in("job_id", jobIds),
      );
      await checked(db.from("menu_translation_jobs").delete().in("id", jobIds));
    }
    await checked(
      db
        .from("menu_translation_history")
        .delete()
        .eq("restaurant_id", restaurantId)
        .in("field_key", keys),
    );
    await checked(
      db
        .from("menu_translation_fields")
        .delete()
        .eq("restaurant_id", restaurantId)
        .in("key", keys),
    );
    await checked(
      db
        .from("menu_translation_usage")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("period", period),
    );
    report.cleanupComplete = true;
  }
  await writeFile(path, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        error: report.error,
        translated: report.results.length,
        cleanupComplete: report.cleanupComplete,
        report: path,
        jobs: report.jobs,
      },
      null,
      2,
    ),
  );
}
