import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createOpenAIMenuTranslationProvider,
  TranslationProviderError,
} from "../_shared/menu-translation-provider.ts";
import { workerSecretMatches } from "../_shared/worker-secret.ts";

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("MENU_TRANSLATION_WORKER_SECRET");
  if (
    request.method !== "POST" ||
    !(await workerSecretMatches(request.headers.get("x-translation-secret"), secret))
  )
    return new Response("Unauthorized", { status: 401 });
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key)
    return Response.json({ error: "provider_not_configured" }, { status: 503 });
  const budget = Number(
    Deno.env.get("MENU_TRANSLATION_MONTHLY_BUDGET_USD") ?? "20",
  );
  if (!Number.isFinite(budget) || budget < 0)
    return Response.json({ error: "invalid_budget" }, { status: 503 });
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: job, error } = await db.rpc("claim_menu_translation_job", {
    p_budget_microdollars: Math.floor(budget * 1_000_000),
  });
  if (error)
    return Response.json({ error: "queue_unavailable" }, { status: 503 });
  if (!job) return Response.json({ processed: 0 });
  let result: {
    p_translations?: Record<string, string>;
    p_error?: string;
    p_input_tokens?: number;
    p_output_tokens?: number;
  };
  try {
    const translated = await createOpenAIMenuTranslationProvider(key).translate(
      job.fields,
      job.glossary,
    );
    result = {
      p_translations: translated.translations,
      p_input_tokens: translated.inputTokens,
      p_output_tokens: translated.outputTokens,
    };
  } catch (error) {
    result =
      error instanceof TranslationProviderError
        ? {
            p_error: error.code,
            p_input_tokens: error.inputTokens,
            p_output_tokens: error.outputTokens,
          }
        : {
            p_error:
              error instanceof Error && error.name === "TimeoutError"
                ? "timeout"
                : "provider_unavailable",
          };
  }
  const { data: status, error: finishError } = await db.rpc(
    "finish_menu_translation_job",
    { p_job: job.id, p_lease: job.lease, ...result },
  );
  // Never log source text, provider responses, keys or customer data.
  return Response.json(
    {
      processed: finishError ? 0 : 1,
      status: finishError ? "completion_unavailable" : status,
    },
    { status: finishError ? 503 : 200 },
  );
});
