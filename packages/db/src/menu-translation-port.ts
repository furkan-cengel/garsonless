import type { MenuTranslationPort } from "@garsonless/application/menu-translation";
import {
  EMPTY_MENU_TRANSLATIONS,
  type PublicMenuTranslations,
  type TranslationResult,
} from "@garsonless/domain/menu-translation";
import { createServiceClient } from "./service-client";

function translationRpc(name: string, args: Record<string, unknown>) {
  const client = createServiceClient();
  const rpc = client.rpc.bind(client) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
  return rpc(name, args);
}
export function createMenuTranslationPort(): MenuTranslationPort {
  return {
    async execute(input) {
      const { data, error } = await translationRpc("execute_menu_translation", {
        p_restaurant: input.restaurantId,
        p_actor: input.actorId,
        p_mode: input.mode,
        p_request: input.requestId ?? null,
        p_payload: input.payload ?? {},
      });
      if (error || !data)
        return {
          ok: false,
          error: error?.code === "PGRST202" ? "not_initialized" : "unavailable",
        };
      const result = data as TranslationResult;
      // Run the worker now instead of waiting for the next cron minute, so a
      // translation asked for from the panel arrives in seconds. Same Vault
      // endpoint, secret, quota and budget checks as the scheduled run; a
      // failed kick only means the cron picks the job up as before.
      if (input.mode === "generate" && result.ok) {
        try {
          await translationRpc("invoke_menu_translation_worker", {});
        } catch {
          // The scheduled run still picks the job up.
        }
      }
      return result;
    },
  };
}
export async function readPublicMenuTranslations(
  restaurantId: string,
): Promise<PublicMenuTranslations> {
  const { data, error } = await translationRpc(
    "read_public_menu_translations",
    { p_restaurant: restaurantId },
  );
  // Translation availability must never stop the canonical Turkish menu.
  if (error || !data) return EMPTY_MENU_TRANSLATIONS;
  return data as PublicMenuTranslations;
}
