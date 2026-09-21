import { test } from "node:test";
import assert from "node:assert/strict";
import { executeMediaCommand, type MediaLibraryPort } from "./media-library";
test("context access cannot become library management or a different tenant", async () => {
  let calls = 0;
  const port: MediaLibraryPort = {
    async command<T>(restaurant: string, actor: string, context: string) {
      calls++;
      assert.equal(restaurant, "r");
      assert.equal(actor, "u");
      assert.equal(context, "menu");
      return {} as T;
    },
  };
  const actor = {
    restaurantId: "r",
    userId: "u",
    permissions: ["menu"],
    isOwner: false,
  };
  await executeMediaCommand(actor, "menu", "list", {}, port);
  await assert.rejects(
    executeMediaCommand(actor, "files", "list", {}, port),
    /forbidden/,
  );
  await assert.rejects(
    executeMediaCommand(actor, "menu", "delete", {}, port),
    /forbidden/,
  );
  assert.equal(calls, 1);
});
