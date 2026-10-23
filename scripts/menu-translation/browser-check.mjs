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
  // Real settings switch, panel hook and English field, wired to the mock actions.
  const localize = (source) =>
    source
      .replace(/(['"])\.\.\/\.\.\/lib\/actions\/menu-translation\1/, "'./actions'")
      .replace(/(['"])\.\.\/\.\.\/lib\/menu-translation-errors\1/, "'@/lib/menu-translation-errors'")
      .replace(/(['"])\.\/menu-item-translation-model\1/, "'@/components/menu/menu-item-translation-model'")
      .replace(/(['"])\.\/use-menu-item-translation\1/, "'./Hook'")
      .replaceAll(/(['"])\.\.\/ui\//g, "$1@/components/ui/");
  for (const [target, source] of [
    ["Workspace.tsx", "components/settings/MenuLanguageSettings.tsx"],
    ["Hook.ts", "components/menu/use-menu-item-translation.ts"],
    ["EnglishField.tsx", "components/menu/MenuItemEnglishField.tsx"],
  ])
    await writeFile(resolve(qa, target), localize(await readFile(resolve(app, source), "utf8")));
  await writeFile(
    resolve(qa, "Panel.tsx"),
    await readFile(resolve(root, "scripts/menu-translation/qa-panel.fixture"), "utf8"),
  );
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
    // Settings → Diller: a failed read says so instead of showing an empty switch.
    await page.goto("http://127.0.0.1:3026/menu-translation-qa");
    await page
      .getByText("İşlem tamamlanamadı. Düzenlemeleriniz korunuyor; yeniden deneyin.", { exact: true })
      .waitFor();
    // Product panel: one button drafts the English, Kaydet publishes it.
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=panel");
    await page.getByRole("button", { name: "İngilizceye çevir", exact: true }).click();
    await page.getByRole("button", { name: "Çevriliyor…", exact: true }).waitFor();
    const english = page.getByLabel("İngilizce ad", { exact: true });
    await page.waitForFunction(() => document.querySelector("#qa-name-en")?.value === "Meat dumplings 1");
    assert.ok(await page.getByText("Taslak", { exact: true }).isVisible(), "Fresh AI text is a draft until Kaydet");
    await english.fill("Meat dumplings 1");
    await page.screenshot({ path: resolve(output, `panel-draft-${width}.png`) });
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await page.getByText("Kaydedildi", { exact: true }).waitFor();
    await page.getByText("Yayında", { exact: true }).waitFor();
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Panel horizontal overflow",
    );
    // A failed AI job says so and keeps the field editable.
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=panel-failure");
    await page.getByRole("button", { name: "İngilizceye çevir", exact: true }).click();
    await page.getByText("Çeviri hazırlanamadı. Metni elle yazabilir ya da yeniden deneyebilirsin.", { exact: true }).waitFor();
    assert.ok(await page.getByLabel("İngilizce ad", { exact: true }).isEditable());
    // Settings: English stays closed while texts are missing...
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=flow");
    const toggle = page.getByRole("switch", { name: "İngilizce menü", exact: true });
    await toggle.waitFor();
    assert.ok(await toggle.isDisabled(), "English cannot open with missing translations");
    assert.ok(await page.getByText("Çevrilecek:", { exact: false }).isVisible());
    // ...and opens once every text is published.
    await page.goto("http://127.0.0.1:3026/menu-translation-qa?view=ready");
    await page.getByRole("switch", { name: "İngilizce menü", exact: true }).click();
    await page.getByText("Açık. Misafirler QR menüde Türkçe ve İngilizce arasında seçim yapabilir.", { exact: true }).waitFor();
    await page.screenshot({ path: resolve(output, `settings-enabled-${width}.png`) });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Settings horizontal overflow",
    );
    checks.push({
      settingsReadFailureVisible: true,
      panelOneButtonDraftThenPublish: true,
      panelFailureVisible: true,
      englishGatedUntilComplete: true,
      deviceLanguage: true,
      savedLanguage: true,
      width,
      menu: true,
      englishProduct: true,
      turkishCart: true,
      noEnglishInStorage: true,
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
