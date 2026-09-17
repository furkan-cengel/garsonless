"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { executeInventory } from "@garsonless/application/inventory";
import {
  INVENTORY_MODES,
  type InventoryRequest,
  type InventoryResult,
} from "@garsonless/domain/inventory";
import { createInventoryPort } from "@garsonless/db/server";
import { assertAccess } from "../auth/access";
const schema = z
  .object({
    restaurantId: z.string().uuid(),
    mode: z.enum(INVENTORY_MODES),
    requestId: z.string().uuid().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export async function inventoryAction(
  request: InventoryRequest,
): Promise<InventoryResult> {
  const parsed = schema.safeParse(request);
  if (
    !parsed.success ||
    Buffer.byteLength(JSON.stringify(parsed.data)) > 700000
  )
    return { ok: false, error: "invalid_request" };
  const gate = await assertAccess(parsed.data.restaurantId, "inventory");
  if ("error" in gate) return { ok: false, error: "forbidden" };
  try {
    const result = await executeInventory(
      {
        actor: "dashboard-member",
        restaurantId: parsed.data.restaurantId,
        userId: gate.userId,
        permissions: gate.access.permissions,
        isOwner: gate.access.isOwner,
      },
      parsed.data,
      createInventoryPort(),
    );
    if (result.ok && request.mode !== "snapshot")
      revalidatePath(`/dashboard/${request.restaurantId}/inventory`);
    return result;
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
