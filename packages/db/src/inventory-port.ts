import type { InventoryPort } from "@garsonless/application/inventory";
import type { InventoryResult } from "@garsonless/domain/inventory";
import { createServiceClient } from "./service-client";
export function createInventoryPort(): InventoryPort {
  return {
    async execute(input) {
      const service = createServiceClient();
      const rpc = service.rpc.bind(service) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { message: string; code?: string } | null;
      }>;
      const { data, error } = await rpc("execute_inventory", {
        p_restaurant_id: input.restaurantId,
        p_actor_id: input.actorId,
        p_mode: input.mode,
        p_request_id: input.requestId ?? null,
        p_payload: input.payload ?? {},
      });
      if (error || !data) {
        if (error)
          console.error("inventory command failed", {
            mode: input.mode,
            message: error.message,
          });
        return {
          ok: false,
          error: error?.code === "PGRST202" ? "not_initialized" : "unavailable",
        };
      }
      return data as InventoryResult;
    },
  };
}
