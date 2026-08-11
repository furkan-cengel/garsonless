import { expect, test } from "@playwright/test";
import { assertVisualHealth, collectPageFailures } from "./visual-health";

const dashboardURL = process.env["SMOKE_DASHBOARD_URL"] ?? "http://localhost:3005";
const menuURL = process.env["SMOKE_MENU_URL"] ?? "http://localhost:3011";
const kitchenURL = process.env["SMOKE_KITCHEN_URL"] ?? "http://localhost:3002";
const marketingURL = process.env["SMOKE_MARKETING_URL"] ?? "http://localhost:3003";
const menuSlug = process.env["SMOKE_MENU_SLUG"] ?? "maf-lounge";

test.describe("public visual smoke", () => {
  test("dashboard login is visually healthy", async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page);
    const response = await page.goto(`${dashboardURL}/auth/login`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Tekrar/i }).first()).toBeVisible();
    await assertVisualHealth(page, testInfo, "dashboard-login");
    expect(failures).toEqual([]);
  });

  test("marketing home is visually healthy", async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page);
    const response = await page.goto(marketingURL, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /garsonsuz sipariş/i })).toBeVisible();
    await assertVisualHealth(page, testInfo, "marketing-home");
    expect(failures).toEqual([]);
  });

  test("public menu fixture is visually healthy", async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page);
    const response = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}?preview=1`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-menu-hydrated", "true");
    await assertVisualHealth(page, testInfo, "menu-fixture", {
      minTextLength: 16,
    });

    const firstProduct = page.locator('[data-component="card"]').first();
    const firstProductOpenButton = firstProduct.getByRole("button", {
      name: /detayını aç/i,
    });
    await expect(firstProduct).toBeVisible();
    await firstProductOpenButton.click();
    const productDialog = page.getByRole("dialog", { name: /.+/ }).last();
    await expect(productDialog).toBeVisible();
    const closeButton = productDialog.getByRole("button", {
      name: /ürün detayını kapat/i,
    });
    await expect(closeButton).toBeFocused();
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      expect(await productDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
    const productDialogWidth = await productDialog.evaluate((dialog) => dialog.getBoundingClientRect().width);
    if (testInfo.project.name === "public-desktop") {
      expect(productDialogWidth).toBeGreaterThanOrEqual(760);
      expect(productDialogWidth).toBeLessThanOrEqual(960);
    } else {
      expect(productDialogWidth).toBeLessThanOrEqual(720);
    }
    const addButton = productDialog.getByRole("button", {
      name: /sepete ekle/i,
    });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    const cartDialog = page.getByRole("dialog", { name: "Sepetiniz" });
    await expect(cartDialog).toBeVisible();
    await expect(cartDialog.getByRole("button", { name: "Sepeti kapat" })).toBeFocused();
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      expect(await cartDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
    await expect(page.locator('[data-component="cart-checkout-unavailable"]')).toContainText(/QR kodunu okutun/i);
    await expect(page.getByRole("button", { name: /Masadaki QR kodu okutun/i })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-component="cart-checkout-unavailable"]')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    expect(
      (await firstProduct.evaluate((card) => card.contains(document.activeElement))) ||
        (await page
          .getByRole("button", { name: /^Sepeti aç/ })
          .first()
          .evaluate((button) => button === document.activeElement)),
    ).toBe(true);

    await firstProductOpenButton.click();
    await expect(productDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(productDialog).toBeHidden();
    expect(await firstProduct.evaluate((card) => card.contains(document.activeElement))).toBe(true);
    expect(failures).toEqual([]);
  });

  test("product modal keeps its header and cart action visible at mobile heights", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "public-mobile", "The mobile project owns modal height regression coverage.");
    const failures = await collectPageFailures(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });

    const response = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}?preview=1`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-menu-hydrated", "true");

    const menemenButton = page.getByRole("button", { name: /Menemen detayını aç/i }).first();
    const fallbackButton = page
      .locator('[data-component="card"]')
      .first()
      .getByRole("button", { name: /detayını aç/i });
    const openButton = (await menemenButton.count()) > 0 ? menemenButton : fallbackButton;
    await expect(openButton).toBeVisible();
    await openButton.click();

    const dialog = page.locator('[data-component="product-modal"]').last();
    const header = dialog.locator('[data-component="product-modal-header"]');
    const scrollArea = dialog.locator('[data-component="product-modal-scroll"]');
    const actions = dialog.locator('[data-component="product-modal-actions"]');
    await expect(dialog).toBeVisible();
    await expect(header).toBeVisible();
    await expect(scrollArea).toBeVisible();
    await expect(actions).toBeVisible();

    for (const height of [844, 640]) {
      await page.setViewportSize({ width: 390, height });
      await scrollArea.evaluate((element) => element.scrollTo({ top: 0 }));

      const before = await page.evaluate(() => {
        const dialogElement = document.querySelector<HTMLElement>('[data-component="product-modal"]');
        const headerElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-header"]');
        const scrollElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-scroll"]');
        const actionsElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-actions"]');
        if (!dialogElement || !headerElement || !scrollElement || !actionsElement) return null;
        const dialogRect = dialogElement.getBoundingClientRect();
        const headerRect = headerElement.getBoundingClientRect();
        const actionsRect = actionsElement.getBoundingClientRect();
        return {
          viewportHeight: window.innerHeight,
          bodyOverflow: document.body.style.overflow,
          dialogTop: dialogRect.top,
          dialogBottom: dialogRect.bottom,
          headerTop: headerRect.top,
          headerBottom: headerRect.bottom,
          actionsTop: actionsRect.top,
          actionsBottom: actionsRect.bottom,
          scrollable: scrollElement.scrollHeight > scrollElement.clientHeight + 1,
        };
      });
      expect(before).not.toBeNull();
      expect(before?.bodyOverflow).toBe("hidden");
      expect(before?.dialogTop ?? -1).toBeGreaterThanOrEqual(0);
      expect(before?.dialogBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(height + 1);
      expect(before?.headerTop ?? -1).toBeGreaterThanOrEqual((before?.dialogTop ?? 0) - 1);
      expect(before?.actionsBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((before?.dialogBottom ?? height) + 1);
      if (height === 640) expect(before?.scrollable).toBe(true);

      await scrollArea.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      if (before?.scrollable) {
        await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      }

      const after = await page.evaluate(() => {
        const dialogElement = document.querySelector<HTMLElement>('[data-component="product-modal"]');
        const headerElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-header"]');
        const actionsElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-actions"]');
        if (!dialogElement || !headerElement || !actionsElement) return null;
        const headerRect = headerElement.getBoundingClientRect();
        const actionsRect = actionsElement.getBoundingClientRect();
        return {
          headerTop: headerRect.top,
          headerBottom: headerRect.bottom,
          actionsTop: actionsRect.top,
          actionsBottom: actionsRect.bottom,
        };
      });
      expect(after).not.toBeNull();
      expect(Math.abs((after?.headerTop ?? 0) - (before?.headerTop ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((after?.headerBottom ?? 0) - (before?.headerBottom ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((after?.actionsTop ?? 0) - (before?.actionsTop ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((after?.actionsBottom ?? 0) - (before?.actionsBottom ?? 0))).toBeLessThanOrEqual(1);

      await assertVisualHealth(page, testInfo, `product-modal-scrolled-390x${height}`, {
        minTextLength: 16,
      });
    }

    expect(failures).toEqual([]);
  });

  test("product modal uses a centered two-column desktop layout", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "public-desktop", "The desktop project owns the two-column modal regression.");
    const failures = await collectPageFailures(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 950 });

    const response = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}?preview=1`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-menu-hydrated", "true");

    const menemenButton = page.getByRole("button", { name: /Menemen detayını aç/i }).first();
    const fallbackButton = page
      .locator('[data-component="card"]')
      .first()
      .getByRole("button", { name: /detayını aç/i });
    const openButton = (await menemenButton.count()) > 0 ? menemenButton : fallbackButton;
    await expect(openButton).toBeVisible();
    await openButton.click();

    const dialog = page.locator('[data-component="product-modal"]').last();
    const layout = dialog.locator('[data-component="product-modal-layout"]');
    const configuration = dialog.locator('[data-component="product-modal-configuration"]');
    const note = configuration.locator('[data-component="product-note"]');
    await expect(dialog).toBeVisible();
    await expect(layout).toHaveCSS("display", "grid");

    const geometry = await page.evaluate(() => {
      const dialogElement = document.querySelector<HTMLElement>('[data-component="product-modal"]');
      const summaryElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-summary"]');
      const configurationElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-configuration"]');
      const headerElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-header"]');
      const actionsElement = dialogElement?.querySelector<HTMLElement>('[data-component="product-modal-actions"]');
      if (!dialogElement || !summaryElement || !configurationElement || !headerElement || !actionsElement) return null;
      const dialogRect = dialogElement.getBoundingClientRect();
      const summaryRect = summaryElement.getBoundingClientRect();
      const configurationRect = configurationElement.getBoundingClientRect();
      const headerRect = headerElement.getBoundingClientRect();
      const actionsRect = actionsElement.getBoundingClientRect();
      return {
        dialog: {
          left: dialogRect.left,
          right: dialogRect.right,
          top: dialogRect.top,
          bottom: dialogRect.bottom,
          width: dialogRect.width,
        },
        summary: {
          left: summaryRect.left,
          right: summaryRect.right,
          width: summaryRect.width,
        },
        configuration: {
          left: configurationRect.left,
          right: configurationRect.right,
          width: configurationRect.width,
        },
        header: { top: headerRect.top, bottom: headerRect.bottom },
        actions: { top: actionsRect.top, bottom: actionsRect.bottom },
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry?.dialog.width ?? 0).toBeGreaterThanOrEqual(760);
    expect(geometry?.dialog.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(960);
    expect(Math.abs(((geometry?.dialog.left ?? 0) + (geometry?.dialog.right ?? 0)) / 2 - 720)).toBeLessThanOrEqual(1);
    expect(geometry?.dialog.top ?? -1).toBeGreaterThan(0);
    expect(geometry?.dialog.bottom ?? Number.POSITIVE_INFINITY).toBeLessThan(950);
    expect(geometry?.summary.right ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((geometry?.configuration.left ?? 0) + 1);
    expect(geometry?.summary.width ?? 0).toBeGreaterThanOrEqual(300);
    expect(geometry?.configuration.width ?? 0).toBeGreaterThan(geometry?.summary.width ?? Number.POSITIVE_INFINITY);
    expect(geometry?.header.bottom ?? 0).toBeLessThanOrEqual(geometry?.actions.top ?? Number.POSITIVE_INFINITY);
    expect(geometry?.actions.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((geometry?.dialog.bottom ?? 950) + 1);

    await configuration.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(note).toBeVisible();
    await expect(dialog.locator('[data-component="product-modal-header"]')).toBeVisible();
    await expect(dialog.locator('[data-component="product-modal-actions"]')).toBeVisible();
    await assertVisualHealth(page, testInfo, "product-modal-desktop-two-column", { minTextLength: 16 });
    expect(failures).toEqual([]);
  });

  test("public menu category strip keeps the active category reachable", async ({ page }) => {
    const response = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}?preview=1`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-menu-hydrated", "true");

    const nav = page.locator('[data-component="catnav"]');
    test.skip((await nav.count()) === 0, "Fixture uses the visual category grid instead of the horizontal strip");
    const categoryButtons = nav.locator("[data-cat]");
    expect(await categoryButtons.count()).toBeGreaterThan(1);
    for (const button of await categoryButtons.all()) {
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const lastCategory = categoryButtons.last();
    const categoryId = await lastCategory.getAttribute("data-cat");
    expect(categoryId).toBeTruthy();
    await lastCategory.click();
    await expect(lastCategory).toHaveAttribute("aria-current", "location");
    await expect
      .poll(async () =>
        page.evaluate((id) => {
          const section = document.getElementById(`section-${id}`);
          return Boolean(section && section.getBoundingClientRect().top < window.innerHeight);
        }, categoryId!),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        page.evaluate((id) => {
          const strip = document.querySelector<HTMLElement>('[data-component="catnav"]');
          const item = strip?.querySelector<HTMLElement>(`[data-cat="${CSS.escape(id)}"]`);
          if (!strip || !item) return false;
          const stripRect = strip.getBoundingClientRect();
          const itemRect = item.getBoundingClientRect();
          return itemRect.left >= stripRect.left - 1 && itemRect.right <= stripRect.right + 1;
        }, categoryId!),
      )
      .toBe(true);
  });

  test("public menu reflows at 200% desktop-equivalent zoom and reduced motion", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "public-desktop", "The desktop project owns the 200% reflow check.");
    await page.emulateMedia({ reducedMotion: "reduce" });
    // WCAG 200% zoom on a 1440px desktop leaves roughly a 720px CSS viewport.
    await page.setViewportSize({ width: 720, height: 900 });
    const response = await page.goto(`${menuURL}/${encodeURIComponent(menuSlug)}?preview=1`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-menu-hydrated", "true");
    await assertVisualHealth(page, testInfo, "menu-200-percent-reflow", {
      minTextLength: 16,
    });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  });

  test("kitchen fail-closed screen is visually healthy", async ({ page }, testInfo) => {
    const failures = await collectPageFailures(page);
    const response = await page.goto(`${kitchenURL}/kitchen/00000000-0000-0000-0000-000000000000`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/mutfak oturumu gerekli/i)).toBeVisible();
    await assertVisualHealth(page, testInfo, "kitchen-token-required", {
      minTextLength: 16,
      minVisibleCount: 3,
    });
    expect(failures).toEqual([]);
  });
});
