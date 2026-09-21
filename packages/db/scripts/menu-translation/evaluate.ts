/** Synthetic menu text only. Never reads tenants, customers, or project .env files. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAIMenuTranslationProvider } from "../../../application/src/menu-translation-provider";

type Review = {
  key: string;
  label: string;
  source: string;
  reviewFocus: string;
  translation?: string;
  acceptable?: boolean | null;
  criticalError?: boolean | null;
  reviewer?: string;
  note?: string;
};
const [mode, filename] = process.argv.slice(2);
if (!filename || !["generate", "report"].includes(mode ?? ""))
  throw new Error(
    "Usage: evaluate.ts generate|report /absolute/path/review.json",
  );
const path = resolve(filename);
const cases = JSON.parse(
  await readFile(
    new URL(
      "../../../../docs/menu-translation/2026-09-18/evaluation-cases.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Review[];
if (mode === "generate") {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required. No request was made.");
  // Reserve a new file before sending any paid requests; do not overwrite reviews.
  await writeFile(path, "[]\n", { flag: "wx" });
  const provider = createOpenAIMenuTranslationProvider(key);
  const reviews: Review[] = [];
  let inputTokens = 0,
    outputTokens = 0;
  for (let i = 0; i < cases.length; i += 10) {
    const batch = cases.slice(i, i + 10);
    const result = await provider.translate(
      batch.map(({ key, label, source }) => ({ key, label, source })),
      {},
    );
    inputTokens += result.inputTokens;
    outputTokens += result.outputTokens;
    reviews.push(
      ...batch.map((row) => ({
        ...row,
        translation: result.translations[row.key],
        acceptable: null,
        criticalError: null,
        reviewer: "",
        note: "",
      })),
    );
    await writeFile(path, JSON.stringify(reviews, null, 2) + "\n");
  }
  console.log(
    JSON.stringify({
      generated: reviews.length,
      inputTokens,
      outputTokens,
      reviewFile: path,
      next: "Bilingual human review required; then run report.",
    }),
  );
} else {
  const reviews = JSON.parse(await readFile(path, "utf8")) as Review[];
  const valid =
    Array.isArray(reviews) &&
    reviews.length === cases.length &&
    cases.length >= 100 &&
    new Set(reviews.map((r) => r.key)).size === reviews.length &&
    cases.every((c) =>
      reviews.some(
        (r) =>
          r.key === c.key &&
          r.source === c.source &&
          r.translation?.trim() &&
          r.reviewer?.trim() &&
          typeof r.acceptable === "boolean" &&
          typeof r.criticalError === "boolean",
      ),
    );
  const accepted = reviews.filter((r) => r.acceptable === true).length;
  const criticalErrors = reviews.filter((r) => r.criticalError === true).length;
  const acceptanceRate = reviews.length ? accepted / reviews.length : 0;
  const passed = valid && criticalErrors === 0 && acceptanceRate >= 0.95;
  console.log(
    JSON.stringify(
      {
        reviewed: reviews.length,
        complete: valid,
        accepted,
        acceptanceRate,
        criticalErrors,
        passed,
        fixture: fileURLToPath(
          new URL(
            "../../../../docs/menu-translation/2026-09-18/evaluation-cases.json",
            import.meta.url,
          ),
        ),
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
}
