import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));

test("menu route, global and not-found boundaries use the shared recovery surface", () => {
  for (const file of ["error.tsx", "global-error.tsx", "not-found.tsx"]) {
    const source = readFileSync(`${directory}/../app/${file}`, "utf8");
    assert.match(source, /RecoveryScreen/);
    assert.match(source, /MAS-(UI-500|ROUTE-404)/);
    assert.doesNotMatch(source, /error\.message|error\.stack/);
  }
});
