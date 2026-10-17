import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMediaUseSummary,
  mediaDisplayName,
  mediaStorageLimit,
  mediaUploadError,
  mediaUrlFor,
  type MediaAsset,
} from "./media-library";
test("storage allowances include trial and legacy plans", () => {
  assert.equal(mediaStorageLimit("pro", true), 1e9);
  assert.equal(mediaStorageLimit("pro"), 5e9);
  assert.equal(mediaStorageLimit("free"), 250e6);
  assert.equal(mediaStorageLimit("enterprise"), 10e9);
});
test("file boundary rejects zero, unsafe, oversized and executable content declarations", () => {
  for (const size of [0, -1, NaN, 9 * 1024 * 1024])
    assert.ok(mediaUploadError(size, "image/png"));
  assert.ok(mediaUploadError(10, "image/svg+xml"));
  assert.equal(mediaUploadError(10, "image/avif"), null);
});
test("picker never returns a video in a logo slot or a deleting object", () => {
  const a = {
    status: "ready",
    mime: "image/webp",
    url: "image",
    logoUrl: "logo",
    menuUrl: "menu",
  } as MediaAsset;
  assert.equal(mediaUrlFor(a, "logo"), "logo");
  assert.equal(mediaUrlFor(a, "video"), null);
  assert.equal(mediaUrlFor({ ...a, status: "deleting" }, "image"), null);
});

test("usage summary separates live places from theme history versions", () => {
  const use = (table: string) => ({ table, id: table, label: "Tema" });
  assert.equal(formatMediaUseSummary([]), "Henüz kullanılmıyor");
  assert.equal(formatMediaUseSummary([use("theme_configs"), use("theme_config_history"), use("theme_config_history")]), "1 yerde kullanılıyor · 2 eski sürümde");
  assert.equal(formatMediaUseSummary([use("theme_config_history")]), "Sadece 1 eski tema sürümünde");
  assert.equal(formatMediaUseSummary([use("menu_items"), use("restaurants")]), "2 yerde kullanılıyor");
});

test("generated UUID file names fall back to description, then to their use", () => {
  const uuid = "2fab29a1-1c2d-4e5f-8a9b-0c1d2e3f4a5b.webp";
  assert.deepEqual(mediaDisplayName({ name: "logo.png", alt: "", uses: [] }), { title: "logo.png", generated: false });
  assert.deepEqual(mediaDisplayName({ name: uuid, alt: " Menemen tabağı ", uses: [] }), { title: "Menemen tabağı", generated: true });
  assert.deepEqual(mediaDisplayName({ name: uuid, alt: "", uses: [{ table: "menu_items", id: "1", label: "Serpme Kahvaltı" }] }), { title: "Serpme Kahvaltı görseli", generated: true });
  assert.deepEqual(mediaDisplayName({ name: uuid, alt: "", uses: [] }), { title: "Adsız dosya", generated: true });
});
