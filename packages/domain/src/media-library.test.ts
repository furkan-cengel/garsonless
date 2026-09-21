import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
