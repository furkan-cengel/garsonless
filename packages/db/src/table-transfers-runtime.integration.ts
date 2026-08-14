import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import test from "node:test";
import { createClient, createServiceClient } from "./client";
import { createTableSessionPort } from "./table-command-port";
import { resolveTransferredGuestTable } from "./table-qr-tokens";

const DEV_PROJECT_REF = "yxsegwkzyiscrxiwdeuf";
const mutationEnabled = process.env["TABLES_RUNTIME_ALLOW_MUTATION"] === "1";
const evidencePath = process.env["TABLES_RUNTIME_DB_EVIDENCE_PATH"];

type Fixture = Awaited<ReturnType<typeof createFixture>>;

function assertSafeRuntimeTarget() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  assert.ok(url, "NEXT_PUBLIC_SUPABASE_URL is required");
  assert.equal(
    new URL(url).hostname.split(".")[0],
    DEV_PROJECT_REF,
    "Tables runtime mutations are DEV-only",
  );
}

async function createFixture() {
  assertSafeRuntimeTarget();
  const service = createServiceClient();
  const { data: ownerRestaurant, error: ownerError } = await service
    .from("restaurants")
    .select("owner_id")
    .is("deleted_at", null)
    .limit(1)
    .single();
  assert.ifError(ownerError);
  assert.ok(ownerRestaurant);

  const { data: restaurant, error: restaurantError } = await service
    .from("restaurants")
    .insert({
      name: "Isolated Tables Runtime Gate",
      slug: `tables-runtime-${Date.now()}-${randomUUID().slice(0, 6)}`,
      owner_id: ownerRestaurant.owner_id,
      plan: "business",
    })
    .select("id")
    .single();
  assert.ifError(restaurantError);
  assert.ok(restaurant);

  let tableSequence = 0;
  const createTable = async (purpose: string) => {
    tableSequence += 1;
    const { data, error } = await service
      .from("tables")
      .insert({
        restaurant_id: restaurant.id,
        label: `Runtime ${tableSequence} ${purpose}`,
      })
      .select("id")
      .single();
    assert.ifError(error);
    assert.ok(data);
    return data.id;
  };

  const createSession = async (tableId: string, totals: number[]) => {
    const { data: session, error: sessionError } = await service
      .from("table_sessions")
      .insert({
        restaurant_id: restaurant.id,
        table_id: tableId,
      })
      .select("id")
      .single();
    assert.ifError(sessionError);
    assert.ok(session);
    const rows = totals.map((total, index) => ({
      restaurant_id: restaurant.id,
      table_id: tableId,
      table_session_id: session.id,
      session_id: randomUUID(),
      status: "served",
      total,
      items: [{ name: `Runtime ürün ${index + 1}`, quantity: 1, price: total }],
    }));
    if (rows.length === 0) return { sessionId: session.id, orders: [] };
    const { data: orders, error: ordersError } = await service
      .from("orders")
      .insert(rows)
      .select("id,session_id");
    assert.ifError(ordersError);
    assert.equal(orders?.length, totals.length);
    return { sessionId: session.id, orders: orders ?? [] };
  };

  return {
    service,
    port: createTableSessionPort(),
    ownerId: ownerRestaurant.owner_id,
    restaurantId: restaurant.id,
    createTable,
    createSession,
  };
}

async function cleanupFixture(fixture: Fixture) {
  const errors: string[] = [];
  for (const relation of [
    "table_transfer_operations",
    "service_requests",
    "payment_shares",
    "orders",
    "table_sessions",
    "table_qr_tokens",
    "tables",
  ] as const) {
    const { error } = await fixture.service
      .from(relation)
      .delete()
      .eq("restaurant_id", fixture.restaurantId);
    if (error) errors.push(`${relation}:${error.code}`);
  }
  const { error: restaurantError } = await fixture.service
    .from("restaurants")
    .delete()
    .eq("id", fixture.restaurantId);
  if (restaurantError) errors.push(`restaurants:${restaurantError.code}`);
  const { count, error: remainingError } = await fixture.service
    .from("restaurants")
    .select("id", { count: "exact", head: true })
    .eq("id", fixture.restaurantId);
  if (remainingError) errors.push(`remaining:${remainingError.code}`);
  assert.deepEqual(errors, []);
  assert.equal(count, 0);
}

function expectSuccess<T>(
  result: { ok: true; value: T } | { ok: false; error: string },
) {
  if (!result.ok) assert.fail(result.error);
  return result.value;
}

async function createAuthenticatedOwnerClient(ownerId: string) {
  const service = createServiceClient();
  const { data: owner, error: ownerError } =
    await service.auth.admin.getUserById(ownerId);
  assert.ifError(ownerError);
  assert.ok(owner.user.email);
  const { data: link, error: linkError } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email: owner.user.email,
    });
  assert.ifError(linkError);
  const authenticated = createClient();
  const { error: verifyError } = await authenticated.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  assert.ifError(verifyError);
  return authenticated;
}

test(
  "tables transfer runtime gate",
  { skip: !mutationEnabled },
  async (suite) => {
    const evidence: Record<string, unknown> = {
      target: "linked DEV only",
      cleanup: { ok: false },
    };
    const fixture = await createFixture();

    try {
      await suite.test(
        "RLS and service-role boundaries fail closed",
        async () => {
          const anon = createClient();
          const authenticated = await createAuthenticatedOwnerClient(
            fixture.ownerId,
          );
          const [
            anonTable,
            authTable,
            serviceTable,
            anonHistory,
            authHistory,
            serviceHistory,
          ] = await Promise.all([
            anon
              .from("table_transfer_operations")
              .select("id", { count: "exact", head: true }),
            authenticated
              .from("table_transfer_operations")
              .select("id", { count: "exact", head: true }),
            fixture.service
              .from("table_transfer_operations")
              .select("id", { count: "exact", head: true }),
            anon.rpc("list_table_transfer_history", {
              p_restaurant_id: fixture.restaurantId,
              p_limit: 1,
            }),
            authenticated.rpc("list_table_transfer_history", {
              p_restaurant_id: fixture.restaurantId,
              p_limit: 1,
            }),
            fixture.service.rpc("list_table_transfer_history", {
              p_restaurant_id: fixture.restaurantId,
              p_limit: 1,
            }),
          ]);
          assert.ok(anonTable.error);
          assert.ok(authTable.error);
          assert.ifError(serviceTable.error);
          assert.ok(anonHistory.error);
          assert.ok(authHistory.error);
          assert.ifError(serviceHistory.error);
          evidence["rls"] = {
            anonDenied: true,
            authenticatedDenied: true,
            serviceRoleAccepted: true,
          };
        },
      );

      await suite.test(
        "table move is atomic, replay-safe and preserves guest continuity",
        async () => {
          const sourceTableId = await fixture.createTable("move-source");
          const targetTableId = await fixture.createTable("move-target");
          const collisionTargetId = await fixture.createTable("move-collision");
          const source = await fixture.createSession(sourceTableId, [110]);
          const requestId = randomUUID();
          const input = {
            restaurantId: fixture.restaurantId,
            sourceTableId,
            targetTableId,
            actorId: fixture.ownerId,
            requestId,
          };
          const first = expectSuccess(await fixture.port.moveSession(input));
          const replay = expectSuccess(await fixture.port.moveSession(input));
          const collision = await fixture.port.moveSession({
            ...input,
            targetTableId: collisionTargetId,
          });
          assert.equal(first.idempotent, false);
          assert.equal(replay.idempotent, true);
          assert.equal(replay.operationId, first.operationId);
          assert.equal(collision.ok, false);
          assert.match(
            collision.ok ? "" : collision.error,
            /farklı bir taşıma/,
          );
          const guestTarget = await resolveTransferredGuestTable({
            restaurantId: fixture.restaurantId,
            sourceTableId,
            guestSessionId: source.orders[0]!.session_id,
          });
          assert.equal(guestTarget, targetTableId);
          const { data: movedSession, error: movedSessionError } =
            await fixture.service
              .from("table_sessions")
              .select("table_id")
              .eq("id", source.sessionId)
              .single();
          assert.ifError(movedSessionError);
          assert.equal(movedSession?.table_id, targetTableId);
          assert.equal(
            (
              await fixture.service
                .from("table_transfer_operations")
                .select("id", { count: "exact", head: true })
                .eq("restaurant_id", fixture.restaurantId)
                .eq("request_id", requestId)
            ).count,
            1,
          );
          const activeHistory = expectSuccess(
            await fixture.port.listTransferHistory(fixture.restaurantId),
          ).find((item) => item.id === first.operationId);
          assert.ok(activeHistory);
          assert.equal(activeHistory.requestId, requestId);
          assert.equal(activeHistory.createdBy, fixture.ownerId);
          assert.equal(activeHistory.undoneBy, null);
          assert.equal(activeHistory.sourceSessionClosed, false);
          assert.equal(activeHistory.targetSessionCreated, false);

          const undone = expectSuccess(
            await fixture.port.undoTransfer({
              restaurantId: fixture.restaurantId,
              operationId: first.operationId,
              actorId: fixture.ownerId,
            }),
          );
          assert.equal(undone.idempotent, false);
          const undoneHistory = expectSuccess(
            await fixture.port.listTransferHistory(fixture.restaurantId),
          ).find((item) => item.id === first.operationId);
          assert.ok(undoneHistory);
          assert.equal(undoneHistory.status, "undone");
          assert.equal(undoneHistory.undoneBy, fixture.ownerId);
          assert.ok(undoneHistory.undoneAt);
          assert.equal(
            await resolveTransferredGuestTable({
              restaurantId: fixture.restaurantId,
              sourceTableId,
              guestSessionId: source.orders[0]!.session_id,
            }),
            null,
          );
          evidence["tableMove"] = {
            exactReplay: true,
            collisionRejected: true,
            guestMoveAndUndo: true,
            historyMetadata: {
              requestId: true,
              createdBy: true,
              undoneBy: true,
              undoneAt: true,
              sessionOutcomeFlags: true,
            },
          };
        },
      );

      await suite.test(
        "same and different request races serialize deterministically",
        async () => {
          const sameSource = await fixture.createTable("same-race-source");
          const sameTarget = await fixture.createTable("same-race-target");
          await fixture.createSession(sameSource, [120]);
          const sameInput = {
            restaurantId: fixture.restaurantId,
            sourceTableId: sameSource,
            targetTableId: sameTarget,
            actorId: fixture.ownerId,
            requestId: randomUUID(),
          };
          const sameRace = await Promise.all([
            fixture.port.moveSession(sameInput),
            fixture.port.moveSession(sameInput),
          ]);
          assert.equal(sameRace.filter((result) => result.ok).length, 2);
          assert.equal(
            sameRace.filter((result) => result.ok && !result.value.idempotent)
              .length,
            1,
          );
          assert.equal(
            sameRace.filter((result) => result.ok && result.value.idempotent)
              .length,
            1,
          );

          const firstSource = await fixture.createTable(
            "collision-race-source-a",
          );
          const firstTarget = await fixture.createTable(
            "collision-race-target-a",
          );
          const secondSource = await fixture.createTable(
            "collision-race-source-b",
          );
          const secondTarget = await fixture.createTable(
            "collision-race-target-b",
          );
          await fixture.createSession(firstSource, [130]);
          await fixture.createSession(secondSource, [140]);
          const collisionRequestId = randomUUID();
          const collisionRace = await Promise.all([
            fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: firstSource,
              targetTableId: firstTarget,
              actorId: fixture.ownerId,
              requestId: collisionRequestId,
            }),
            fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: secondSource,
              targetTableId: secondTarget,
              actorId: fixture.ownerId,
              requestId: collisionRequestId,
            }),
          ]);
          assert.equal(collisionRace.filter((result) => result.ok).length, 1);
          assert.equal(
            collisionRace.filter(
              (result) => !result.ok && /farklı bir taşıma/.test(result.error),
            ).length,
            1,
          );

          const dualSource = await fixture.createTable("dual-request-source");
          const dualTarget = await fixture.createTable("dual-request-target");
          await fixture.createSession(dualSource, [150]);
          const dualRace = await Promise.all([
            fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: dualSource,
              targetTableId: dualTarget,
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
            fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: dualSource,
              targetTableId: dualTarget,
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          ]);
          assert.equal(dualRace.filter((result) => result.ok).length, 1);
          assert.equal(dualRace.filter((result) => !result.ok).length, 1);
          evidence["races"] = {
            sameRequest: "1 execution + 1 replay",
            conflictingIntent: "1 success + 1 conflict",
            distinctRequests: "1 success + 1 safe rejection",
          };
        },
      );

      await suite.test(
        "single, multi, empty-target and occupied-target account transfers preserve sessions",
        async () => {
          const partialSourceTable =
            await fixture.createTable("partial-source");
          const emptyTargetTable = await fixture.createTable("empty-target");
          const partialSource = await fixture.createSession(
            partialSourceTable,
            [70, 80],
          );
          const partialMove = expectSuccess(
            await fixture.port.transferOrders({
              restaurantId: fixture.restaurantId,
              sourceTableId: partialSourceTable,
              targetTableId: emptyTargetTable,
              orderIds: [partialSource.orders[0]!.id],
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          );
          assert.equal(partialMove.idempotent, false);
          const { data: partialSessions, error: partialSessionsError } =
            await fixture.service
              .from("table_sessions")
              .select("table_id,closed_at")
              .in("table_id", [partialSourceTable, emptyTargetTable])
              .eq("restaurant_id", fixture.restaurantId);
          assert.ifError(partialSessionsError);
          assert.equal(
            partialSessions?.filter((session) => session.closed_at === null)
              .length,
            2,
          );

          const fullSourceTable = await fixture.createTable("merge-source");
          const occupiedTargetTable = await fixture.createTable("merge-target");
          const fullSource = await fixture.createSession(
            fullSourceTable,
            [90, 100],
          );
          const existingTarget = await fixture.createSession(
            occupiedTargetTable,
            [60],
          );
          const merged = expectSuccess(
            await fixture.port.transferOrders({
              restaurantId: fixture.restaurantId,
              sourceTableId: fullSourceTable,
              targetTableId: occupiedTargetTable,
              orderIds: fullSource.orders.map((order) => order.id),
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          );
          assert.equal(merged.idempotent, false);
          const { data: mergedOrders, error: mergedOrdersError } =
            await fixture.service
              .from("orders")
              .select("id")
              .eq("restaurant_id", fixture.restaurantId)
              .eq("table_session_id", existingTarget.sessionId)
              .is("deleted_at", null);
          assert.ifError(mergedOrdersError);
          assert.equal(mergedOrders?.length, 3);
          const { data: closedSource, error: closedSourceError } =
            await fixture.service
              .from("table_sessions")
              .select("closed_at,close_kind")
              .eq("id", fullSource.sessionId)
              .single();
          assert.ifError(closedSourceError);
          assert.ok(closedSource?.closed_at);
          assert.equal(closedSource?.close_kind, "transfer");
          evidence["accountTransfers"] = {
            singleToEmpty: true,
            fullMergeToOccupied: true,
          };
        },
      );

      await suite.test(
        "product quantities transfer atomically, replay safely and undo without data loss",
        async () => {
          const sourceTableId = await fixture.createTable("item-source");
          const targetTableId = await fixture.createTable("item-target");
          const source = await fixture.createSession(sourceTableId, [300]);
          const sourceOrderId = source.orders[0]!.id;
          const { error: snapshotError } = await fixture.service
            .from("orders")
            .update({
              total: 300,
              items: [
                {
                  name: "Runtime Avokado Tost",
                  quantity: 3,
                  price: 100,
                  note: "Ekşi mayalı",
                },
              ],
            })
            .eq("id", sourceOrderId)
            .eq("restaurant_id", fixture.restaurantId);
          assert.ifError(snapshotError);

          const requestId = randomUUID();
          const input = {
            restaurantId: fixture.restaurantId,
            sourceTableId,
            targetTableId,
            selections: [
              { orderId: sourceOrderId, lineIndex: 0, quantity: 2 },
            ],
            actorId: fixture.ownerId,
            requestId,
          };
          const first = expectSuccess(
            await fixture.port.transferOrderItems(input),
          );
          const replay = expectSuccess(
            await fixture.port.transferOrderItems(input),
          );
          const collision = await fixture.port.transferOrderItems({
            ...input,
            selections: [
              { orderId: sourceOrderId, lineIndex: 0, quantity: 1 },
            ],
          });
          assert.equal(first.idempotent, false);
          assert.equal(replay.idempotent, true);
          assert.equal(replay.operationId, first.operationId);
          assert.equal(collision.ok, false);
          assert.match(collision.ok ? "" : collision.error, /farklı bir taşıma/);

          const { data: sourceAfter, error: sourceAfterError } =
            await fixture.service
              .from("orders")
              .select("table_id,total,items")
              .eq("id", sourceOrderId)
              .single();
          assert.ifError(sourceAfterError);
          assert.equal(sourceAfter?.table_id, sourceTableId);
          assert.equal(sourceAfter?.total, 100);
          assert.deepEqual(sourceAfter?.items, [
            {
              name: "Runtime Avokado Tost",
              quantity: 1,
              price: 100,
              note: "Ekşi mayalı",
            },
          ]);

          const { data: targetOrders, error: targetOrdersError } =
            await fixture.service
              .from("orders")
              .select("id,total,items")
              .eq("restaurant_id", fixture.restaurantId)
              .eq("table_id", targetTableId)
              .is("deleted_at", null);
          assert.ifError(targetOrdersError);
          assert.equal(targetOrders?.length, 1);
          assert.notEqual(targetOrders?.[0]?.id, sourceOrderId);
          assert.equal(targetOrders?.[0]?.total, 200);
          assert.deepEqual(targetOrders?.[0]?.items, [
            {
              name: "Runtime Avokado Tost",
              quantity: 2,
              price: 100,
              note: "Ekşi mayalı",
            },
          ]);

          const undone = expectSuccess(
            await fixture.port.undoTransfer({
              restaurantId: fixture.restaurantId,
              operationId: first.operationId,
              actorId: fixture.ownerId,
            }),
          );
          assert.equal(undone.idempotent, false);
          const { data: sourceRestored, error: sourceRestoredError } =
            await fixture.service
              .from("orders")
              .select("total,items")
              .eq("id", sourceOrderId)
              .single();
          assert.ifError(sourceRestoredError);
          assert.equal(sourceRestored?.total, 300);
          assert.deepEqual(sourceRestored?.items, [
            {
              name: "Runtime Avokado Tost",
              quantity: 3,
              price: 100,
              note: "Ekşi mayalı",
            },
          ]);
          const { count: activeTargetCount, error: activeTargetError } =
            await fixture.service
              .from("orders")
              .select("id", { count: "exact", head: true })
              .eq("restaurant_id", fixture.restaurantId)
              .eq("table_id", targetTableId)
              .is("deleted_at", null);
          assert.ifError(activeTargetError);
          assert.equal(activeTargetCount, 0);
          evidence["itemTransfers"] = {
            selectedQuantity: "2 of 3",
            exactReplay: true,
            collisionRejected: true,
            sourceAndTargetTotals: true,
            undoRestoredSnapshot: true,
          };
        },
      );

      await suite.test(
        "split payments require full transfer and keep provider relations attached",
        async () => {
          const sourceTableId = await fixture.createTable("split-source");
          const targetTableId = await fixture.createTable("split-target");
          const source = await fixture.createSession(sourceTableId, [105, 115]);
          const { data: share, error: shareError } = await fixture.service
            .from("payment_shares")
            .insert({
              restaurant_id: fixture.restaurantId,
              table_session_id: source.sessionId,
              amount: 110,
              method: "iyzico",
              status: "declared",
              checkout_amount: 110,
              checkout_reserved_until: new Date(
                Date.now() + 10 * 60_000,
              ).toISOString(),
            })
            .select("id")
            .single();
          assert.ifError(shareError);
          assert.ok(share);
          const providerToken = `runtime-${randomUUID()}`;
          assert.ifError(
            (
              await fixture.service
                .from("payment_share_tokens")
                .insert({ share_id: share.id, token: providerToken })
            ).error,
          );
          const { data: request, error: requestError } = await fixture.service
            .from("service_requests")
            .insert({
              restaurant_id: fixture.restaurantId,
              table_id: sourceTableId,
              table_session_id: source.sessionId,
              request_type: "bill",
              status: "pending",
            })
            .select("id")
            .single();
          assert.ifError(requestError);
          assert.ok(request);

          const partial = await fixture.port.transferOrders({
            restaurantId: fixture.restaurantId,
            sourceTableId,
            targetTableId,
            orderIds: [source.orders[0]!.id],
            actorId: fixture.ownerId,
            requestId: randomUUID(),
          });
          assert.equal(partial.ok, false);
          assert.match(partial.ok ? "" : partial.error, /Bölünmüş ödeme/);
          const full = expectSuccess(
            await fixture.port.transferOrders({
              restaurantId: fixture.restaurantId,
              sourceTableId,
              targetTableId,
              orderIds: source.orders.map((order) => order.id),
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          );
          const { data: targetSession, error: targetSessionError } =
            await fixture.service
              .from("table_sessions")
              .select("id")
              .eq("restaurant_id", fixture.restaurantId)
              .eq("table_id", targetTableId)
              .is("closed_at", null)
              .single();
          assert.ifError(targetSessionError);
          assert.ok(targetSession);
          const { data: movedShare, error: movedShareError } =
            await fixture.service
              .from("payment_shares")
              .select("table_session_id")
              .eq("id", share.id)
              .single();
          assert.ifError(movedShareError);
          assert.equal(movedShare?.table_session_id, targetSession.id);
          const { data: movedRequest, error: movedRequestError } =
            await fixture.service
              .from("service_requests")
              .select("table_id,table_session_id")
              .eq("id", request.id)
              .single();
          assert.ifError(movedRequestError);
          assert.deepEqual(movedRequest, {
            table_id: targetTableId,
            table_session_id: targetSession.id,
          });
          const { data: tokenRow, error: tokenError } = await fixture.service
            .from("payment_share_tokens")
            .select("token")
            .eq("share_id", share.id)
            .single();
          assert.ifError(tokenError);
          assert.equal(tokenRow?.token, providerToken);

          const undone = expectSuccess(
            await fixture.port.undoTransfer({
              restaurantId: fixture.restaurantId,
              operationId: full.operationId,
              actorId: fixture.ownerId,
            }),
          );
          assert.equal(undone.idempotent, false);
          assert.equal(
            (
              await fixture.service
                .from("payment_shares")
                .select("table_session_id")
                .eq("id", share.id)
                .single()
            ).data?.table_session_id,
            source.sessionId,
          );
          evidence["split"] = {
            partialRejected: true,
            fullMoved: true,
            providerAndRequestRelationsPreserved: true,
            undoRestored: true,
          };
        },
      );

      await suite.test(
        "payment, source reuse and subsequent transfers safely reject stale undo",
        async () => {
          const paymentSource = await fixture.createTable(
            "payment-guard-source",
          );
          const paymentTarget = await fixture.createTable(
            "payment-guard-target",
          );
          const paymentSession = await fixture.createSession(
            paymentSource,
            [125],
          );
          const paymentMove = expectSuccess(
            await fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: paymentSource,
              targetTableId: paymentTarget,
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          );
          assert.ifError(
            (
              await fixture.service
                .from("orders")
                .update({
                  paid_at: new Date().toISOString(),
                  payment_method: "cash",
                  settled_by: fixture.ownerId,
                })
                .eq("id", paymentSession.orders[0]!.id)
                .eq("restaurant_id", fixture.restaurantId)
            ).error,
          );
          const paymentUndo = expectSuccess(
            await fixture.port.undoTransfer({
              restaurantId: fixture.restaurantId,
              operationId: paymentMove.operationId,
              actorId: fixture.ownerId,
            }),
          );
          assert.match(paymentUndo.error ?? "", /ödeme|finansal/i);

          const reuseSource = await fixture.createTable("reuse-guard-source");
          const reuseTarget = await fixture.createTable("reuse-guard-target");
          await fixture.createSession(reuseSource, [135]);
          const reuseMove = expectSuccess(
            await fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: reuseSource,
              targetTableId: reuseTarget,
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          );
          await fixture.createSession(reuseSource, []);
          const reuseUndo = expectSuccess(
            await fixture.port.undoTransfer({
              restaurantId: fixture.restaurantId,
              operationId: reuseMove.operationId,
              actorId: fixture.ownerId,
            }),
          );
          assert.match(reuseUndo.error ?? "", /kaynak masa|kullanım/i);

          const chainSource = await fixture.createTable("chain-source");
          const chainMiddle = await fixture.createTable("chain-middle");
          const chainTarget = await fixture.createTable("chain-target");
          await fixture.createSession(chainSource, [145]);
          const firstMove = expectSuccess(
            await fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: chainSource,
              targetTableId: chainMiddle,
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          );
          expectSuccess(
            await fixture.port.moveSession({
              restaurantId: fixture.restaurantId,
              sourceTableId: chainMiddle,
              targetTableId: chainTarget,
              actorId: fixture.ownerId,
              requestId: randomUUID(),
            }),
          );
          const staleUndo = expectSuccess(
            await fixture.port.undoTransfer({
              restaurantId: fixture.restaurantId,
              operationId: firstMove.operationId,
              actorId: fixture.ownerId,
            }),
          );
          assert.match(staleUndo.error ?? "", /sonraki|hedef|taşıma/i);
          evidence["undoGuards"] = {
            payment: true,
            sourceReuse: true,
            subsequentTransfer: true,
          };
        },
      );
    } finally {
      await cleanupFixture(fixture);
      evidence["cleanup"] = {
        ok: true,
        childFirst: true,
        remainingTenantRows: 0,
      };
      if (evidencePath) {
        mkdirSync(dirname(evidencePath), { recursive: true });
        writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
      }
    }
  },
);
