"use server";
import { z } from "zod";
import { executeMenuTranslation } from "@garsonless/application/menu-translation";
import {
  TRANSLATION_MODES,
  type TranslationRequest,
  type TranslationResult,
} from "@garsonless/domain/menu-translation";
import { createMenuTranslationPort } from "@garsonless/db/server";
import { assertAccess } from "../auth/access";
const schema = z
  .object({
    restaurantId: z.string().uuid(),
    mode: z.enum(TRANSLATION_MODES),
    requestId: z.string().uuid().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export async function menuTranslationAction(
  request: TranslationRequest,
): Promise<TranslationResult> {
  const parsed = schema.safeParse(request);
  if (
    !parsed.success ||
    Buffer.byteLength(JSON.stringify(parsed.data)) > 300000
  )
    return { ok: false, error: "invalid_request" };
  const gate = await assertAccess(request.restaurantId, "menu");
  if ("error" in gate) return { ok: false, error: "forbidden" };
  try {
    return await executeMenuTranslation(
      {
        actor: "dashboard-member",
        restaurantId: request.restaurantId,
        userId: gate.userId,
        permissions: gate.access.permissions,
        isOwner: gate.access.isOwner,
      },
      parsed.data,
      createMenuTranslationPort(),
    );
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
