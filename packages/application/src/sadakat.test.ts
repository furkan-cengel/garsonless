import assert from "node:assert/strict";
import test from "node:test";
import {
  mutateSadakat,
  normalizeSadakatCode,
  saveSadakat,
  type SadakatPort,
} from "./sadakat";
const restaurantId = "10000000-0000-4000-8000-000000000001",
  actorId = "10000000-0000-4000-8000-000000000002",
  requestId = "10000000-0000-4000-8000-000000000003";
test("invalid commands never reach persistence", async () => {
  let calls = 0;
  const port: SadakatPort = {
    save: async () => {
      calls++;
    },
    resolve: async () => {
      calls++;
    },
    mutate: async () => {
      calls++;
      return { id: requestId, stamps: 2, delta: 2, kind: "earn" };
    },
  };
  for (const quantity of [0, 21, 1.5, NaN])
    await assert.rejects(
      () =>
        mutateSadakat(
          {
            restaurantId,
            actorId,
            requestId,
            kind: "earn",
            code: "ABCDEF1234567890",
            quantity,
          },
          port,
        ),
      /SADAKAT_INVALID/,
    );
  await assert.rejects(
    () =>
      mutateSadakat(
        {
          restaurantId,
          actorId,
          requestId,
          kind: "reversal",
          reverseId: requestId,
          reason: "",
        },
        port,
      ),
    /SADAKAT_REASON_REQUIRED/,
  );
  await assert.rejects(
    () =>
      saveSadakat(
        restaurantId,
        actorId,
        {
          name: "Cafe",
          logoUrl: "javascript:alert(1)",
          color: "#174C3C",
          goal: 8,
          reward: "Coffee",
          eligibleProducts: "Coffee",
        },
        port,
      ),
    /SADAKAT_INVALID/,
  );
  assert.equal(calls, 0);
  await mutateSadakat(
    {
      restaurantId,
      actorId,
      requestId,
      kind: "earn",
      code: "ABCD EF12 3456 7890",
      quantity: 2,
    },
    port,
  );
  assert.equal(calls, 1);
});
test("personal codes normalize grouped input and reject public links", () => {
  assert.equal(normalizeSadakatCode("abcd-ef12-3456-7890"), "ABCDEF1234567890");
  assert.equal(
    normalizeSadakatCode("https://menu.masabu.co/sadakat/cafe"),
    null,
  );
});
