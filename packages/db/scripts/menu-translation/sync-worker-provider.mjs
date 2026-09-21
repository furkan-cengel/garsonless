import { readFile, writeFile } from "node:fs/promises";
const source = new URL(
  "../../../application/src/menu-translation-provider.ts",
  import.meta.url,
);
const target = new URL(
  "../../supabase/functions/_shared/menu-translation-provider.ts",
  import.meta.url,
);
const content =
  "// Generated from packages/application/src/menu-translation-provider.ts.\n// Refresh with: node packages/db/scripts/menu-translation/sync-worker-provider.mjs\n" +
  (await readFile(source, "utf8"));
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== content)
    throw new Error(
      "Worker provider bundle is stale. Run sync-worker-provider.mjs.",
    );
  console.log("Worker provider bundle matches application adapter.");
} else {
  await writeFile(target, content);
  console.log("Worker provider bundle synchronized.");
}
