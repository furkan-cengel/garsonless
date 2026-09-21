import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  app = resolve(root, "apps/dashboard"),
  qa = resolve(app, "app/menu-translation-qa");
assert.equal(
  await access(qa).then(
    () => true,
    () => false,
  ),
  false,
  "Temporary QA route already exists",
);
const backups = await Promise.all(
  ["tsconfig.json", "next-env.d.ts"].map(async (n) => [
    n,
    await readFile(resolve(app, n)),
  ]),
);
const output = "/private/tmp/masabu-menu-translation-browser";
await mkdir(output, { recursive: true });
assert.equal(
  await fetch("http://127.0.0.1:3026").then(
    () => true,
    () => false,
  ),
  false,
  "QA port must be free",
);
let server,
  browser,
  lastPage,
  logs = "";
try {
  await mkdir(qa);
  const workspace = (
    await readFile(
      resolve(app, "components/menu-translations/MenuTranslations.tsx"),
      "utf8",
    )
  )
    .replace(
      /(['"])\.\.\/\.\.\/lib\/actions\/menu-translation\1/,
      "'./actions'",
    )
    .replaceAll(/(['"])\.\.\/ui\//g, "$1@/components/ui/");
  await writeFile(resolve(qa, "Workspace.tsx"), workspace);
  await writeFile(
    resolve(qa, "actions.ts"),
    await readFile(
      resolve(root, "scripts/menu-translation/qa-actions.fixture"),
      "utf8",
    ),
  );
  await writeFile(
    resolve(qa, "page.tsx"),
    await readFile(
      resolve(root, "scripts/menu-translation/qa-page.fixture"),
      "utf8",
    ),
  );
  await writeFile(
    resolve(qa, "Menu.tsx"),
    (
      await readFile(
        resolve(root, "scripts/menu-translation/qa-menu.fixture"),
        "utf8",
      )
    ).replace(
      "__MENU_CLIENT__",
      resolve(root, "apps/menu/app/[slug]/MenuPageClient"),
    ),
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3026",
    ],
    {
      cwd: app,
      env: {
        ...process.env,
        NEXT_DIST_DIR: ".next-translation-browser",
        MENU_WEB_VITALS_SAMPLE_RATE: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (d) => (logs += d));
  server.stderr.on("data", (d) => (logs += d));
  for (let n = 0; n < 100; n++) {
    if (
      await fetch("http://127.0.0.1:3026/menu-translation-qa").then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    if (server.exitCode !== null || n === 99) throw Error(logs);
    await delay(500);
  }
  browser = await chromium.launch({ headless: true });
  const checks = [],
    errors = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();
    lastPage = page;
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=menu");
    await page
      .getByRole("group", { name: "Menü dili / Menu language", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("radio", { name: "English", exact: true })
        .isChecked(),
      true,
      "English device starts in English",
    );
    await page.getByRole("radio", { name: "English", exact: true }).check();
    await page
      .getByRole("button", { name: "View Meat dumplings 1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add to cart", exact: true })
      .waitFor();
    assert.ok(await page.getByText("Ingredients", { exact: true }).isVisible());
    await page
      .getByRole("button", { name: "Add to cart", exact: true })
      .click();
    // Adding a configured product opens the cart automatically.

    await page.getByText("Sepetiniz", { exact: true }).waitFor();
    assert.ok(
      await page.getByText("Etli mantı 1", { exact: true }).isVisible(),
      "Cart must keep Turkish product names",
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(output, `cart-${width}.png`) });
    const stored = await page.evaluate(() =>
      Object.values(localStorage).join("\n"),
    );
    assert.ok(
      !stored.includes("Meat dumplings"),
      "English must not enter persisted cart",
    );
    await page.keyboard.press("Escape");
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=menu");
    await page.getByRole("radio", { name: "English", exact: true }).check();
    await page
      .getByRole("button", { name: "View Meat dumplings 1", exact: true })
      .waitFor();
    const savedCart = await page.evaluate(() =>
      Object.values(localStorage).join("\n"),
    );
    await page.getByRole("radio", { name: "Türkçe", exact: true }).check();
    await page
      .getByRole("button", { name: "Etli mantı 1 detayını aç", exact: true })
      .waitFor();
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=menu");
    assert.equal(
      await page
        .getByRole("radio", { name: "Türkçe", exact: true })
        .isChecked(),
      true,
      "Explicit selection survives a return to menu",
    );
    const languageControl = page.getByRole("radio", {
      name: "Türkçe",
      exact: true,
    });
    await expect(languageControl).toBeEnabled();
    await languageControl.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("radio", { name: "English", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "View Meat dumplings 1", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => Object.values(localStorage).join("\n")),
      savedCart,
      "Language switch must preserve cart",
    );
    await page.screenshot({
      path: resolve(output, `menu-${width}.png`),
      fullPage: false,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Menu horizontal overflow",
    );
    await page.goto("http://127.0.0.1:3026/menu-translation-qa");
    await page.screenshot({
      path: resolve(output, `management-clean-${width}.png`),
    });
    const field = page.getByLabel("İngilizce taslak", { exact: true }).first();
    await field.fill("My unsaved translation");
    await page
      .getByRole("button", { name: "Taslağı kaydet", exact: true })
      .first()
      .click();
    await page
      .getByText(
        "İşlem tamamlanamadı. Düzenlemeleriniz korunuyor; yeniden deneyin.",
        { exact: true },
      )
      .waitFor();
    assert.equal(await field.inputValue(), "My unsaved translation");
    await page
      .getByRole("heading", { name: "Menü çevirileri", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(output, `management-top-${width}.png`),
    });
    await page.getByText("Terim tercihleri", { exact: false }).first().click();
    await page
      .getByRole("button", { name: "Terim tercihlerini kaydet", exact: true })
      .scrollIntoViewIfNeeded();
    assert.ok(
      await page
        .getByRole("button", { name: "Terim tercihlerini kaydet", exact: true })
        .isVisible(),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Dashboard horizontal overflow",
    );
    await page.screenshot({
      path: resolve(output, `management-${width}.png`),
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=flow");
    await page
      .getByRole("button", { name: "AI ile çevirileri hazırla", exact: true })
      .click();
    await page
      .getByRole("button", { name: "İstek gönderiliyor…", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Çeviri isteğiniz sırada", exact: true })
      .waitFor();
    await page.screenshot({ path: resolve(output, `queued-${width}.png`) });
    await page
      .getByRole("heading", { name: "AI çevirileri hazırlıyor", exact: true })
      .waitFor();
    await page.screenshot({ path: resolve(output, `running-${width}.png`) });
    await page
      .getByLabel("İngilizce taslak", { exact: true })
      .fill("My reviewed dish 1");
    await page
      .getByRole("heading", {
        name: "3 çeviri incelemenizi bekliyor",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Çevirileri incele", exact: true })
      .click();
    const editor = page.getByLabel("İngilizce taslak", { exact: true });
    assert.equal(
      await editor.inputValue(),
      "My reviewed dish 1",
      "Polling must preserve an unsaved edit",
    );
    await page
      .getByRole("button", { name: "Taslağı kaydet", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Onayla ve devam et", exact: true })
      .waitFor();
    await editor.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `review-${width}.png`) });
    for (let i = 0; i < 3; i++) {
      await page
        .getByRole("button", { name: "Onayla ve devam et", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Onaylanıyor…", exact: true })
        .first()
        .waitFor({ state: "hidden" });
    }
    await page
      .getByRole("heading", { name: "Menünüz İngilizceye hazır", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "İngilizce menüyü aç", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "İngilizce menünüz yayında", exact: true })
      .waitFor();
    await page.screenshot({ path: resolve(output, `enabled-${width}.png`) });
    assert.ok(
      await page.getByText("İngilizce menü açık", { exact: true }).isVisible(),
    );
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=failure");
    await page
      .getByRole("button", { name: "AI ile çevirileri hazırla", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "AI çevirileri hazırlıyor", exact: true })
      .waitFor();
    await page
      .getByLabel("İngilizce taslak", { exact: true })
      .fill("Keep my translation after failure");
    await page
      .getByText(
        "Bazı çeviriler hazırlanamadı. Mevcut taslaklarınız ve düzenlemeleriniz korunuyor. Yeniden deneyebilir veya metni elle düzenleyebilirsiniz.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page.getByLabel("İngilizce taslak", { exact: true }).inputValue(),
      "Keep my translation after failure",
    );
    await page.screenshot({
      path: resolve(output, `job-failure-${width}.png`),
    });
    checks.push({
      failedJobVisibleAndDraftPreserved: true,
      queuedRunningReviewPublishEnable: true,
      pollingPreservesDraft: true,
      deviceLanguage: true,
      savedLanguage: true,
      width,
      menu: true,
      englishProduct: true,
      turkishCart: true,
      noEnglishInStorage: true,
      draftPreserved: true,
      scroll: true,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "result.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, output }, null, 2));
} catch (e) {
  if (lastPage && !lastPage.isClosed()) {
    await lastPage.screenshot({
      path: resolve(output, "failure.png"),
      fullPage: true,
    });
    await writeFile(
      resolve(output, "failure.txt"),
      await lastPage.locator("body").innerText(),
    );
  }
  await writeFile(resolve(output, "server.log"), logs);
  throw e;
} finally {
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await rm(qa, { recursive: true, force: true });
  for (const [n, data] of backups) await writeFile(resolve(app, n), data);
  await rm(resolve(app, ".next-translation-browser"), {
    recursive: true,
    force: true,
  });
}
