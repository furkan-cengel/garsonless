import test from "node:test";
import assert from "node:assert/strict";
import { executeMenuTranslation } from "./menu-translation";
import type { DashboardActorContext } from "@garsonless/domain/context";
const actor: DashboardActorContext = {
  actor: "dashboard-member",
  userId: "user",
  restaurantId: "one",
  permissions: ["menu"],
  isOwner: false,
};
test("menu staff may draft/publish but cannot activate a language or access another business", async () => {
  let calls = 0;
  const port = {
    execute: async () => {
      calls++;
      return { ok: false as const, error: "fixture" };
    },
  };
  await executeMenuTranslation(
    actor,
    { restaurantId: "one", mode: "publish", requestId: "request" },
    port,
  );
  assert.equal(calls, 1);
  assert.equal(
    (
      await executeMenuTranslation(
        actor,
        { restaurantId: "one", mode: "enable", requestId: "request" },
        port,
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await executeMenuTranslation(
        actor,
        { restaurantId: "other", mode: "snapshot" },
        port,
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await executeMenuTranslation(
        { ...actor, permissions: ["orders"] },
        { restaurantId: "one", mode: "snapshot" },
        port,
      )
    ).ok,
    false,
  );
  assert.equal(calls, 1);
});
