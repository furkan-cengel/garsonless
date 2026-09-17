import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "/private/tmp/masabu-inventory-ux";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  const page = await browser.newPage({
    storageState: "test-results/visual-auth/dashboard-storage-state.json",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await page.goto(
    "http://localhost:3000/dashboard/e0b1faf4-03d6-4171-8044-4fb8ca9dafe6/inventory",
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  const region = page.getByRole("region", {
    name: "Stok çalışma alanı",
    exact: true,
  });
  await page
    .getByRole("heading", { name: "Stok", exact: true })
    .waitFor({ timeout: 60000 });
  assert.equal(await page.getByRole("main").count(), 1, "single main landmark");
  assert.equal(
    await page
      .getByRole("button", { name: "Stoklar güncel, takibi başlat" })
      .count(),
    0,
    "empty inventory should lead with stock entry",
  );
  await page.screenshot({
    path: dir + "/01-after-overview.png",
    animations: "disabled",
  });
  checks.push(
    "Empty overview prioritizes stock/CSV entry; no disabled start banner",
  );
  await page.getByRole("tablist").ariaSnapshot();
  await page.getByRole("tab", { name: "İşlemler", exact: true }).click();
  const add = page.getByRole("button", {
    name: "Stok satırı ekle",
    exact: true,
  });
  const primary = page.getByRole("button", {
    name: "Stok etkisini incele",
    exact: true,
  });
  for (const button of [add, primary])
    assert.ok(
      (await button.boundingBox()).width < 320,
      "desktop action must fit its label",
    );
  await page.screenshot({
    path: dir + "/02-after-operations.png",
    animations: "disabled",
  });
  // Unsaved lines exercise overflow without writing to the restaurant database.
  for (let n = 0; n < 7; n++) {
    await add.ariaSnapshot();
    await add.click();
  }
  await region.evaluate((el) => (el.scrollTop = 0));
  await page.mouse.move(1000, 650);
  await page.mouse.wheel(0, 1600);
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Stok çalışma alanı"]').scrollTop > 0,
  );
  const wheelScroll = await region.evaluate((el) => el.scrollTop);
  await region.focus();
  await page.keyboard.press("Home");
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Stok çalışma alanı"]').scrollTop ===
      0,
  );
  await page.keyboard.press("End");
  await page.waitForFunction(() => {
    const e = document.querySelector('[aria-label="Stok çalışma alanı"]');
    return e.scrollTop >= e.scrollHeight - e.clientHeight - 2;
  });
  await page.screenshot({
    path: dir + "/02-after-scroll-bottom.png",
    animations: "disabled",
  });
  const keyboardScroll = await region.evaluate((el) => el.scrollTop);
  checks.push(
    "1440px: wheel, Home/End and bottom action access on a long form",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.mouse.move(260, 500);
  await page.mouse.wheel(0, 1200);
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Stok çalışma alanı"]').scrollTop > 0,
  );
  await region.focus();
  await page.keyboard.press("Home");
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Stok çalışma alanı"]').scrollTop ===
      0,
  );
  await page.getByRole("tablist").ariaSnapshot();
  await page.getByRole("tab", { name: "Genel bakış", exact: true }).click();
  await page.screenshot({
    path: dir + "/03-after-mobile-overview.png",
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "no mobile page overflow",
  );
  await page
    .getByRole("button", { name: "Stok ekle", exact: true })
    .ariaSnapshot();
  await page.getByRole("button", { name: "Stok ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.screenshot({
    path: dir + "/03-after-mobile-form.png",
    animations: "disabled",
  });
  const save = dialog.getByRole("button", {
    name: "Stok kartını kaydet",
    exact: true,
  });
  await save.scrollIntoViewIfNeeded();
  assert.ok(
    await dialog.evaluate((el) => el.scrollTop > 0),
    "mobile modal scrolls to save action",
  );
  const box = await save.boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= 844);
  await page.screenshot({
    path: dir + "/03-after-mobile-form-bottom.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  checks.push(
    "390px: page and dialog scrolling, reachable save action, Escape, no horizontal page overflow",
  );
  await writeFile(
    dir + "/after.json",
    JSON.stringify(
      { ok: true, checks, wheelScroll, keyboardScroll, stockWrites: false },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ ok: true, checks, wheelScroll, keyboardScroll }),
  );
} finally {
  await browser.close();
}
