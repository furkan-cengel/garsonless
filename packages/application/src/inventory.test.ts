import test from "node:test";
import assert from "node:assert/strict";
import { executeInventory, type InventoryPort } from "./inventory";
import type { DashboardActorContext } from "@garsonless/domain/context";
const actor: DashboardActorContext = {
  actor: "dashboard-member",
  restaurantId: "one",
  userId: "staff",
  permissions: ["inventory"],
};
test("inventory rejects foreign tenants, missing permission and owner commands before infrastructure", async () => {
  let calls = 0;
  const port: InventoryPort = {
    async execute() {
      calls++;
      return {
        ok: true,
        data: { documentId: null, id: null, balances: [], warnings: [] },
      };
    },
  };
  for (const request of [
    { restaurantId: "two", mode: "snapshot" as const },
    { restaurantId: "one", mode: "count_approve" as const, requestId: "id" },
  ])
    assert.equal((await executeInventory(actor, request, port)).ok, false);
  assert.equal(
    (
      await executeInventory(
        { ...actor, permissions: [] },
        { restaurantId: "one", mode: "snapshot" },
        port,
      )
    ).ok,
    false,
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await executeInventory(
        actor,
        { restaurantId: "one", mode: "receipt", requestId: "id" },
        port,
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await executeInventory(
        { ...actor, isOwner: true },
        { restaurantId: "one", mode: "count_approve", requestId: "id" },
        port,
      )
    ).ok,
    true,
  );
});
