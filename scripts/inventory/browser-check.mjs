import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = resolve(root, "apps/dashboard");
const component = resolve(app, "components/inventory/InventoryWorkspace.tsx");
const qa = resolve(app, "app/inventory-qa");
await access("/private/tmp/masabu-inventory-fixture.json");
assert.equal(
  await access(qa).then(
    () => true,
    () => false,
  ),
  false,
  "QA route must not already exist",
);
const original = await readFile(component, "utf8");
const tsconfigPath = resolve(app, "tsconfig.json");
const tsconfig = await readFile(tsconfigPath, "utf8");
const nextEnvPath = resolve(app, "next-env.d.ts");
const nextEnv = await readFile(nextEnvPath, "utf8");
assert.ok(original.includes("@/lib/actions/inventory"));
assert.equal(
  await fetch("http://127.0.0.1:3024").then(
    () => true,
    () => false,
  ),
  false,
  "Port 3024 must be free",
);
let server, browser, page;
let output = "";
const errors = [];
try {
  await mkdir(qa);
  await writeFile(
    resolve(qa, "page.tsx"),
    await readFile(resolve(root, "scripts/inventory/qa-page.fixture")),
  );
  await writeFile(
    resolve(qa, "actions.ts"),
    (
      await readFile(
        resolve(root, "scripts/inventory/qa-actions.fixture"),
        "utf8",
      )
    ).replace(
      "'__INVENTORY_DB_PACKAGE__'",
      JSON.stringify(resolve(root, "packages/db/package.json")),
    ),
  );
  await writeFile(
    component,
    original.replace("@/lib/actions/inventory", "@/app/inventory-qa/actions"),
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3024",
    ],
    {
      cwd: app,
      env: { ...process.env, NEXT_DIST_DIR: ".next-inventory-browser" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (d) => (output += d));
  server.stderr.on("data", (d) => (output += d));
  for (let n = 0; n < 90; n++) {
    if (
      await fetch("http://127.0.0.1:3024/inventory-qa").then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    if (server.exitCode !== null) throw new Error(output);
    if (n === 89) throw new Error("Local server did not start: " + output);
    await delay(500);
  }

  const dir = "/private/tmp/masabu-inventory-browser";
  await mkdir(dir, { recursive: true });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3024/inventory-qa", {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Stok", exact: true }).waitFor();
  await page.screenshot({
    path: dir + "/desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: "Stoklar", exact: true }).click();
  await page.getByRole("button", { name: "Stok ekle", exact: true }).click();
  await page.getByLabel("Stok adı", { exact: true }).fill("Tarayıcı kahvesi");
  await page.getByLabel("Açılış miktarı (g)", { exact: true }).fill("1000");
  await page
    .getByLabel("Birim maliyet (TL / g, bilinmiyorsa boş)", { exact: true })
    .fill("0,5");
  await page
    .getByRole("button", { name: "Stok kartını kaydet", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("cell", { name: "Tarayıcı kahvesi", exact: false })
    .waitFor();
  await page.getByRole("tab", { name: "İşlemler", exact: true }).click();
  await page
    .getByLabel("Stok", { exact: true })
    .selectOption({ label: "Tarayıcı kahvesi" });
  await page.getByLabel("Miktar", { exact: true }).fill("1");
  await page.getByLabel("Giriş birimi", { exact: true }).selectOption("kg");
  await page.getByLabel("Maliyet (TL / g)", { exact: true }).fill("0,6");
  await page.getByRole("button", { name: "Stok etkisini incele" }).click();
  await page.screenshot({
    path: dir + "/receipt-preview.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "İşlemi kesinleştir" }).click();
  await page.getByRole("button", { name: "Stok etkisini incele" }).waitFor();
  await page.getByRole("tab", { name: "Sayım", exact: true }).click();
  await page.getByRole("button", { name: "Görünen stokları seç" }).click();
  const item = page
    .locator("div.rounded-lg.border.p-3")
    .filter({ has: page.getByText("Tarayıcı kahvesi", { exact: true }) });
  await item.getByRole("textbox").fill("1900");
  await page
    .getByRole("button", { name: "Taslağı kaydet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kaydedilmiş sayımı onayla" })
    .waitFor();
  await page.getByRole("button", { name: "Kaydedilmiş sayımı onayla" }).click();
  await page
    .getByRole("button", { name: "Kaydedilmiş sayımı onayla" })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("tab", { name: "Hareketler ve raporlar", exact: true })
    .click();
  await page.screenshot({
    path: dir + "/history.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Stoklar", exact: true }).click();
  await page.screenshot({
    path: dir + "/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "page must not overflow mobile viewport",
  );
  await page.getByRole("button", { name: "Stok ekle", exact: true }).click();
  await page.screenshot({
    path: dir + "/mobile-editor.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("Stok adı", { exact: true })
    .fill("Hatalı miktar taslağı");
  await page.getByLabel("Açılış miktarı (g)", { exact: true }).fill("hata");
  await page.getByRole("button", { name: "Stok kartını kaydet" }).click();
  await page
    .getByRole("dialog")
    .getByText("Alanları ve miktarları kontrol edin.")
    .waitFor();
  assert.equal(
    await page.getByLabel("Stok adı", { exact: true }).inputValue(),
    "Hatalı miktar taslağı",
  );
  // Server/network failure must retain the draft and never show success.
  await page.getByLabel("Stok adı", { exact: true }).fill("Ağ hatası taslağı");
  await page.getByLabel("Açılış miktarı (g)", { exact: true }).fill("1");
  await page.route("**/inventory-qa", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Stok kartını kaydet" }).click();
  await page
    .getByRole("dialog")
    .getByText("İşlem tamamlanamadı. Taslağınız korunuyor; yeniden deneyin.")
    .waitFor();
  assert.equal(
    await page.getByLabel("Stok adı", { exact: true }).inputValue(),
    "Ağ hatası taslağı",
  );
  await page.screenshot({
    path: dir + "/mobile-error.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.unroute("**/inventory-qa");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "CSV ile stok ekle" }).click();
  const csvHeader = "name,kind,unit,quantity,cost,threshold,category,shelf\n";
  await page
    .getByLabel("CSV içeriği")
    .fill(csvHeader + "CSV tuz,raw,g,hata,0.1,10,Mutfak,Raf 1");
  await page.getByRole("button", { name: "Satırları kontrol et" }).click();
  await page
    .getByRole("dialog")
    .getByText("2. satır: adı, türü, birimi veya miktarı kontrol edin.")
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Önizlemeyi içe aktar" }).count(),
    0,
  );
  await page
    .getByLabel("CSV içeriği")
    .fill(csvHeader + "CSV tuz,raw,g,500,0.1,10,Mutfak,Raf 1");
  await page.getByRole("button", { name: "Satırları kontrol et" }).click();
  await page.getByRole("button", { name: "Önizlemeyi içe aktar" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("cell", { name: "CSV tuz", exact: false }).waitFor();
  await page.getByRole("tab", { name: "Hareketler ve raporlar" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tüm hareketleri CSV indir" }).click();
  const downloaded = await downloadEvent;
  await downloaded.saveAs(dir + "/movements.csv");
  assert.ok(
    (await readFile(dir + "/movements.csv", "utf8")).includes("CSV tuz"),
  );
  await page.getByRole("tab", { name: "Genel bakış" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .getByRole("tab", { name: "Stoklar", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "/result.json",
    JSON.stringify(
      {
        ok: true,
        viewports: [1440, 390],
        checks: [
          "stock creation",
          "unit conversion preview and receipt",
          "count save/approve",
          "history",
          "mobile overflow",
          "validation preserves draft",
          "network failure preserves draft",
          "CSV validation/import/export",
          "keyboard tabs and escape",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("BROWSER_OK");
} catch (e) {
  console.error(output);
  if (page)
    console.error(
      await page
        .locator("body")
        .innerText()
        .catch(() => ""),
    );
  throw e;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await writeFile(component, original);
  await rm(qa, { recursive: true, force: true });
  await writeFile(tsconfigPath, tsconfig);
  await writeFile(nextEnvPath, nextEnv);
  await rm(resolve(app, ".next-inventory-browser"), {
    recursive: true,
    force: true,
  });
}
