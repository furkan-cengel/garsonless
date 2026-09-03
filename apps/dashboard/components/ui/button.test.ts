import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./button.tsx", import.meta.url), "utf8");

test("disabled destructive actions remain readable without looking actionable", () => {
  assert.match(source, /disabled:bg-muted/);
  assert.match(source, /disabled:text-muted-foreground/);
  assert.match(source, /disabled:opacity-100/);
});
