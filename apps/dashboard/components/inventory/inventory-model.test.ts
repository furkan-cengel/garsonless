import assert from "node:assert/strict";
import test from "node:test";
import { baseUnitCost } from "./inventory-model";

const coffee = { unit: "g" as const, conversions: { paket: "250" } };
const water = { unit: "adet" as const, conversions: { koli: "24" } };

test("a receipt price is read per entry unit and stored per base unit", () => {
  assert.equal(baseUnitCost("620", "kg", coffee), "0.62");
  assert.equal(baseUnitCost("0,62", "g", coffee), "0.62");
  assert.equal(baseUnitCost("150", "paket", coffee), "0.6");
  assert.equal(baseUnitCost("156", "koli", water), "6.5");
  assert.equal(baseUnitCost("100", "koli", water), "4.166667");
});

test("an unreadable price or unknown unit yields no cost instead of a wrong one", () => {
  assert.equal(baseUnitCost("abc", "kg", coffee), null);
  assert.equal(baseUnitCost("10", "litre", coffee), null);
});
