import assert from "node:assert/strict";
import test from "node:test";
import { assertRuntimeVersions } from "./runtime-versions.mjs";

test("a patched framework cannot hide an unsafe or missing native library", () => {
  const safe = { next: "15.5.25", sharp: "0.35.4", heif: "1.23.2" };
  assert.doesNotThrow(() => assertRuntimeVersions(safe));
  for (const [name, version] of [
    ["next", "15.5.21"],
    ["sharp", "0.34.5"],
    ["heif", "1.23.1"],
    ["heif", undefined],
    ["next", "15.5.25-canary.1"],
  ]) {
    assert.throws(
      () => assertRuntimeVersions({ ...safe, [name]: version }),
      new RegExp(name),
    );
  }
});
