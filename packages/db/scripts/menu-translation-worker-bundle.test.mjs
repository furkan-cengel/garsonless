import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("the deployable translation worker uses the exact tested application adapter", () => {
  const source = readFileSync(
    new URL(
      "../../application/src/menu-translation-provider.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const copy = readFileSync(
    new URL(
      "../supabase/functions/_shared/menu-translation-provider.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(copy.split("\n").slice(2).join("\n"), source);
  const entry = readFileSync(
    new URL(
      "../supabase/functions/menu-translation-worker/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(entry.includes("../_shared/menu-translation-provider.ts"));
});
