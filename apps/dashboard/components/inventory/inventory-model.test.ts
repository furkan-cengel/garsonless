import assert from "node:assert/strict";
import test from "node:test";
import { parseInventoryCsv } from "@garsonless/domain/inventory";
import { baseUnitCost, readStockImport } from "./inventory-model";

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


test("stock import reads a Turkish Excel file with Turkish headers and kinds", () => {
  const rows = parseInventoryCsv("﻿ad;tür;birim;miktar;maliyet;eşik;kategori;raf\r\nSüt;Hammadde;ml;5000;0,038;2000;Süt ürünleri;Dolap\r\nSu;Hazır ürün;adet;48;;24;;");
  assert.deepEqual(readStockImport(rows, []), [
    { name: "Süt", kind: "raw", unit: "ml", openingQuantity: "5000", openingCost: "0.038", threshold: "2000", category: "Süt ürünleri", shelf: "Dolap" },
    { name: "Su", kind: "finished", unit: "adet", openingQuantity: "48", openingCost: "", threshold: "24", category: "", shelf: "" },
  ]);
  assert.equal(readStockImport(parseInventoryCsv("name,kind,unit,quantity,cost,threshold,category,shelf\nSüt,raw,ml,1,,0,,"), []).length, 1);
});

test("stock import names the row and the field it rejects", () => {
  const read = (body: string, existing: string[] = []) => () => readStockImport(parseInventoryCsv(`ad;tür;birim;miktar;maliyet;eşik;kategori;raf\n${body}`), existing);
  assert.throws(read("Süt;Hamadde;ml;1;;0;;"), /2\. satır: tür “Hamadde” tanınmadı/);
  assert.throws(read("Süt;Hammadde;litre;1;;0;;"), /2\. satır: birim “litre” tanınmadı/);
  assert.throws(read("Süt;Hammadde;ml;bir;;0;;"), /2\. satır: miktar “bir” bir sayı değil/);
  assert.throws(read("Süt;Hammadde;ml;1;;0;;", ["SÜT"]), /“Süt” zaten var/);
  assert.throws(read("Süt;Hammadde;ml;1"), /8 sütun olmalı, 4 sütun var/);
  assert.throws(() => readStockImport(parseInventoryCsv("isim;tür\nSüt;Hammadde"), []), /İlk satır şu başlıkları/);
});
