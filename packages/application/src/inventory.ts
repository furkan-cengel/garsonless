import type { DashboardActorContext } from "@garsonless/domain/context";
import {
  INVENTORY_MODES,
  type InventoryRequest,
  type InventoryResult,
} from "@garsonless/domain/inventory";
export interface InventoryPort {
  execute(
    input: InventoryRequest & { actorId: string },
  ): Promise<InventoryResult>;
}
export async function executeInventory(
  actor: DashboardActorContext,
  request: InventoryRequest,
  port: InventoryPort,
): Promise<InventoryResult> {
  if (
    actor.restaurantId !== request.restaurantId ||
    (!actor.isOwner && !actor.permissions.includes("inventory"))
  )
    return { ok: false, error: "forbidden" };
  if (
    !INVENTORY_MODES.includes(request.mode) ||
    (request.mode !== "snapshot" && !request.requestId)
  )
    return { ok: false, error: "invalid_request" };
  if (
    [
      "count_approve",
      "adjustment",
      "return",
      "activate",
      "pause",
      "import",
    ].includes(request.mode) &&
    !actor.isOwner
  )
    return { ok: false, error: "forbidden" };
  return port.execute({ ...request, actorId: actor.userId });
}
