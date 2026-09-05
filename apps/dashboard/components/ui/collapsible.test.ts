import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./collapsible.tsx", import.meta.url), "utf8");

test("closed collapsible panels are hidden before and after hydration", () => {
  assert.match(source, /\[&\[hidden\]:not\(\[hidden='until-found'\]\)\]:hidden/);
});

test("collapsible panels animate height without revealing closed content", () => {
  assert.match(source, /h-\[var\(--collapsible-panel-height\)\]/);
  assert.match(source, /overflow-hidden/);
  assert.match(source, /data-starting-style:h-0/);
  assert.match(source, /data-ending-style:h-0/);
});
