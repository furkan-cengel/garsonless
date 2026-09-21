import type { DashboardActorContext } from "@garsonless/domain/context";
import {
  TRANSLATION_MODES,
  type TranslationRequest,
  type TranslationResult,
} from "@garsonless/domain/menu-translation";
export interface MenuTranslationPort {
  execute(
    input: TranslationRequest & { actorId: string },
  ): Promise<TranslationResult>;
}
export async function executeMenuTranslation(
  actor: DashboardActorContext,
  request: TranslationRequest,
  port: MenuTranslationPort,
): Promise<TranslationResult> {
  if (
    actor.restaurantId !== request.restaurantId ||
    (!actor.isOwner && !actor.permissions.includes("menu"))
  )
    return { ok: false, error: "forbidden" };
  if (["enable", "disable"].includes(request.mode) && !actor.isOwner)
    return { ok: false, error: "forbidden" };
  if (
    !TRANSLATION_MODES.includes(request.mode) ||
    (request.mode !== "snapshot" && !request.requestId)
  )
    return { ok: false, error: "invalid_request" };
  return port.execute({ ...request, actorId: actor.userId });
}
