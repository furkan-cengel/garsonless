import type { InventoryPort } from "@garsonless/application/inventory";
import type {
  InventoryInsights,
  InventoryResult,
  InventorySnapshot,
} from "@garsonless/domain/inventory";
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
      const result = data as InventoryResult;
      // The overview's figures come with the first page of a plain snapshot, which
      // execute_inventory has already authorized. They are optional: a failure
      // here leaves the snapshot intact.
      if (
        result.ok &&
        input.mode === "snapshot" &&
        !input.payload?.["documentId"] &&
        !Number(input.payload?.["offset"] ?? 0)
      ) {
        const insights = await rpc("inventory_insights", { p_restaurant: input.restaurantId });
        if (!insights.error && insights.data)
          (result.data as InventorySnapshot).insights = insights.data as InventoryInsights;
        else if (insights.error)
          console.error("inventory insights failed", { message: insights.error.message });
      }
      return result;
    },
  };
}
