import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const root = process.cwd(),
  app = resolve(root, "apps/dashboard"),
  qa = resolve(app, "app/media-library-qa"),
  out = "/tmp/masabu-media-library-qa";
assert.equal(
  await access(qa).then(
    () => true,
    () => false,
  ),
  false,
);
assert.equal(
  await fetch("http://127.0.0.1:3027").then(
    () => true,
    () => false,
  ),
  false,
  "QA port must be free",
);
const backups = await Promise.all(
  ["tsconfig.json", "next-env.d.ts"].map(async (f) => [
    f,
    await readFile(resolve(app, f)),
  ]),
);
let server,
  browser,
  logs = "",
  page;
try {
  await mkdir(qa);
  await mkdir(out, { recursive: true });
  await writeFile(
    resolve(qa, "page.tsx"),
    await readFile(resolve(root, "scripts/media-library/qa-page.fixture")),
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3027",
    ],
    {
      cwd: app,
      env: { ...process.env, NEXT_DIST_DIR: ".next-media-qa" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (x) => (logs += x));
  server.stderr.on("data", (x) => (logs += x));
  for (let n = 0; n < 120; n++) {
    if (
      await fetch("http://127.0.0.1:3027/media-library-qa").then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    if (n === 119) throw Error(logs);
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({ headless: true });
  const checks = [],
    errors = [],
    diagnostics = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (["error", "warning"].includes(m.type())) diagnostics.push(m.text());
    });
    const assets = Array.from({ length: 43 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      name:
        i === 0
          ? "Uzun adlı restoran logo görseli ve açıklaması.webp"
          : `Menü görseli ${i + 1}.webp`,
      alt: "",
      mime: "image/webp",
      bytes: 180000,
      width: 512,
      height: 512,
      url:
        i === 1
          ? "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320"><rect width="180" height="320" fill="#e4eee9"/><text x="20" y="160">Dikey görsel</text></svg>',
            )
          : "/brand/masabu-logo-transparent-512px.png",
      logoUrl: "/brand/masabu-logo-transparent-512px.png",
      menuUrl: "/brand/masabu-logo-transparent-512px.png",
      createdAt: "2026-09-21T10:00:00Z",
      version: 1,
      status: "ready",
      uses: i === 0 ? [{ table: "menu_items", id: "1", label: "Mantı" }] : [],
    }));
    // Serve a real repository image for every fixture preview.
    const image = await readFile(
      resolve(root, "assets/brand/masabu-logo-transparent-512px.png"),
    );
    await page.route("**/brand/masabu-logo-transparent-512px.png", (r) =>
      r.fulfill({ contentType: "image/png", body: image }),
    );
    let selectionFails = false,
      uploaded = false;
    await page.route("**/api/media-library", async (route) => {
      const { mode, payload } = route.request().postDataJSON();
      let data;
      if (mode === "list") {
        const filtered = assets.filter(
          (a) =>
            a.name
              .toLowerCase()
              .includes((payload.search ?? "").toLowerCase()) &&
            (payload.usage !== "used" || a.uses.length) &&
            (payload.usage !== "unused" || !a.uses.length),
        );
        data = {
          assets: filtered.slice(
            (payload.page ?? 0) * 40,
            ((payload.page ?? 0) + 1) * 40,
          ),
          total: filtered.length,
          used: 8000000,
          reserved: 0,
          limit: 250000000,
          initialized: true,
          canManage: true,
        };
      }
      if (mode === "resolve") {
        if (selectionFails)
          return route.fulfill({
            status: 400,
            json: {
              ok: false,
              error:
                "İşlem tamamlanamadı. Seçiminiz korunuyor; yeniden deneyin.",
            },
          });
        data = {
          asset: assets.find((a) => a.id === payload.id),
          url: assets[0].url,
          width: 512,
          height: 512,
          mime: "image/webp",
        };
      }
      if (mode === "metadata") {
        const a = assets.find((a) => a.id === payload.id);
        Object.assign(a, {
          name: payload.name,
          alt: payload.alt,
          version: a.version + 1,
        });
        data = a;
      }
      if (mode === "delete") {
        assets.splice(
          assets.findIndex((a) => a.id === payload.id),
          1,
        );
        data = {};
      }
      if (mode === "prepare") {
        data = {
          id: payload.id,
          signedUrl: `https://yxsegwkzyiscrxiwdeuf.supabase.co/storage/v1/object/upload/sign/restaurant-media-staging/library/test/${payload.id}/source?token=qa`,
        };
      }
      if (mode === "complete") {
        await new Promise((r) => setTimeout(r, 500));
        if (!uploaded) {
          assets.unshift({
            ...assets[1],
            id: payload.id,
            name: "Yeni logo.png",
            uses: [],
          });
          uploaded = true;
        }
        data = { asset: assets[0] };
      }
      return route.fulfill({ json: { ok: true, data } });
    });
    await page.route(
      "**/storage/v1/object/upload/sign/restaurant-media-staging/library/**",
      async (r) => {
        await new Promise((x) => setTimeout(x, 200));
        return r.fulfill({ status: 200, json: {} });
      },
    );
    await page.goto("http://127.0.0.1:3027/media-library-qa");
    await page.getByRole("button", { name: /Uzun adlı/ }).waitFor();
    await page.screenshot({ path: resolve(out, `library-${width}.png`) });
    const gallery = page.locator("[data-media-view]");
    const scrollPage = page.getByRole("main", { name: "Dosyalar sayfası" });
    await expect(gallery).toHaveAttribute("data-media-view", "small");
    const firstCard = gallery.getByRole("button").first();
    const smallWidth = (await firstCard.boundingBox()).width;
    const portrait = await gallery
      .getByRole("button")
      .nth(1)
      .locator("img")
      .locator("..")
      .boundingBox();
    assert.ok(
      Math.abs(portrait.height - portrait.width * 0.75) < 2,
      "portrait must not stretch the preview",
    );
    await firstCard.hover();
    const before = await scrollPage.evaluate((el) => el.scrollTop);
    await page.mouse.wheel(0, 450);
    await expect
      .poll(() => scrollPage.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(before);
    await scrollPage.evaluate((el) => (el.scrollTop = 0));
    await page
      .getByRole("button", { name: "Büyük kartlar", exact: true })
      .click();
    await expect(gallery).toHaveAttribute("data-media-view", "large");
    assert.ok((await firstCard.boundingBox()).width > smallWidth);
    await page.screenshot({ path: resolve(out, `large-${width}.png`) });
    await page
      .getByRole("button", { name: "Liste görünümü", exact: true })
      .click();
    await expect(gallery).toHaveAttribute("data-media-view", "list");
    assert.ok((await firstCard.boundingBox()).height < 125);
    await page.screenshot({ path: resolve(out, `list-${width}.png`) });
    await page.reload();
    await expect(gallery).toHaveAttribute("data-media-view", "list");
    await page.getByRole("combobox", { name: "Tür", exact: true }).click();
    await page.getByRole("option", { name: "Görseller", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "Tür", exact: true }),
    ).toContainText("Görseller");
    await page.getByRole("combobox", { name: "Sırala", exact: true }).click();
    await page.getByRole("option", { name: "En büyük", exact: true }).click();
    await page.getByRole("combobox", { name: "Kullanım", exact: true }).click();
    await page.getByRole("option", { name: "Kullanımda", exact: true }).click();
    await page.getByRole("combobox", { name: "Kullanım", exact: true }).click();
    await page.getByRole("option", { name: "Tümü", exact: true }).click();
    await page
      .getByRole("button", { name: "Küçük kartlar", exact: true })
      .click();

    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.getByRole("button", { name: /Uzun adlı/ }).click();
    await expect(
      page.getByRole("button", { name: "Sil", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Ürün görseli seç", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Görsel seç",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Menü görseli 2.webp/ }).click();
    selectionFails = true;
    await dialog
      .getByRole("button", { name: "Seçimi kullan", exact: true })
      .click();
    await dialog
      .getByText("İşlem tamamlanamadı. Seçiminiz korunuyor; yeniden deneyin.")
      .waitFor();
    await expect(
      dialog.getByRole("button", { name: /Menü görseli 2.webp/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: resolve(out, `picker-${width}.png`) });
    selectionFails = false;
    await dialog
      .getByRole("button", { name: "Seçimi kullan", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Ürün adı")).toHaveValue("Kaydedilmemiş ürün");
    await page.getByRole("tab", { name: "Yeni yükle", exact: true }).click();
    await page.getByLabel("Yeni dosyalar", { exact: true }).setInputFiles({
      name: "Yeni logo.png",
      mimeType: "image/png",
      buffer: image,
    });
    await page.getByText("Kullanıma hazır", { exact: true }).waitFor();
    await page.screenshot({ path: resolve(out, `upload-${width}.png`) });
    await page.getByLabel("Yeni dosyalar", { exact: true }).setInputFiles([
      { name: "Batch one.png", mimeType: "image/png", buffer: image },
      { name: "Queued cancel.png", mimeType: "image/png", buffer: image },
    ]);
    const queued = page.getByText("Sırada", { exact: true });
    await queued.waitFor();
    await queued
      .locator("..")
      .locator("..")
      .getByRole("button", { name: "Durdur", exact: true })
      .click();
    await page.getByText("Yükleme durduruldu.", { exact: true }).waitFor();
    await expect(
      page.getByText("Kullanıma hazır", { exact: true }),
    ).toHaveCount(2);
    await page.getByRole("tab", { name: "Dosyalarım", exact: true }).click();
    await page.getByLabel("Dosya ara", { exact: true }).fill("Yeni logo");
    await page.getByRole("button", { name: /Yeni logo.png/ }).waitFor();
    await page.getByRole("button", { name: /Yeni logo.png/ }).click();
    await page.getByLabel("Dosya adı", { exact: true }).fill("İşletme logosu");
    await page
      .getByRole("button", { name: "Bilgileri kaydet", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Dosya ayrıntısı" }),
    ).toBeHidden();
    await page.getByLabel("Dosya ara", { exact: true }).fill("İşletme logosu");
    await page.getByRole("button", { name: /İşletme logosu/ }).click();
    await page.getByRole("button", { name: "Sil", exact: true }).click();
    await page
      .getByRole("button", { name: "Kalıcı olarak sil", exact: true })
      .click();
    await page
      .getByText(
        "Silme isteği alındı. Temizlik tamamlanınca alanınız açılacak.",
      )
      .waitFor();
    checks.push({
      width,
      list: true,
      picker: true,
      failedSelectionPreserved: true,
      formPreserved: true,
      upload: true,
      rename: true,
      usedDeleteBlocked: true,
      unusedDelete: true,
      noOverflow: true,
      queuedCancellation: true,
      scrollOverImages: true,
      viewSizes: true,
      persistedView: true,
      shadcnFilters: true,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(
    diagnostics.filter(
      (message) => !message.includes("server responded with a status of 400"),
    ),
    [],
  );
  await writeFile(
    resolve(out, "result.json"),
    JSON.stringify({ checks, errors, diagnostics }, null, 2),
  );
  console.log(JSON.stringify({ checks, out }));
} catch (e) {
  if (page && !page.isClosed()) {
    await page.screenshot({
      path: resolve(out, "failure.png"),
      fullPage: true,
    });
    await writeFile(
      resolve(out, "failure.txt"),
      await page.locator("body").innerText(),
    );
  }
  await writeFile(resolve(out, "server.log"), logs);
  throw e;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await rm(qa, { recursive: true, force: true });
  for (const [f, b] of backups) await writeFile(resolve(app, f), b);
  await rm(resolve(app, ".next-media-qa"), { recursive: true, force: true });
}
