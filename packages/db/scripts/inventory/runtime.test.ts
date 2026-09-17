import assert from "node:assert/strict";
import { randomUUID as uuid } from "node:crypto";
import pg from "pg";
import { writeFileSync } from "node:fs";
import type { InventorySnapshot } from "@garsonless/domain/inventory";
// Disposable local PostgreSQL only; does not read project environment files.
const connectionString =
  "postgresql://postgres:inventory-test-only@127.0.0.1:55439/postgres";
const db = new pg.Client({ connectionString });
await db.connect();
const rid = uuid(),
  actor = uuid(),
  category = uuid(),
  menu = uuid(),
  other = uuid(),
  checks: string[] = [];
const q = (sql: string, values: unknown[] = []) => db.query(sql, values);
async function cmd(
  mode: string,
  payload: Record<string, unknown> = {},
  key = uuid(),
  who = actor,
) {
  return (
    await q("select public.execute_inventory($1,$2,$3,$4,$5) r", [
      rid,
      who,
      mode,
      key,
      payload,
    ])
  ).rows[0].r;
}
async function good(
  mode: string,
  payload: Record<string, unknown> = {},
  key = uuid(),
) {
  const r = await cmd(mode, payload, key);
  assert.equal(r.ok, true, `${mode}: ${JSON.stringify(r)}`);
  return r.data;
}
async function snap(): Promise<InventorySnapshot> {
  return good("snapshot");
}
async function stock(
  name: string,
  quantity = "1000",
  cost: string | null = "2",
  kind = "raw",
) {
  await good("item", {
    name,
    kind,
    unit: "g",
    threshold: "100",
    openingQuantity: quantity,
    openingCost: cost,
    conversions: { paket: "250" },
  });
  return (await snap()).items.find((i) => i.name === name)!;
}
async function qty(id: string) {
  return Number((await snap()).items.find((i) => i.id === id)!.quantity);
}
async function order(
  quantity = 1,
  status = "pending_approval",
  extra: Record<string, unknown> = {},
  tableId?: string,
) {
  const id = uuid();
  const sid = tableId
    ? (
        await q("select public.open_or_get_table_session($1,$2) id", [
          rid,
          tableId,
        ])
      ).rows[0].id
    : null;
  await q(
    "insert into public.orders(id,restaurant_id,table_id,table_session_id,session_id,source,items,total,status) values($1,$2,$3,$4,$5,'staff',$6,$8,$7)",
    [
      id,
      rid,
      tableId ?? null,
      sid,
      actor,
      JSON.stringify([
        {
          itemId: menu,
          name: "Test yemek",
          price: 100,
          quantity,
          modifiers: [],
          removedIngredients: [],
          modifiersPriceDelta: 0,
          ...extra,
        },
      ]),
      status,
      quantity * 100,
    ],
  );
  return id;
}
const status = (id: string, s: string) =>
  q("update public.orders set status=$2 where id=$1", [id, s]);
try {
  await q("select set_config('request.jwt.claim.role','service_role',false)");
  await q("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    actor,
    `inv-${actor}@example.test`,
    other,
    `inv-${other}@example.test`,
  ]);
  await q(
    "insert into public.restaurants(id,owner_id,name,slug,plan) values($1,$2,'Inventory test',$3,'pro')",
    [rid, actor, "inv-" + rid],
  );
  const customer = (
    await q(
      "insert into public.billing_customers(restaurant_id,legal_name,contact_email) values($1,'Inventory test','inventory@example.test') on conflict(restaurant_id) do update set legal_name=excluded.legal_name returning id",
      [rid],
    )
  ).rows[0].id;
  await q(
    "insert into public.billing_subscriptions(restaurant_id,billing_customer_id,plan,status,trial_ends_at) values($1,$2,'pro','trial',now()+interval '14 days') on conflict(restaurant_id) where status<>'cancelled' do update set status='trial',trial_ends_at=now()+interval '14 days'",
    [rid, customer],
  );
  await q(
    "insert into public.menu_categories(id,restaurant_id,name) values($1,$2,'Test')",
    [category, rid],
  );
  await q(
    "insert into public.menu_items(id,category_id,name,price,ingredients,modifier_groups) values($1,$2,'Yemek',100,$3,$4)",
    [
      menu,
      category,
      JSON.stringify([{ id: "remove", name: "Soğan", removable: true }]),
      JSON.stringify([
        {
          id: "extra",
          name: "Ekstra",
          options: [{ id: "cheese", name: "Peynir" }],
        },
      ]),
    ],
  );
  assert.equal((await cmd("snapshot", {}, uuid(), other)).error, "forbidden");
  const flour = await stock("Un"),
    cheese = await stock("Peynir"),
    sauce = await stock("Sos", "0", null, "prepared");
  const key = uuid(),
    payload = { lines: [{ itemId: flour.id, quantity: "50", cost: "4" }] };
  const firstReceipt = await good("receipt", payload, key);
  assert.equal(firstReceipt.balances[0].quantity, "1050.000000");
  assert.deepEqual(firstReceipt.warnings, []);
  await good("receipt", payload, key);
  assert.equal(await qty(flour.id), 1050);
  assert.equal(
    (
      await cmd(
        "receipt",
        { lines: [{ itemId: flour.id, quantity: "51" }] },
        key,
      )
    ).error,
    "request_mismatch",
  );
  checks.push("authorization, opening, receipt replay and mismatched retries");
  await good("recipe", {
    menuItemId: menu,
    mode: "recipe",
    version: 0,
    lines: [
      { itemId: flour.id, quantity: "10", ingredientId: "remove" },
      {
        itemId: cheese.id,
        quantity: "5",
        groupId: "extra",
        optionId: "cheese",
      },
    ],
  });
  const legacy = await order();
  await good("activate", { confirmed: true });
  await status(legacy, "preparing");
  assert.equal(await qty(flour.id), 1050);
  const id = await order(2, "pending_approval", {
    modifiers: [{ groupId: "extra", optionId: "cheese", quantity: 2 }],
  });
  assert.equal(await qty(flour.id), 1050);
  await status(id, "sent_to_kitchen");
  assert.equal(await qty(flour.id), 1030);
  assert.equal(await qty(cheese.id), 980);
  await status(id, "sent_to_kitchen");
  assert.equal(await qty(flour.id), 1030);
  await status(id, "cancelled");
  assert.equal(await qty(flour.id), 1050);
  assert.equal(await qty(cheese.id), 1000);
  const financialOnly = await order();
  await status(financialOnly, "paid");
  assert.equal(
    await qty(flour.id),
    1050,
    "payment alone must not start consumption",
  );
  const removed = await order(1, "sent_to_kitchen", {
    removedIngredients: [{ id: "remove", name: "Soğan" }],
  });
  assert.equal(await qty(flour.id), 1050);
  await status(removed, "cancelled");
  const prepared = await order(1, "preparing");
  assert.equal(await qty(flour.id), 1040);
  await status(prepared, "ready");
  await status(prepared, "sent_to_kitchen");
  await status(prepared, "cancelled");
  assert.equal(await qty(flour.id), 1040);
  await good("return", {
    orderId: prepared,
    reason: "Malzeme kullanılmadı",
    lines: [{ itemId: flour.id, quantity: "10" }],
  });
  assert.equal(await qty(flour.id), 1050);
  assert.equal(
    (
      await cmd("return", {
        orderId: prepared,
        reason: "Tekrar iade",
        lines: [{ itemId: flour.id, quantity: "1" }],
      })
    ).ok,
    false,
  );
  checks.push(
    "activation cutoff, modifiers, removals, lifecycle replay, preparation and capped returns",
  );
  await good("recipe", {
    outputItemId: sauce.id,
    outputQuantity: "100",
    mode: "recipe",
    version: 0,
    lines: [
      { itemId: flour.id, quantity: "20" },
      { itemId: cheese.id, quantity: "30" },
    ],
  });
  const recipe = (await snap()).recipes.find(
    (r) => r.outputItemId === sauce.id,
  )!;
  await good("production", {
    recipeId: recipe.id,
    outputQuantity: "100",
    lines: [
      { itemId: flour.id, quantity: "20" },
      { itemId: cheese.id, quantity: "30" },
    ],
  });
  assert.equal(await qty(sauce.id), 100);
  const item = (await snap()).items.find((i) => i.id === flour.id)!;
  const count = await good("count_save", {
    lines: [{ itemId: flour.id, quantity: "900", version: item.version }],
  });
  await good("receipt", {
    lines: [{ itemId: flour.id, quantity: "1", cost: "2" }],
  });
  assert.equal(
    (await cmd("count_approve", { id: count.id, version: 1 })).error,
    "conflict",
  );
  await good("count_save", {
    id: count.id,
    version: 1,
    lines: [
      {
        itemId: flour.id,
        quantity: "0",
        version: (await snap()).items.find((i) => i.id === flour.id)!.version,
      },
    ],
  });
  await good("count_approve", { id: count.id, version: 2 });
  assert.equal(await qty(flour.id), 0);
  checks.push("production and conflicting counts with explicit zero");
  const clients = await Promise.all(
    Array.from({ length: 8 }, async () => {
      const c = new pg.Client({ connectionString });
      await c.connect();
      await c.query(
        "select set_config('request.jwt.claim.role','service_role',false)",
      );
      return c;
    }),
  );
  try {
    await Promise.all(
      clients.map((c) =>
        c
          .query("select public.execute_inventory($1,$2,$3,$4,$5) r", [
            rid,
            actor,
            "receipt",
            uuid(),
            { lines: [{ itemId: flour.id, quantity: "1", cost: "2" }] },
          ])
          .then((r) => assert.equal(r.rows[0].r.ok, true)),
      ),
    );
    const sameKey = uuid();
    await Promise.all(
      clients.map(async (c) => {
        const result = await c.query(
          "select public.execute_inventory($1,$2,$3,$4,$5) r",
          [
            rid,
            actor,
            "receipt",
            sameKey,
            { lines: [{ itemId: flour.id, quantity: "3", cost: "2" }] },
          ],
        );
        assert.equal(result.rows[0].r.ok, true);
      }),
    );
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
  assert.equal(await qty(flour.id), 11);
  const ta = uuid(),
    tb = uuid();
  await q(
    "insert into public.tables(id,restaurant_id,label) values($1,$3,'A'),($2,$3,'B')",
    [ta, tb, rid],
  );
  const moved = await order(4, "sent_to_kitchen", {}, ta),
    before = await qty(flour.id),
    transferKey = uuid(),
    selection = JSON.stringify([{ orderId: moved, lineIndex: 0, quantity: 2 }]);
  const tr = (
    await q("select public.transfer_table_order_items($1,$2,$3,$4,$5,$6) r", [
      rid,
      ta,
      tb,
      selection,
      actor,
      transferKey,
    ])
  ).rows[0].r;
  assert.equal(await qty(flour.id), before);
  await q("select public.transfer_table_order_items($1,$2,$3,$4,$5,$6)", [
    rid,
    ta,
    tb,
    selection,
    actor,
    transferKey,
  ]);
  assert.equal(await qty(flour.id), before);
  await q("select public.undo_table_transfer($1,$2,$3)", [
    rid,
    tr.operationId,
    actor,
  ]);
  assert.equal(await qty(flour.id), before);
  await status(moved, "cancelled");
  assert.equal(await qty(flour.id), before + 40);
  checks.push(
    "concurrent receipts, negative stock, partial transfer, replay, undo and cancellation",
  );
  // Full and repeated partial transfers preserve origin snapshots and total depletion.
  const tc = uuid();
  await q(
    "insert into public.tables(id,restaurant_id,label) values($1,$2,'C')",
    [tc, rid],
  );
  async function move(
    sourceTable: string,
    targetTable: string,
    orderId: string,
    quantity: number,
  ) {
    const r = (
      await q("select public.transfer_table_order_items($1,$2,$3,$4,$5,$6) r", [
        rid,
        sourceTable,
        targetTable,
        JSON.stringify([{ orderId, lineIndex: 0, quantity }]),
        actor,
        uuid(),
      ])
    ).rows[0].r;
    assert.ok(r.operationId, JSON.stringify(r));
    const split = (
      await q(
        "select target_order_id id from public.table_transfer_item_splits where operation_id=$1",
        [r.operationId],
      )
    ).rows[0];
    return { operation: r.operationId, order: split?.id ?? orderId };
  }
  const transferBefore = await qty(flour.id);
  const full = await order(2, "sent_to_kitchen", {}, ta);
  const fullMove = await move(ta, tb, full, 2);
  assert.equal(await qty(flour.id), transferBefore - 20);
  await q("select public.undo_table_transfer($1,$2,$3)", [
    rid,
    fullMove.operation,
    actor,
  ]);
  await status(full, "cancelled");
  assert.equal(await qty(flour.id), transferBefore);
  const nested = await order(4, "sent_to_kitchen", {}, ta);
  const first = await move(ta, tb, nested, 2);
  const second = await move(tb, tc, first.order, 1);
  assert.equal(await qty(flour.id), transferBefore - 40);
  await q("select public.undo_table_transfer($1,$2,$3)", [
    rid,
    second.operation,
    actor,
  ]);
  await q("select public.undo_table_transfer($1,$2,$3)", [
    rid,
    first.operation,
    actor,
  ]);
  await status(nested, "cancelled");
  assert.equal(await qty(flour.id), transferBefore);
  const divergent = await order(4, "sent_to_kitchen", {}, ta);
  const splitPrep = await move(ta, tb, divergent, 2);
  await status(splitPrep.order, "preparing");
  const refusedUndo = await q("select public.undo_table_transfer($1,$2,$3) r", [
    rid,
    splitPrep.operation,
    actor,
  ])
    .then((r) => r.rows[0].r)
    .catch((e) => ({ error: e.message }));
  assert.ok(refusedUndo.error, "preparation changes must refuse undo");
  await status(divergent, "cancelled");
  await status(splitPrep.order, "cancelled");
  assert.equal(
    await qty(flour.id),
    transferBefore - 20,
    "only the unprepared allocation returns",
  );
  checks.push(
    "same-key concurrency, payment without consumption, full and nested transfers, divergent preparation undo guard",
  );
  // Invalid multi-line commands must not leave their first write committed.
  const rollbackBefore = await qty(flour.id);
  assert.equal(
    (
      await cmd("receipt", {
        lines: [
          { itemId: flour.id, quantity: "9", cost: "2" },
          { itemId: uuid(), quantity: "1" },
        ],
      })
    ).ok,
    false,
  );
  assert.equal(await qty(flour.id), rollbackBefore);
  // Recipe snapshots survive a later edit; produced stock is consumed without its ingredients.
  const pending = await order(1);
  await good("recipe", {
    menuItemId: menu,
    mode: "direct",
    version: 1,
    lines: [{ itemId: sauce.id, quantity: "10" }],
  });
  await status(pending, "sent_to_kitchen");
  assert.equal(await qty(flour.id), rollbackBefore - 10);
  const sauceBefore = await qty(sauce.id);
  const rawBefore = await qty(flour.id);
  await order(1, "sent_to_kitchen");
  assert.equal(await qty(sauce.id), sauceBefore - 10);
  assert.equal(await qty(flour.id), rawBefore);
  assert.equal(
    (
      await cmd("recipe", {
        outputItemId: sauce.id,
        mode: "recipe",
        version: 1,
        lines: [{ itemId: sauce.id, quantity: "1" }],
      })
    ).error,
    "recipe_cycle",
  );
  // A stale draft version cannot overwrite a different counter's saved work.
  const draft = await good("count_save", {
    lines: [
      {
        itemId: flour.id,
        quantity: null,
        version: (await snap()).items.find((i) => i.id === flour.id)!.version,
      },
    ],
  });
  await good("count_save", {
    id: draft.id,
    version: 1,
    lines: [
      {
        itemId: flour.id,
        quantity: null,
        version: (await snap()).items.find((i) => i.id === flour.id)!.version,
      },
    ],
  });
  assert.equal(
    (await cmd("count_save", { id: draft.id, version: 1, lines: [] })).ok,
    false,
  );
  await good("count_approve", { id: draft.id, version: 2 });
  assert.equal(await qty(flour.id), rawBefore);
  // RLS isolates sensitive stock/cost rows and clients cannot invoke service commands.
  await q("select set_config('request.jwt.claim.sub',$1,false)", [other]);
  await q("select set_config('request.jwt.claim.role','authenticated',false)");
  await q("set role authenticated");
  assert.equal(
    (
      await q(
        "select count(*) n from public.inventory_items where restaurant_id=$1",
        [rid],
      )
    ).rows[0].n,
    "0",
  );
  await assert.rejects(cmd("snapshot"), /permission denied/);
  await q("reset role");
  await q("select set_config('request.jwt.claim.role','service_role',false)");
  checks.push(
    "atomic failure rollback, immutable recipe snapshot, no double production depletion, cycle validation, draft version and RLS",
  );
  writeFileSync(
    "/private/tmp/masabu-inventory-fixture.json",
    JSON.stringify({ restaurantId: rid, actor, snapshot: await snap() }),
  );
  assert.deepEqual(
    (
      await q(
        "select i.id from public.inventory_items i left join public.inventory_movements m on m.item_id=i.id where i.restaurant_id=$1 group by i.id having i.quantity<>coalesce(sum(m.quantity),0)",
        [rid],
      )
    ).rows,
    [],
  );
  await assert.rejects(
    q(
      "update public.inventory_movements set quantity=0 where restaurant_id=$1",
      [rid],
    ),
    /immutable/,
  );
  const beforeDowngrade = await qty(sauce.id);
  const downgradeOrder = await order(1, "sent_to_kitchen");
  assert.equal(await qty(sauce.id), beforeDowngrade - 10);
  await q("update public.restaurants set plan='plus' where id=$1", [rid]);
  await status(downgradeOrder, "cancelled");
  assert.equal(
    (
      await q("select quantity from public.inventory_items where id=$1", [
        sauce.id,
      ])
    ).rows[0].quantity,
    beforeDowngrade.toFixed(6),
  );
  assert.equal((await cmd("snapshot")).error, "plan_required");
  await q("update public.restaurants set plan='pro' where id=$1", [rid]);
  assert.equal((await snap()).enabled, false);
  checks.push(
    "journal reconciliation, immutability, downgrade and explicit reactivation",
  );
  await good("activate", { confirmed: true });
  writeFileSync(
    "/private/tmp/masabu-inventory-fixture.json",
    JSON.stringify({ restaurantId: rid, actor, snapshot: await snap() }),
  );
  console.log(JSON.stringify({ ok: true, checks, restaurantId: rid }, null, 2));
} finally {
  await db.end();
}
