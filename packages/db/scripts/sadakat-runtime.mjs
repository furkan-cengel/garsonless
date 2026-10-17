// Isolated local PostgreSQL test. Creates and removes its own random database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
const connection = process.env.SADAKAT_TEST_DATABASE_URL;
if (
  !connection ||
  !["127.0.0.1", "localhost"].includes(new URL(connection).hostname)
)
  throw new Error("Local SADAKAT_TEST_DATABASE_URL required");
const admin = new pg.Client({ connectionString: connection });
await admin.connect();
const database = `sadakat_${randomUUID().replaceAll("-", "")}`;
await admin.query(`create database ${database}`);
const url = new URL(connection);
url.pathname = `/${database}`;
const client = new pg.Client({ connectionString: url.href });
const peers = [];
let checks = 0;
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005120000_sadakat_pilot.sql",
    import.meta.url,
  ),
  "utf8",
);
const table = (file, name) => {
  const sql = readFileSync(
    new URL(`../supabase/migrations/${file}`, import.meta.url),
    "utf8",
  );
  const start = sql.indexOf(`create table public.${name} (`);
  return sql.slice(start, sql.indexOf("\n);", start) + 3);
};
async function check(name, work) {
  await work();
  checks++;
  console.log(`PASS ${name}`);
}
async function fails(work, message) {
  await assert.rejects(work, new RegExp(message));
}
const query = async (name, args = []) =>
  (
    await client.query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      args,
    )
  ).rows[0].result;
try {
  await client.connect();
  await client.query(`
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema auth;
    create table auth.users(id uuid primary key,raw_app_meta_data jsonb default '{}');
    create table public.restaurants(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id),name text not null,slug text unique not null,plan text default 'starter',settings jsonb default '{}',deleted_at timestamptz,created_at timestamptz default now());
    create table public.customers(id uuid primary key,phone text,email text,name text,auth_user_id uuid,verified_at timestamptz,merged_at timestamptz,merged_into_customer_id uuid);
    create table public.orders(id uuid primary key);
    create table public.loyalty_transactions(id uuid primary key default gen_random_uuid(),customer_id uuid references customers(id),restaurant_id uuid references restaurants(id),scope_key uuid,order_id uuid references orders(id),type text,delta int,reason text,created_at timestamptz default now());
    create table public.customer_restaurants(customer_id uuid references customers(id),restaurant_id uuid references restaurants(id),source text check(source in ('auth','activity','consent')),linked_at timestamptz default now(),primary key(customer_id,restaurant_id));
    create table public.restaurant_members(id uuid primary key default gen_random_uuid(),restaurant_id uuid references restaurants(id),user_id uuid references auth.users(id),email text,permissions jsonb default '[]',status text default 'active');
    create table public.security_events(user_id uuid,restaurant_id uuid,event_type text,metadata jsonb);
  `);
  await client.query(
    table(
      "20260722090000_platform_admin_foundation.sql",
      "platform_admin_users",
    ),
  );
  await client.query(
    table(
      "20260722090000_platform_admin_foundation.sql",
      "platform_admin_audit_log",
    ),
  );
  await client.query(
    readFileSync(
      new URL(
        "../supabase/migrations/20260614020000_loyalty_phase3a.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await client.query(
    "alter table loyalty_transactions drop constraint loyalty_transactions_direction_check; alter table loyalty_transactions add constraint loyalty_transactions_direction_check check(direction in ('earn','redeem','refund','reversal'))",
  );
  await check("migration executes against real PostgreSQL", () =>
    client.query(
      migration +
        readFileSync(
          new URL(
            "../supabase/migrations/20261006120000_sadakat_program_association_fix.sql",
            import.meta.url,
          ),
          "utf8",
        ),
    ),
  );
  await client.query(
    readFileSync(
      new URL(
        "../supabase/migrations/20261006130000_sadakat_email_pilot.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const owner = randomUUID(),
    staff = randomUUID(),
    outsider = randomUUID(),
    ops = randomUUID(),
    customer = randomUUID();
  await client.query("insert into auth.users(id) values($1),($2),($3),($4)", [
    owner,
    staff,
    outsider,
    ops,
  ]);
  await client.query(
    "insert into platform_admin_users(user_id,role,status,activated_at) values($1,'ops','active',now())",
    [ops],
  );
  await client.query(
    "insert into customers(id,phone,name,verified_at) values($1,'+905551234567','Test Customer',now())",
    [customer],
  );
  const restaurant = (
    await query("create_sadakat_business", [
      owner,
      "Test Cafe",
      "test-cafe",
      randomUUID(),
    ])
  ).restaurantId;
  const other = (
    await query("create_sadakat_business", [
      outsider,
      "Other Cafe",
      "other-cafe",
      randomUUID(),
    ])
  ).restaurantId;
  await client.query(
    "insert into restaurant_members(restaurant_id,user_id,permissions,status) values($1,$2,'[\"sadakat\"]','active')",
    [restaurant, staff],
  );
  const start = new Date(Date.now() - 60000).toISOString(),
    end = new Date(Date.now() + 30 * 86400000).toISOString();
  await check("non-admin cannot grant access", () =>
    fails(
      () =>
        query("grant_sadakat_pilot", [
          restaurant,
          owner,
          start,
          end,
          "test pilot reason",
          randomUUID(),
        ]),
      "SADAKAT_FORBIDDEN",
    ),
  );
  await query("grant_sadakat_pilot", [
    restaurant,
    ops,
    start,
    end,
    "test pilot reason",
    randomUUID(),
  ]);
  const config = {
    name: "Test Cafe",
    logoUrl: null,
    color: "#174C3C",
    goal: 8,
    reward: "Coffee",
    eligibleProducts: "Coffees",
  };
  await query("save_sadakat_program", [restaurant, owner, config]);
  await check("staff cannot change program", () =>
    fails(
      () => query("save_sadakat_program", [restaurant, staff, config]),
      "SADAKAT_FORBIDDEN",
    ),
  );
  await query("join_sadakat", [restaurant, customer]);
  const digest = "a".repeat(64);
  await query("issue_sadakat_code", [restaurant, customer, digest]);
  const earnId = randomUUID();
  const earn = () =>
    query("mutate_sadakat", [
      restaurant,
      staff,
      earnId,
      "earn",
      digest,
      2,
      null,
      "",
    ]);
  await check("two stamps and safe retry", async () => {
    assert.equal((await earn()).stamps, 2);
    assert.deepEqual(await earn(), await earn());
    assert.equal(
      (await query("read_sadakat_card", [restaurant, customer])).stamps,
      2,
    );
  });
  await check("request payload conflict", () =>
    fails(
      () =>
        query("mutate_sadakat", [
          restaurant,
          staff,
          earnId,
          "earn",
          digest,
          3,
          null,
          "",
        ]),
      "SADAKAT_CONFLICT",
    ),
  );
  await check("quantity limit", () =>
    fails(
      () =>
        query("mutate_sadakat", [
          restaurant,
          staff,
          randomUUID(),
          "earn",
          digest,
          21,
          null,
          "",
        ]),
      "SADAKAT_INVALID",
    ),
  );
  await check("tenant isolation and outsider rejection", async () => {
    await fails(
      () => query("resolve_sadakat_code", [other, outsider, digest]),
      "SADAKAT_EXPIRED",
    );
    await fails(
      () => query("resolve_sadakat_code", [restaurant, outsider, digest]),
      "SADAKAT_FORBIDDEN",
    );
    assert.equal(await query("read_sadakat_card", [other, customer]), null);
  });
  await check(
    "goal locks after first stamp, including legacy settings writer",
    async () => {
      await fails(
        () =>
          query("save_sadakat_program", [
            restaurant,
            owner,
            { ...config, goal: 9 },
          ]),
        "SADAKAT_GOAL_LOCKED",
      );
      await fails(
        () =>
          client.query(
            "update restaurants set settings=jsonb_set(settings,'{loyalty,stamp_goal}','9') where id=$1",
            [restaurant],
          ),
        "SADAKAT_PROGRAM_SETTINGS",
      );
    },
  );
  await check("insufficient reward balance", () =>
    fails(
      () =>
        query("mutate_sadakat", [
          restaurant,
          staff,
          randomUUID(),
          "redeem",
          digest,
          1,
          null,
          "",
        ]),
      "SADAKAT_INSUFFICIENT",
    ),
  );
  await query("mutate_sadakat", [
    restaurant,
    staff,
    randomUUID(),
    "earn",
    digest,
    8,
    null,
    "",
  ]);
  const redeemId = randomUUID();
  await check("reward preserves extra stamps", async () =>
    assert.equal(
      (
        await query("mutate_sadakat", [
          restaurant,
          staff,
          redeemId,
          "redeem",
          digest,
          1,
          null,
          "",
        ])
      ).stamps,
      2,
    ),
  );
  await check(
    "staff cannot reverse and owner reversal is append-only",
    async () => {
      await fails(
        () =>
          query("mutate_sadakat", [
            restaurant,
            staff,
            randomUUID(),
            "reversal",
            null,
            1,
            redeemId,
            "mistake",
          ]),
        "SADAKAT_FORBIDDEN",
      );
      await query("mutate_sadakat", [
        restaurant,
        owner,
        randomUUID(),
        "reversal",
        null,
        1,
        redeemId,
        "wrong reward",
      ]);
      assert.equal(
        (await query("read_sadakat_card", [restaurant, customer])).stamps,
        10,
      );
      await fails(
        () =>
          query("mutate_sadakat", [
            restaurant,
            owner,
            randomUUID(),
            "reversal",
            null,
            1,
            redeemId,
            "duplicate",
          ]),
        "SADAKAT_ALREADY_REVERSED",
      );
    },
  );
  await check(
    "concurrent manual and order redemption share the balance lock",
    async () => {
      const peer = new pg.Client({ connectionString: url.href });
      await peer.connect();
      peers.push(peer);
      const order = randomUUID();
      await client.query("insert into orders values($1)", [order]);
      const [manual, automatic] = await Promise.allSettled([
        query("mutate_sadakat", [
          restaurant,
          staff,
          randomUUID(),
          "redeem",
          digest,
          1,
          null,
          "",
        ]),
        peer.query("select * from redeem_loyalty($1,$2,$2,$3,0,8,100)", [
          customer,
          restaurant,
          order,
        ]),
      ]);
      assert.equal(
        (await query("read_sadakat_card", [restaurant, customer])).stamps,
        2,
      );
      assert.ok(
        manual.status === "fulfilled" ||
          (automatic.status === "fulfilled" &&
            automatic.value.rows[0].stamps_debited === 8),
      );
    },
  );
  await check(
    "same day multiple products count as one visit; masked CRM",
    async () => {
      const data = await query("read_sadakat_dashboard", [restaurant, owner]);
      assert.equal(data.customers[0].visits, 1);
      assert.equal(data.customers[0].stamps, 2);
      assert.ok(!data.customers[0].phone.includes("1234567"));
      const staffView = await query("read_sadakat_dashboard", [
        restaurant,
        staff,
      ]);
      assert.equal(staffView.customers, undefined);
      assert.equal(staffView.operations, undefined);
    },
  );
  await check("expired personal code rejected", async () => {
    await client.query(
      "update sadakat_codes set expires_at=now()-interval '1 second' where digest=$1",
      [digest],
    );
    await fails(
      () => query("resolve_sadakat_code", [restaurant, staff, digest]),
      "SADAKAT_CODE_EXPIRED",
    );
  });
  await check(
    "expired pilot retains readable card and existing-member login only",
    async () => {
      await client.query(
        "update restaurant_product_access set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where restaurant_id=$1",
        [restaurant],
      );
      assert.equal(
        (await query("read_sadakat_card", [restaurant, customer])).stamps,
        2,
      );
      assert.equal(
        await query("can_sadakat_authenticate", [restaurant, "+905551234567"]),
        true,
      );
      assert.equal(
        await query("can_sadakat_authenticate", [restaurant, "+905559999999"]),
        false,
      );
      await fails(
        () => query("join_sadakat", [restaurant, customer]),
        "SADAKAT_EXPIRED",
      );
      await fails(
        () =>
          query("mutate_sadakat", [
            restaurant,
            owner,
            randomUUID(),
            "earn",
            digest,
            1,
            null,
            "",
          ]),
        "SADAKAT_EXPIRED",
      );
    },
  );
  await check(
    "email-only members join with verification and regain readonly access after expiry",
    async () => {
      const emailCustomer = randomUUID(),
        unverified = randomUUID();
      await client.query(
        "insert into customers(id,email,verified_at) values($1,'pilot@example.test',now()),($2,'unverified@example.test',null)",
        [emailCustomer, unverified],
      );
      await client.query(
        "update restaurant_product_access set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day' where restaurant_id=$1",
        [restaurant],
      );
      assert.equal(
        await query("can_sadakat_email_authenticate", [
          restaurant,
          "pilot@example.test",
        ]),
        true,
      );
      await fails(
        () => query("join_sadakat", [restaurant, unverified]),
        "SADAKAT_CONTACT_REQUIRED",
      );
      assert.equal(
        (await query("join_sadakat", [restaurant, emailCustomer])).stamps,
        0,
      );
      const token = "b".repeat(64);
      await query("issue_sadakat_code", [restaurant, emailCustomer, token]);
      await query("mutate_sadakat", [
        restaurant,
        staff,
        randomUUID(),
        "earn",
        token,
        2,
        null,
        "",
      ]);
      assert.equal(
        (await query("read_sadakat_card", [restaurant, emailCustomer])).stamps,
        2,
      );
      await client.query(
        "update restaurant_product_access set ends_at=now()-interval '1 second' where restaurant_id=$1",
        [restaurant],
      );
      assert.equal(
        await query("can_sadakat_email_authenticate", [
          restaurant,
          " PILOT@EXAMPLE.TEST ",
        ]),
        true,
      );
      assert.equal(
        await query("can_sadakat_email_authenticate", [
          restaurant,
          "unverified@example.test",
        ]),
        false,
      );
      assert.equal(
        await query("can_sadakat_email_authenticate", [
          other,
          "pilot@example.test",
        ]),
        false,
      );
      await fails(
        () => query("join_sadakat", [restaurant, emailCustomer]),
        "SADAKAT_EXPIRED",
      );
      assert.equal(
        (await query("read_sadakat_card", [restaurant, emailCustomer])).stamps,
        2,
      );
    },
  );
  await check(
    "customer/anonymous SQL cannot read codes or invoke mutations",
    async () => {
      await client.query("set role anon");
      await fails(
        () => client.query("select * from sadakat_codes"),
        "permission denied",
      );
      await fails(
        () =>
          query("mutate_sadakat", [
            restaurant,
            owner,
            randomUUID(),
            "earn",
            digest,
            1,
            null,
            "",
          ]),
        "permission denied",
      );
      await fails(
        () =>
          query("can_sadakat_email_authenticate", [
            restaurant,
            "pilot@example.test",
          ]),
        "permission denied",
      );
      await client.query("reset role");
    },
  );
  console.log(`${checks} PostgreSQL Sadakat checks passed`);
} finally {
  for (const peer of peers) await peer.end();
  await client.end();
  await admin.query(`drop database ${database} with (force)`);
  await admin.end();
}
