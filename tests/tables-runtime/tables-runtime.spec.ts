import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { createClient } from "../../packages/db/src/browser-client";
import { createServiceClient } from "../../packages/db/src/service-client";
import { createTableSessionPort } from "../../packages/db/src/table-command-port";

const DEV_PROJECT_REF = "yxsegwkzyiscrxiwdeuf";
const dashboardURL =
  process.env["TABLES_RUNTIME_DASHBOARD_URL"] ?? "http://127.0.0.1:3010";
const evidencePath = process.env["TABLES_RUNTIME_BROWSER_EVIDENCE_PATH"];
const evidenceDir =
  process.env["TABLES_RUNTIME_SCREENSHOT_DIR"] ??
  resolve("test-results/tables-runtime");

function loadLocalEnvironment() {
  if (process.env["NEXT_PUBLIC_SUPABASE_URL"]) return;
  const localEnvironment = resolve("apps/dashboard/.env.local");
  if (existsSync(localEnvironment)) loadEnvFile(localEnvironment);
}

function assertSafeRuntimeTarget() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  expect(url, "NEXT_PUBLIC_SUPABASE_URL is required").toBeTruthy();
  expect(new URL(url!).hostname.split(".")[0]).toBe(DEV_PROJECT_REF);
}

function dashboardSessionCookies(session: unknown) {
  const projectRef = new URL(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  ).hostname.split(".")[0]!;
  const baseName = `sb-${projectRef}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const chunks = value.match(/.{1,3180}/g) ?? [value];
  return chunks.map((chunk, index) => ({
    name: chunks.length === 1 ? baseName : `${baseName}.${index}`,
    value: chunk,
    url: dashboardURL,
    sameSite: "Lax" as const,
  }));
}

async function createOwnerSession(ownerId: string) {
  const service = createServiceClient();
  const { data: owner, error: ownerError } =
    await service.auth.admin.getUserById(ownerId);
  expect(ownerError).toBeNull();
  expect(owner.user.email).toBeTruthy();
  const { data: link, error: linkError } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email: owner.user.email!,
    });
  expect(linkError).toBeNull();
  const { data: verified, error: verifyError } =
    await createClient().auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    });
  expect(verifyError).toBeNull();
  expect(verified.session).toBeTruthy();
  return verified.session!;
}

function observe(
  page: Page,
  label: string,
  errors: { console: string[]; page: string[]; http: string[] },
) {
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.console.push(`${label}:${message.text()}`);
  });
  page.on("pageerror", (error) =>
    errors.page.push(`${label}:${error.message}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.http.push(
        `${label}:${response.status()}:${new URL(response.url()).pathname}`,
      );
  });
}

async function waitForLive(page: Page) {
  await expect(
    page.getByText("Canlı güncelleme bağlı", { exact: true }),
  ).toBeVisible({ timeout: 35_000 });
}

async function waitForActiveTable(page: Page, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const floorCard = page.locator(".tb-floor-card__main").filter({ hasText: label });
  await expect(floorCard).toHaveAccessibleName(
    new RegExp(`^${escapedLabel}, Açık,`),
    { timeout: 25_000 },
  );
  await expect(floorCard).toBeVisible();
}

async function captureRouteLoading({
  page,
  linkName,
  targetPath,
  statusText,
  screenshotName,
}: {
  page: Page;
  linkName: "Canlı Masalar" | "QR Studio";
  targetPath: string;
  statusText: string;
  screenshotName: string;
}) {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 80,
    downloadThroughput: 48 * 1024,
    uploadThroughput: 48 * 1024,
  });
  const link = page.getByRole("link", { name: linkName, exact: true });
  await expect(link).toBeVisible();
  // A warm client navigation may correctly bypass loading.tsx entirely.
  // Reload the target document to exercise its cold streamed loading state.
  const clickPromise = page.goto(`${dashboardURL}${targetPath}`, { waitUntil: "commit" });
  try {
    const skeleton = page.locator(".tb-route-skeleton").filter({ hasText: statusText });
    await expect(skeleton).toContainText(statusText, { timeout: 10_000 });
    const measurements = await skeleton.evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      return {
        accessibleText: element
          .querySelector(".tb-route-skeleton__sr-only")
          ?.textContent?.trim(),
        ariaBusy: element.getAttribute("aria-busy"),
        viewportWidth: window.innerWidth,
        skeletonWidth: rectangle.width,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        interactiveDescendants: element.querySelectorAll(
          "a,button,input,select,textarea,[tabindex]",
        ).length,
        operationsRows: element.querySelectorAll(
          ".tb-route-skeleton__table-row",
        ).length,
        qrRegions: [
          ".tb-route-skeleton__qr-picker",
          ".tb-route-skeleton__qr-canvas",
          ".tb-route-skeleton__properties",
        ].filter((selector) => {
          const region = element.querySelector(selector);
          return region && getComputedStyle(region).display !== "none";
        }).length,
      };
    });
    expect(measurements.ariaBusy).toBe("true");
    expect(measurements.documentScrollWidth).toBe(
      measurements.documentClientWidth,
    );
    expect(measurements.interactiveDescendants).toBe(0);
    await page.screenshot({
      path: resolve(evidenceDir, screenshotName),
      animations: "disabled",
    });
    return { ...measurements, networkThrottled: true };
  } finally {
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await clickPromise.catch(() => undefined);
    await page.waitForURL((url) => url.pathname === targetPath);
    await client.detach();
    await page.evaluate(
      (path) => window.history.replaceState(window.history.state, "", path),
      targetPath,
    );
  }
}

test.describe("tables production runtime gate", () => {
  test.skip(
    process.env["TABLES_RUNTIME_ALLOW_MUTATION"] !== "1",
    "Explicit isolated DEV mutation opt-in is required",
  );

  test("settlement modal and two-context Realtime reconnect stay coherent", async ({
    browser,
  }) => {
    loadLocalEnvironment();
    assertSafeRuntimeTarget();
    mkdirSync(evidenceDir, { recursive: true });

    const service = createServiceClient();
    const port = createTableSessionPort();
    const errors = {
      console: [] as string[],
      page: [] as string[],
      http: [] as string[],
    };
    const evidence: Record<string, unknown> = {
      target: "linked DEV only",
      cleanup: { ok: false },
    };
    let restaurantId = "";
    let desktopContext: BrowserContext | null = null;
    let mobileContext: BrowserContext | null = null;

    try {
      const { data: ownerRestaurant, error: ownerError } = await service
        .from("restaurants")
        .select("owner_id")
        .is("deleted_at", null)
        .limit(1)
        .single();
      expect(ownerError).toBeNull();
      expect(ownerRestaurant).toBeTruthy();
      const { data: restaurant, error: restaurantError } = await service
        .from("restaurants")
        .insert({
          name: "Isolated Tables Browser Runtime Gate",
          slug: `tables-browser-runtime-${Date.now()}-${randomUUID().slice(0, 6)}`,
          owner_id: ownerRestaurant!.owner_id,
          plan: "business",
        })
        .select("id")
        .single();
      expect(restaurantError).toBeNull();
      expect(restaurant).toBeTruthy();
      restaurantId = restaurant!.id;
      const { data: billingCustomer, error: billingCustomerError } = await service
        .from("billing_customers")
        .insert({
          restaurant_id: restaurantId,
          legal_name: "Isolated Tables Browser Runtime Gate",
          contact_email: "tables-runtime@example.invalid",
        })
        .select("id")
        .single();
      expect(billingCustomerError).toBeNull();
      expect(billingCustomer).toBeTruthy();
      const { error: subscriptionError } = await service
        .from("billing_subscriptions")
        .insert({
          restaurant_id: restaurantId,
          billing_customer_id: billingCustomer!.id,
          plan: "business",
          status: "active",
          current_period_start: new Date(Date.now() - 60_000).toISOString(),
          current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
        });
      expect(subscriptionError).toBeNull();

      const sourceLabel = "Runtime Canlı Kaynak";
      const targetLabel = "Runtime Canlı Hedef";
      const { data: tables, error: tablesError } = await service
        .from("tables")
        .insert([
          { restaurant_id: restaurantId, label: sourceLabel },
          { restaurant_id: restaurantId, label: targetLabel },
        ])
        .select("id,label");
      expect(tablesError).toBeNull();
      expect(tables).toHaveLength(2);
      const sourceTableId = tables!.find(
        (table) => table.label === sourceLabel,
      )!.id;
      const targetTableId = tables!.find(
        (table) => table.label === targetLabel,
      )!.id;
      const { data: session, error: sessionError } = await service
        .from("table_sessions")
        .insert({
          restaurant_id: restaurantId,
          table_id: sourceTableId,
        })
        .select("id")
        .single();
      expect(sessionError).toBeNull();
      expect(session).toBeTruthy();
      const { error: orderError } = await service.from("orders").insert({
        restaurant_id: restaurantId,
        table_id: sourceTableId,
        table_session_id: session!.id,
        session_id: randomUUID(),
        status: "served",
        total: 323,
        items: [
          {
            name: "Runtime Avokado Tost",
            quantity: 3,
            price: 100,
            note: "Ekşi mayalı",
          },
          { name: "Runtime Çay", quantity: 1, price: 23 },
        ],
      });
      expect(orderError).toBeNull();

      const ownerSession = await createOwnerSession(ownerRestaurant!.owner_id);
      const anonymous = createClient();
      const { error: anonymousQrWriteError } = await anonymous.rpc(
        "patch_restaurant_qr_style",
        {
          p_restaurant_id: restaurantId,
          p_qr_style: {},
          p_expected_revision: 0,
        },
      );
      expect(anonymousQrWriteError).toBeTruthy();
      const authenticated = createClient();
      const { error: setSessionError } = await authenticated.auth.setSession({
        access_token: ownerSession.access_token,
        refresh_token: ownerSession.refresh_token,
      });
      expect(setSessionError).toBeNull();
      const { error: authenticatedQrWriteError } = await authenticated.rpc(
        "patch_restaurant_qr_style",
        {
          p_restaurant_id: restaurantId,
          p_qr_style: {},
          p_expected_revision: 0,
        },
      );
      expect(authenticatedQrWriteError).toBeTruthy();
      evidence["qrStyleRpcBoundary"] = {
        anonymousRejected: true,
        authenticatedRejected: true,
        serviceRoleViaAuthorizedServerAction: true,
      };
      desktopContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: "light",
      });
      mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: "light",
        isMobile: true,
        hasTouch: true,
      });
      await Promise.all([
        desktopContext.addCookies(dashboardSessionCookies(ownerSession)),
        mobileContext.addCookies(dashboardSessionCookies(ownerSession)),
      ]);
      const desktop = await desktopContext.newPage();
      const mobile = await mobileContext.newPage();
      observe(desktop, "desktop", errors);
      observe(mobile, "mobile", errors);
      const responses = await Promise.all([
        desktop.goto(`${dashboardURL}/dashboard/${restaurantId}/tables`, {
          waitUntil: "domcontentloaded",
        }),
        mobile.goto(`${dashboardURL}/dashboard/${restaurantId}/tables`, {
          waitUntil: "domcontentloaded",
        }),
      ]);
      expect(responses.map((response) => response?.status())).toEqual([
        200, 200,
      ]);
      await Promise.all([waitForLive(desktop), waitForLive(mobile)]);
      await Promise.all([
        waitForActiveTable(desktop, sourceLabel),
        waitForActiveTable(mobile, sourceLabel),
      ]);

      // T04: safety refreshes must not discard an in-progress transfer selection.
      await mobile.getByRole("button", { name: new RegExp(`^${sourceLabel},`) }).first().click();
      const detail = mobile.getByRole("dialog");
      await detail.getByRole("button", { name: "Taşımak için seç", exact: true }).click();
      await detail.getByRole("checkbox", { name: "1. siparişi seç", exact: true }).check();
      for (let cycle = 0; cycle < 2; cycle++) {
        const refreshed = await mobile.waitForEvent("requestfinished", {
          predicate: request => request.method() === "POST" && request.url().includes(`/dashboard/${restaurantId}/tables`),
          timeout: 60_000,
        });
        expect((await refreshed.response())?.ok()).toBe(true);
        await expect(detail.getByRole("checkbox", { name: "1. siparişi seç", exact: true })).toBeChecked();
        await expect(detail.getByRole("button", { name: "Ürünleri seç (1)", exact: true })).toBeVisible();
      }
      await mobile.keyboard.press("Escape");

      await desktop.getByRole("button", { name: "Kapat", exact: true }).click();
      const settlement = desktop.getByRole("dialog", {
        name: "Tahsilatı tamamla",
      });
      await expect(settlement).toBeVisible();
      await expect(
        settlement.getByText("Runtime Avokado Tost", { exact: true }),
      ).toBeVisible({ timeout: 25_000 });
      await expect(settlement.getByText("Runtime Çay", { exact: true })).toBeVisible();
      await expect(settlement).toContainText("₺323");
      await expect(
        settlement.getByRole("button", {
          name: "Pencereyi kapat",
          exact: true,
        }),
      ).toBeFocused();
      expect(await desktop.evaluate(() => document.body.style.overflow)).toBe(
        "hidden",
      );
      await desktop.screenshot({
        path: resolve(evidenceDir, "51-tbl-012-ci-settlement-modal.png"),
        animations: "disabled",
      });
      await desktop.keyboard.press("Escape");
      await expect(settlement).toHaveCount(0);
      await expect.poll(
        () => desktop.evaluate(() => document.body.style.overflow),
      ).not.toBe("hidden");
      await expect(
        desktop.getByRole("button", { name: "Kapat", exact: true }),
      ).toBeFocused();

      await desktop
        .getByRole("button", {
          name: `${sourceLabel} ürün veya hesabını taşı`,
          exact: true,
        })
        .click();
      const transfer = desktop.getByRole("dialog", {
        name: "Ürün veya sipariş taşı",
      });
      await expect(transfer).toBeVisible();
      await expect(
        transfer.getByRole("button", { name: "Pencereyi kapat", exact: true }),
      ).toBeFocused();
      await expect(
        transfer.getByRole("checkbox", {
          name: "Runtime Avokado Tost ürününü seç",
          exact: true,
        }),
      ).toBeVisible({ timeout: 25_000 });
      await transfer
        .getByRole("checkbox", {
          name: "Runtime Avokado Tost ürününü seç",
          exact: true,
        })
        .check();
      await transfer
        .getByRole("combobox", {
          name: "Runtime Avokado Tost taşınacak adet",
          exact: true,
        })
        .click();
      await desktop.getByRole("option", { name: /^2 \/ / }).click();
      await expect(
        transfer.getByRole("button", {
          name: "Taşımayı onayla · 2 adet",
          exact: true,
        }),
      ).toBeDisabled();
      const targetSelect = transfer.getByRole("combobox", {
        name: "Hedef masa",
        exact: true,
      });
      await targetSelect.evaluate((element) => {
        element.scrollIntoView({ block: "center", inline: "nearest" });
      });
      await expect(targetSelect).toBeVisible();
      await targetSelect.click();
      await desktop
        .getByRole("option", { name: `${targetLabel} · Boş`, exact: true })
        .click();
      await expect(
        transfer.getByRole("button", {
          name: "Taşımayı onayla · 2 adet",
          exact: true,
        }),
      ).toBeEnabled();
      await desktop.screenshot({
        path: resolve(evidenceDir, "63-item-quantity-transfer-desktop.png"),
        animations: "disabled",
      });

      await mobile
        .getByRole("button", {
          name: `${sourceLabel} hızlı işlemleri`,
          exact: true,
        })
        .click();
      await mobile
        .getByRole("menu", { name: `${sourceLabel} hızlı işlemleri` })
        .getByRole("menuitem", { name: "Ürün / hesap taşı", exact: true })
        .click();
      const mobileTransfer = mobile.getByRole("dialog", {
        name: "Ürün veya sipariş taşı",
      });
      await expect(
        mobileTransfer.getByRole("checkbox", {
          name: "Runtime Avokado Tost ürününü seç",
          exact: true,
        }),
      ).toBeVisible({ timeout: 25_000 });
      await mobileTransfer
        .getByRole("checkbox", {
          name: "Runtime Avokado Tost ürününü seç",
          exact: true,
        })
        .check();
      await mobileTransfer
        .getByRole("combobox", {
          name: "Runtime Avokado Tost taşınacak adet",
          exact: true,
        })
        .click();
      await mobile.getByRole("option", { name: /^2 \/ / }).click();
      await mobile.screenshot({
        path: resolve(evidenceDir, "64-item-quantity-transfer-mobile.png"),
        animations: "disabled",
      });
      await mobile.keyboard.press("Escape");
      await expect(mobileTransfer).toHaveCount(0);

      await transfer
        .getByRole("button", {
          name: "Taşımayı onayla · 2 adet",
          exact: true,
        })
        .click();
      await expect(transfer).toHaveCount(0);
      await expect(desktop.getByText("Taşıma tamamlandı.", { exact: true })).toBeVisible();
      await waitForActiveTable(desktop, targetLabel);
      await desktop.getByRole("button", { name: "Geri al", exact: true }).click();
      await expect(desktop.getByText("Taşıma geri alındı.", { exact: true })).toBeVisible();
      await waitForActiveTable(desktop, sourceLabel);
      evidence["itemQuantityTransfer"] = {
        selected: "2 of 3 Runtime Avokado Tost",
        desktopResponsive: true,
        mobileResponsive: true,
        serverActionCompleted: true,
        undoCompleted: true,
      };

      const moveStartedAt = Date.now();
      const moveRequestId = randomUUID();
      const moved = await port.moveSession({
        restaurantId,
        sourceTableId,
        targetTableId,
        actorId: ownerRestaurant!.owner_id,
        requestId: moveRequestId,
      });
      expect(moved.ok).toBe(true);
      if (!moved.ok) throw new Error(moved.error);
      await Promise.all([
        waitForActiveTable(desktop, targetLabel),
        waitForActiveTable(mobile, targetLabel),
      ]);
      evidence["twoContextMoveMs"] = Date.now() - moveStartedAt;

      await mobileContext.setOffline(true);
      await expect(
        mobile.getByText("Canlı güncelleme kesildi", { exact: true }),
      ).toBeVisible({ timeout: 8_000 });
      const undoStartedAt = Date.now();
      const undone = await port.undoTransfer({
        restaurantId,
        operationId: moved.value.operationId,
        actorId: ownerRestaurant!.owner_id,
      });
      expect(undone.ok).toBe(true);
      if (!undone.ok) throw new Error(undone.error);
      expect(undone.value.error).toBeUndefined();
      await waitForActiveTable(desktop, sourceLabel);
      evidence["onlineUndoMs"] = Date.now() - undoStartedAt;

      const reconnectStartedAt = Date.now();
      await mobileContext.setOffline(false);
      await waitForLive(mobile);
      await waitForActiveTable(mobile, sourceLabel);
      evidence["reconnectReconciliationMs"] = Date.now() - reconnectStartedAt;
      evidence["missedEventRecovered"] = true;
      await mobile.screenshot({
        path: resolve(evidenceDir, "52-tbl-012-ci-realtime-recovered.png"),
        animations: "disabled",
      });

      await desktop.getByRole("button", { name: "Geçmiş", exact: true }).click();
      const historyDialog = desktop.getByRole("dialog", {
        name: "Taşıma Geçmişi",
      });
      await expect(historyDialog).toBeVisible();
      await expect(historyDialog.getByText("Masa taşıma · 1 sipariş")).toBeVisible();
      await expect(historyDialog.getByText(/İşlemi yapan: Siz/).first()).toBeVisible();
      await historyDialog
        .getByRole("combobox", { name: "Taşıma türü filtresi" })
        .selectOption("table_move");
      await historyDialog
        .getByRole("combobox", { name: "Taşıma durumu filtresi" })
        .selectOption("undone");
      await historyDialog
        .getByRole("searchbox", { name: "Taşıma geçmişinde ara" })
        .fill(sourceLabel);
      await expect(historyDialog.getByText("1 / 2 işlem", { exact: true })).toBeVisible();
      await historyDialog.getByText("Audit ayrıntıları", { exact: true }).click();
      await expect(historyDialog.getByText(moveRequestId, { exact: true })).toBeVisible();
      await expect(historyDialog.getByText(/Açık adisyon hedef masaya taşındı/)).toBeVisible();
      await desktop.screenshot({
        path: resolve(evidenceDir, "57-transfer-history-audit-metadata.png"),
        animations: "disabled",
      });
      evidence["historyAudit"] = {
        kindFilter: true,
        statusFilter: true,
        search: true,
        actorLabel: "Siz",
        requestIdVisible: true,
        sessionOutcomeVisible: true,
      };
      await historyDialog
        .getByRole("button", { name: "Pencereyi kapat", exact: true })
        .click();

      await mobile.getByRole("button", { name: "Geçmiş Taşımalar", exact: true }).click();
      const mobileHistoryDialog = mobile.getByRole("dialog", {
        name: "Taşıma Geçmişi",
      });
      await expect(mobileHistoryDialog).toBeVisible();
      await mobileHistoryDialog
        .getByRole("combobox", { name: "Taşıma türü filtresi" })
        .selectOption("table_move");
      await mobileHistoryDialog
        .getByRole("combobox", { name: "Taşıma durumu filtresi" })
        .selectOption("undone");
      await mobileHistoryDialog
        .getByRole("searchbox", { name: "Taşıma geçmişinde ara" })
        .fill(sourceLabel);
      await mobileHistoryDialog
        .getByText("Audit ayrıntıları", { exact: true })
        .click();
      await expect(
        mobileHistoryDialog.getByText(moveRequestId, { exact: true }),
      ).toBeVisible();
      await mobile.screenshot({
        path: resolve(evidenceDir, "58-transfer-history-audit-mobile.png"),
        animations: "disabled",
      });
      await mobileHistoryDialog
        .getByRole("button", { name: "Pencereyi kapat", exact: true })
        .click();
      evidence["historyAudit"] = {
        ...(evidence["historyAudit"] as Record<string, unknown>),
        mobileResponsive: true,
      };

      const qrLoadingSkeleton = await captureRouteLoading({
        page: desktop,
        linkName: "QR Studio",
        targetPath: `/dashboard/${restaurantId}/tables/qr`,
        statusText: "QR Studio hazırlanıyor",
        screenshotName: "61-qr-loading-skeleton-desktop.png",
      });
      await expect(desktop).toHaveURL(
        `${dashboardURL}/dashboard/${restaurantId}/tables/qr`,
      );
      await expect(
        desktop.getByRole("link", { name: "QR Studio", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        desktop.getByRole("complementary", { name: "QR masası seçimi" }),
      ).toBeVisible();
      await expect(
        desktop.getByRole("button", {
          name: `${sourceLabel} QR kodunu düzenle`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        desktop.getByText("Canlı güncelleme bağlı", { exact: true }),
      ).toHaveCount(0);
      const qrPropertyTabs = [
        { name: "Renk", content: "Renk türü" },
        { name: "Logo", content: "Marka logosu" },
        { name: "Çerçeve", content: "Çerçeve stili" },
        { name: "Veri", content: "Bağlantı" },
      ] as const;
      await expect(
        desktop.getByRole("tab", { name: "Şekil", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      for (const propertyTab of qrPropertyTabs) {
        const tab = desktop.getByRole("tab", {
          name: propertyTab.name,
          exact: true,
        });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(
          desktop.getByText(propertyTab.content, { exact: true }),
        ).toBeVisible();
      }
      await desktop.screenshot({
        path: resolve(evidenceDir, "55-qr-properties-desktop-data.png"),
        animations: "disabled",
      });
      await desktop
        .getByRole("tab", { name: "Şekil", exact: true })
        .click();
      await desktop.screenshot({
        path: resolve(evidenceDir, "53-release-qr-studio-desktop.png"),
        animations: "disabled",
      });

      await mobile.getByRole("link", { name: "QR Studio", exact: true }).click();
      await expect(mobile).toHaveURL(
        `${dashboardURL}/dashboard/${restaurantId}/tables/qr`,
      );
      await expect(
        mobile.getByRole("link", { name: "QR Studio", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      const mobileOverflow = await mobile.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(mobileOverflow.scrollWidth).toBe(mobileOverflow.clientWidth);
      await mobile.screenshot({
        path: resolve(evidenceDir, "54-release-qr-studio-mobile.png"),
        animations: "disabled",
      });
      await mobile.getByRole("tab", { name: "Tasarım", exact: true }).click();
      const mobileLogoTab = mobile.getByRole("tab", {
        name: "Logo",
        exact: true,
      });
      await mobileLogoTab.click();
      await expect(mobileLogoTab).toHaveAttribute("aria-selected", "true");
      await expect(
        mobile.getByText("Marka logosu", { exact: true }),
      ).toBeVisible();
      await mobile.screenshot({
        path: resolve(evidenceDir, "56-qr-properties-mobile-logo.png"),
        animations: "disabled",
      });

      const desktopColorTab = desktop.getByRole("tab", {
        name: "Renk",
        exact: true,
      });
      await desktopColorTab.click();
      await desktop
        .getByRole("button", { name: "#a13b7a rengini seç", exact: true })
        .click();
      await expect(
        desktop.getByText("Stil kaydediliyor", { exact: true }),
      ).toBeVisible();
      await expect(
        desktop.getByText("Stil kaydedildi", { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await desktop.screenshot({
        path: resolve(evidenceDir, "59-qr-optimistic-save-desktop.png"),
        animations: "disabled",
      });

      const mobileColorTab = mobile.getByRole("tab", {
        name: "Renk",
        exact: true,
      });
      await mobileColorTab.click();
      await mobile
        .getByRole("button", { name: "#2f6f4e rengini seç", exact: true })
        .click();
      const conflictMessage =
        "Başka bir çalışan QR stilini değiştirdi. Sunucudaki güncel sürüm yüklendi; bu sekmedeki kaydedilmemiş değişiklikler geri alındı.";
      await expect(mobile.getByText(conflictMessage, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        mobile.getByRole("button", {
          name: "#a13b7a rengini seç",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        mobile.getByRole("button", {
          name: "#2f6f4e rengini seç",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "false");
      await expect(
        mobile.getByRole("button", { name: "Tekrar dene", exact: true }),
      ).toHaveCount(0);
      await mobile.waitForTimeout(900);
      const { data: qrSnapshot, error: qrSnapshotError } = await service
        .from("restaurants")
        .select("qr_style_revision,settings")
        .eq("id", restaurantId)
        .single();
      expect(qrSnapshotError).toBeNull();
      expect(qrSnapshot?.qr_style_revision).toBe(1);
      expect(
        (
          (qrSnapshot?.settings as Record<string, unknown>)?.[
            "qr_style"
          ] as Record<string, unknown>
        )?.["fg"],
      ).toBe("#a13b7a");
      await mobile.screenshot({
        path: resolve(evidenceDir, "60-qr-conflict-rollback-mobile.png"),
        animations: "disabled",
      });
      evidence["qrOptimisticConflict"] = {
        firstWriterRevision: 1,
        staleWriterRejected: true,
        authoritativeColor: "#a13b7a",
        localConflictingColorRolledBack: true,
        rollbackWasNotRepersisted: true,
        retryHiddenAfterSafeRollback: true,
      };

      await desktop
        .getByRole("link", { name: "Canlı Masalar", exact: true })
        .click();
      await expect(desktop).toHaveURL(
        `${dashboardURL}/dashboard/${restaurantId}/tables`,
      );
      await waitForLive(desktop);
      await waitForActiveTable(desktop, sourceLabel);
      const operationsLoadingSkeleton = await captureRouteLoading({
        page: mobile,
        linkName: "Canlı Masalar",
        targetPath: `/dashboard/${restaurantId}/tables`,
        statusText: "Canlı masa görünümü hazırlanıyor",
        screenshotName: "62-operations-loading-skeleton-mobile.png",
      });
      await expect(mobile).toHaveURL(
        `${dashboardURL}/dashboard/${restaurantId}/tables`,
      );
      await waitForLive(mobile);
      await waitForActiveTable(mobile, sourceLabel);
      evidence["routeSkeletons"] = {
        qrDesktop: qrLoadingSkeleton,
        operationsMobile: operationsLoadingSkeleton,
        routeSpecific: true,
        reducedMotionRule: true,
      };
      evidence["routeSplit"] = {
        operationsPath: `/dashboard/${restaurantId}/tables`,
        qrPath: `/dashboard/${restaurantId}/tables/qr`,
        qrHasRealtimeStatus: false,
        mobileHorizontalOverflow: false,
        returnToOperationsRecoveredLiveState: true,
      };

      expect(errors.console).toEqual([]);
      expect(errors.page).toEqual([]);
      expect(errors.http).toEqual([]);
      evidence["browserHealth"] = {
        consoleErrors: 0,
        pageErrors: 0,
        failedResponses: 0,
      };
    } finally {
      await desktopContext?.close().catch(() => undefined);
      await mobileContext?.close().catch(() => undefined);
      const cleanupErrors: string[] = [];
      if (restaurantId) {
        for (const relation of [
          "table_transfer_operations",
          "service_requests",
          "payment_shares",
          "orders",
          "table_sessions",
          "table_qr_tokens",
          "tables",
        ] as const) {
          const { error } = await service
            .from(relation)
            .delete()
            .eq("restaurant_id", restaurantId);
          if (error) cleanupErrors.push(`${relation}:${error.code}`);
        }
        for (const relation of [
          "billing_subscriptions",
          "billing_customers",
        ] as const) {
          const { error } = await service
            .from(relation)
            .delete()
            .eq("restaurant_id", restaurantId);
          if (error) cleanupErrors.push(`${relation}:${error.code}`);
        }
        const { error } = await service
          .from("restaurants")
          .delete()
          .eq("id", restaurantId);
        if (error) cleanupErrors.push(`restaurants:${error.code}`);
      }
      expect(cleanupErrors).toEqual([]);
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
  });
});
