import assert from "node:assert/strict";
import test from "node:test";
import { parseInventoryCsv } from "@garsonless/domain/inventory";
import { averageDailyUse, baseUnitCost, coverText, formatStock, priceChangePercent, readStockImport, stockStatus } from "./inventory-model";

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


test("stock status follows the ledger, the threshold and today's pace", () => {
  assert.equal(stockStatus(-19, 1000, 260), "negative");
  assert.equal(stockStatus(6500, 10000, 9000), "critical"); // under a day of use
  assert.equal(stockStatus(90, 300, 0), "critical"); // at or under half the threshold
  assert.equal(stockStatus(0, 0, 0), "critical");
  assert.equal(stockStatus(1800, 2000, 650), "low");
  assert.equal(stockStatus(2400, 1000, 260), "ok");
});

test("cover, quantities and price changes read the way a cafe talks", () => {
  assert.equal(averageDailyUse(["0", "0", "0", "0", "0", "0", "700"]), 100);
  assert.equal(coverText(6500, 9000), "9 saat");
  assert.equal(coverText(1800, 650), "2,8 gün");
  assert.equal(coverText(0, 10), "Bitti");
  assert.equal(coverText(40, 0), "Tüketim yok");
  assert.equal(formatStock(-19, "g"), "−19 g");
  assert.equal(formatStock(6500, "ml"), "6,5 L");
  assert.equal(formatStock(48, "adet"), "48 adet");
  assert.equal(priceChangePercent("1.25", "1.15"), 9);
  assert.equal(priceChangePercent("1.25", null), null);
});
