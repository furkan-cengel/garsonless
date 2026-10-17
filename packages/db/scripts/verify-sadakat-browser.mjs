// DEV-only synthetic fixture + mobile browser verification. No SMS/email is sent.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { openSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (new URL(supabaseUrl).hostname !== "yxsegwkzyiscrxiwdeuf.supabase.co")
  throw new Error("Only DEV Supabase is allowed");
if (!process.argv.includes("--apply-dev-fixtures"))
  throw new Error("--apply-dev-fixtures required");
const service = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const anon = () =>
  createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const run = randomUUID(),
  password = `${randomBytes(20).toString("hex")}Aa!9`;
const tsconfigs = ["menu", "dashboard"].flatMap((app) =>
  ["tsconfig.json", "next-env.d.ts"].map((file) => {
    const path = `${root}apps/${app}/${file}`;
    return { path, contents: readFileSync(path, "utf8") };
  }),
);
const users = [],
  processes = [],
  logFiles = [];
let restaurantId, adminId, browser;
const must = (r, label) => {
  if (r.error) throw new Error(`${label}: ${r.error.code ?? r.error.message}`);
  return r.data;
};
const rpc = async (name, args) => must(await service.rpc(name, args), name);
async function user(label, customer = false) {
  const email = `sadakat-${label}-${run}@example.test`;
  const phone = undefined; // Pilot customer intentionally has no phone identity.
  const data = must(
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      ...(phone ? { phone, phone_confirm: true } : {}),
      app_metadata: { user_type: customer ? "customer" : "staff" },
    }),
    "synthetic auth user",
  );
  users.push(data.user.id);
  const session = must(
    await anon().auth.signInWithPassword({ email, password }),
    "synthetic login",
  ).session;
  return { id: data.user.id, email, phone, session };
}
async function startApp(app, port) {
  const log = openSync(`/tmp/masabu-sadakat-${app}.log`, "w");
  logFiles.push(log);
  const child = spawn(
    process.execPath,
    [
      `${root}apps/${app}/node_modules/next/dist/bin/next`,
      "dev",
      "--turbopack",
      "--port",
      String(port),
    ],
    {
      cwd: `${root}apps/${app}`,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_DIST_DIR: ".next-sadakat",
        NEXT_PUBLIC_MENU_URL: "http://localhost:3021",
        NEXT_PUBLIC_APP_URL: "http://localhost:3022",
        CUSTOMER_AUTH_PHONE_OTP_ENABLED: "false",
        CUSTOMER_AUTH_EMAIL_OTP_ENABLED: "true",
        DASHBOARD_DEVICE_SECURITY_ENABLED: "false",
      },
      stdio: ["ignore", log, log],
    },
  );
  processes.push(child);
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null)
      throw new Error(`${app} exited; inspect /tmp/masabu-sadakat-${app}.log`);
    try {
      const response = await fetch(`http://localhost:${port}/favicon.ico`);
      if (response.status < 500) return;
    } catch {
      /* Waiting for local test server. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${app} test server did not start`);
}
async function sessionCookie(context, session, menu) {
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const base = `${menu ? "msb-menu-" : ""}sb-yxsegwkzyiscrxiwdeuf-auth-token`;
  const cookies = [];
  for (let offset = 0; offset < value.length; offset += 3000)
    cookies.push({
      name: value.length > 3000 ? `${base}.${offset / 3000}` : base,
      value: value.slice(offset, offset + 3000),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    });
  await context.addCookies(cookies);
}
try {
  const owner = await user("owner"),
    staff = await user("staff"),
    ops = await user("ops"),
    member = await user("customer", true);
  adminId = ops.id;
  must(
    await service.from("platform_admin_users").insert({
      user_id: ops.id,
      role: "ops",
      status: "active",
      activated_at: new Date().toISOString(),
      display_name: "DEV Sadakat synthetic operator",
    }),
    "synthetic operator",
  );
  const slug = `sadakat-test-${run.slice(0, 8)}`;
  restaurantId = (
    await rpc("create_sadakat_business", {
      p_actor: owner.id,
      p_name: "Sadakat Test Kafe",
      p_slug: slug,
      p_request: randomUUID(),
    })
  ).restaurantId;
  await rpc("grant_sadakat_pilot", {
    p_restaurant: restaurantId,
    p_actor: ops.id,
    p_start: new Date(Date.now() - 60000).toISOString(),
    p_end: new Date(Date.now() + 86400000).toISOString(),
    p_reason: `DEV Sadakat browser verification ${run}`,
    p_request: randomUUID(),
  });
  must(
    await service.from("restaurant_members").insert({
      restaurant_id: restaurantId,
      user_id: staff.id,
      email: staff.email,
      status: "active",
      permissions: ["sadakat"],
      invited_by: owner.id,
      accepted_at: new Date().toISOString(),
    }),
    "synthetic staff",
  );
  const customer = await rpc("claim_customer_identity_atomic_v2", {
    p_auth_user_id: member.id,
    p_email: member.email,
    p_verified_phone: member.phone,
    p_name: "Test Müşteri",
  });
  const customerId = customer[0].id;
  assert.equal(
    must(
      await service
        .from("restaurants")
        .select("plan")
        .eq("id", restaurantId)
        .single(),
      "plan",
    ).plan,
    "starter",
  );
  console.log("PASS independent DEV access preserves Starter plan");
  await Promise.all([startApp("menu", 3021), startApp("dashboard", 3022)]);
  browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await sessionCookie(ownerContext, owner.session, false);
  const ownerPage = await ownerContext.newPage();
  const errors = [];
  ownerPage.on("pageerror", (e) => errors.push(e.message));
  await ownerPage.goto(`http://localhost:3022/sadakat/${restaurantId}`, {
    waitUntil: "networkidle",
  });
  await ownerPage.getByLabel("Karttaki işletme adı").fill("Mola Test Coffee");
  await ownerPage.getByLabel("Ödül için gereken damga").fill("8");
  await ownerPage
    .getByLabel("Ödül açıklaması", { exact: true })
    .fill("Ücretsiz kahve");
  await ownerPage
    .getByLabel("Damga kazandıran ürünler", { exact: true })
    .fill("Tüm kahveler");
  await ownerPage
    .getByRole("button", { name: "Kartı kaydet", exact: true })
    .click();
  await ownerPage
    .getByText("Kart kaydedildi.", { exact: true })
    .waitFor({ timeout: 15000 })
    .catch(async (error) => {
      console.log(
        "Owner error:",
        await ownerPage.getByRole("alert").allTextContents(),
      );
      throw error;
    });
  console.log("PASS owner publishes card without a menu or POS");
  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const customerPage = await customerContext.newPage();
  customerPage.on("pageerror", (e) => errors.push(e.message));
  // OTP transport is mocked: browser behavior is tested without contacting anyone.
  await customerPage.route("**/api/customer-auth/email/start", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { intent: "synthetic-otp-context", resendAfterSeconds: 90 },
      },
    }),
  );
  await customerPage.route(
    "**/api/customer-auth/email/verify",
    async (route) => {
      await sessionCookie(customerContext, member.session, true);
      await route.fulfill({
        json: { ok: true, data: { authenticated: true } },
      });
    },
  );
  await customerPage.goto(`http://localhost:3021/sadakat/${slug}`, {
    waitUntil: "networkidle",
  });
  await customerPage.getByRole("checkbox").check();
  await customerPage
    .getByLabel("E-posta adresin", { exact: true })
    .fill(member.email);
  await customerPage
    .getByRole("button", { name: "E-posta ile devam et" })
    .click();
  await customerPage.getByLabel("E-posta doğrulama kodu").fill("123456");
  await customerPage
    .getByRole("button", { name: "Doğrula ve kartımı oluştur" })
    .click();
  await customerPage
    .getByRole("button", { name: "Kasada göster", exact: true })
    .waitFor();
  console.log(
    "PASS customer email UI and real verified-session membership join (OTP delivery simulated)",
  );
  const staffContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: [],
  });
  await sessionCookie(staffContext, staff.session, false);
  const staffPage = await staffContext.newPage();
  staffPage.on("pageerror", (e) => errors.push(e.message));
  await staffPage.goto(`http://localhost:3022/sadakat/${restaurantId}`, {
    waitUntil: "networkidle",
  });
  assert.equal(
    await staffPage.getByText("Müşteriler", { exact: true }).count(),
    0,
  );
  assert.equal(await staffPage.getByLabel("Karttaki işletme adı").count(), 0);
  await staffPage.getByRole("button", { name: "Kamerayla QR okut" }).click();
  await staffPage.getByText(/Kamera açılamadı/).waitFor();
  console.log(
    "PASS camera denial offers manual entry; staff cannot see settings or CRM",
  );
  const newCode = async () => {
    await customerPage
      .getByRole("button", { name: "Kasada göster", exact: true })
      .click();
    await customerPage
      .getByAltText("Personele gösterilecek kişisel QR kod")
      .waitFor();
    return (
      await customerPage
        .locator("strong")
        .filter({ hasText: /^[A-F0-9]{4} [A-F0-9]{4}/ })
        .textContent()
    ).replaceAll(" ", "");
  };
  await staffPage.getByLabel("Müşteri kodu").fill(await newCode());
  await staffPage
    .getByRole("button", { name: "Kartı aç", exact: true })
    .click();
  await staffPage.getByLabel("Uygun ürün adedi").fill("2");
  await staffPage.getByRole("checkbox").check();
  await staffPage
    .getByRole("button", { name: "Damga ver", exact: true })
    .click();
  await staffPage.getByText("2 damga verildi.", { exact: true }).waitFor();
  await customerPage.reload({ waitUntil: "networkidle" });
  await customerPage
    .getByText("6 damga sonra ödül senin", { exact: true })
    .waitFor();
  await customerPage.screenshot({
    path: "/tmp/masabu-sadakat-customer.png",
    fullPage: true,
  });
  console.log(
    "PASS two eligible products earn two stamps on the customer card",
  );
  await staffPage.getByLabel("Müşteri kodu").fill(await newCode());
  await staffPage
    .getByRole("button", { name: "Kartı aç", exact: true })
    .click();
  await staffPage.getByLabel("Uygun ürün adedi").fill("8");
  await staffPage.getByRole("checkbox").check();
  await staffPage
    .getByRole("button", { name: "Damga ver", exact: true })
    .click();
  await staffPage.getByText("8 damga verildi.", { exact: true }).waitFor();
  await staffPage
    .getByRole("button", { name: "Ödülü kullandır", exact: true })
    .click();
  await staffPage.getByText("Ödül kullanıldı.", { exact: true }).waitFor();
  const card = await rpc("read_sadakat_card", {
    p_restaurant: restaurantId,
    p_customer: customerId,
  });
  assert.equal(card.stamps, 2);
  await ownerPage.reload({ waitUntil: "networkidle" });
  assert.equal(
    await ownerPage.getByLabel("Ödül için gereken damga").isDisabled(),
    true,
  );
  await ownerPage.screenshot({
    path: "/tmp/masabu-sadakat-owner.png",
    fullPage: true,
  });
  await staffPage.screenshot({
    path: "/tmp/masabu-sadakat-staff.png",
    fullPage: true,
  });
  console.log(
    "PASS reward redemption preserves two extra stamps; target locks after earning",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    "/tmp/masabu-sadakat-browser-result.json",
    JSON.stringify(
      {
        run,
        restaurantId,
        slug,
        checks: 8,
        otpDelivery: "simulated",
        screenshots: [
          "/tmp/masabu-sadakat-customer.png",
          "/tmp/masabu-sadakat-owner.png",
          "/tmp/masabu-sadakat-staff.png",
        ],
      },
      null,
      2,
    ),
  );
  console.log("PASS mobile browser verification; no page errors");
} finally {
  await browser?.close();
  for (const child of processes) child.kill("SIGTERM");
  for (const config of tsconfigs) writeFileSync(config.path, config.contents);
  if (restaurantId) {
    await service
      .from("restaurant_product_access")
      .update({
        starts_at: new Date(Date.now() - 86400000).toISOString(),
        ends_at: new Date(Date.now() - 1000).toISOString(),
      })
      .eq("restaurant_id", restaurantId);
    await service
      .from("restaurants")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", restaurantId);
    await service
      .from("restaurant_members")
      .update({ status: "disabled" })
      .eq("restaurant_id", restaurantId);
  }
  if (adminId)
    await service
      .from("platform_admin_users")
      .update({ status: "suspended" })
      .eq("user_id", adminId);
  for (const id of users)
    await service.auth.admin.updateUserById(id, { ban_duration: "876000h" });
}
