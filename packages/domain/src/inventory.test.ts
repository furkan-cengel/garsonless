import assert from "node:assert/strict";
import test from "node:test";
import {
  inventoryDecimal,
  convertInventoryQuantity,
  parseInventoryCsv,
  inventoryCsv,
} from "./inventory";
import { canUseFeature } from "./entitlements";
test("inventory decimal boundaries reject exponents, infinities and incompatible dimensions", () => {
  assert.equal(inventoryDecimal("1,234567"), "1.234567");
  assert.equal(inventoryDecimal("1e3"), null);
  assert.equal(inventoryDecimal("NaN"), null);
  assert.equal(inventoryDecimal("-2"), null);
  assert.equal(inventoryDecimal("-2", true), "-2");
  assert.equal(
    convertInventoryQuantity("1.234567", "kg", { unit: "g", conversions: {} }),
    "1234.567000",
  );
  assert.equal(
    convertInventoryQuantity("2", "koli", {
      unit: "adet",
      conversions: { koli: "24" },
    }),
    "48.000000",
  );
  assert.equal(
    convertInventoryQuantity("1", "l", { unit: "g", conversions: {} }),
    null,
  );
  assert.equal(
    convertInventoryQuantity("0.000001", "paket", {
      unit: "g",
      conversions: { paket: "0.000001" },
    }),
    null,
  );
});
test("CSV handles quoted commas, multiline fields, BOM and formula injection on export", () => {
  assert.deepEqual(
    parseInventoryCsv('\uFEFFname,unit\r\n"Süt, tam",ml\r\n"çok\nsatır",g'),
    [
      ["name", "unit"],
      ["Süt, tam", "ml"],
      ["çok\nsatır", "g"],
    ],
  );
  assert.throws(() => parseInventoryCsv('"unfinished'));
  assert.match(inventoryCsv([['=HYPERLINK("bad")']]), /'=HYPERLINK/);
  assert.match(inventoryCsv([['-cmd|"/c calc"!A1']]), /'-cmd/);
});
test("CSV export keeps negative and decimal numbers numeric for Turkish Excel and reads its own output back", () => {
  const csv = inventoryCsv([["Stok", "Miktar", "Maliyet"], ["Süt", "-850", "0.038"], ["Kahve", 2350, "-535.04"]]);
  assert.equal(csv, '\uFEFF"Stok";"Miktar";"Maliyet"\r\n"Süt";"-850";"0,038"\r\n"Kahve";"2350";"-535,04"');
  assert.deepEqual(parseInventoryCsv(csv), [["Stok", "Miktar", "Maliyet"], ["Süt", "-850", "0,038"], ["Kahve", "2350", "-535,04"]]);
  assert.deepEqual(parseInventoryCsv('name;cost\r\n"Süt; tam";0,038'), [["name", "cost"], ["Süt; tam", "0,038"]]);
});
test("inventory belongs to pro and business, not starter or plus", () => {
  for (const plan of ["pro", "business"])
    assert.equal(canUseFeature(plan, "inventory_management"), true);
  for (const plan of ["starter", "plus"])
    assert.equal(canUseFeature(plan, "inventory_management"), false);
});
