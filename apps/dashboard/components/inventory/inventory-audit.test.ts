import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("./InventoryWorkspace.tsx", import.meta.url), "utf8");
const operation = readFileSync(new URL("./StockOperation.tsx", import.meta.url), "utf8");
const count = readFileSync(new URL("./StockCount.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("./StockEditor.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../ui/dialog.tsx", import.meta.url), "utf8");
const sheet = readFileSync(new URL("../ui/sheet.tsx", import.meta.url), "utf8");

test("ledger actions that cannot be undone ask first", () => {
  assert.match(workspace, /onClick=\{\(\) => setTrackingConfirm\("activate"\)\}/);
  assert.match(workspace, /onClick=\{\(\) => setTrackingConfirm\("pause"\)\}/);
  assert.match(workspace, /Duraklatma süresince satışlar stoktan düşmez/);
  assert.match(count, /onClick=\{\(\) => setConfirmApprove\(true\)\}/);
  assert.match(count, /<CountDifferences count=\{count\} data=\{data\} \/>/);
  assert.match(count, /Onaylamadan önce değişiklikleri taslak olarak kaydedin/);
});

test("receipt prices are per entry unit and the preview shows the line total", () => {
  assert.match(operation, /baseUnitCost\(l\.cost, l\.unit \|\| item\.unit, item\)/);
  assert.match(operation, /label=\{`Birim fiyat \(TL \/ \$\{line\.unit \|\| item\?\.unit \|\| "birim"\}\)`\}/);
  assert.match(operation, /money\(Number\(l\.quantity\) \* Number\(l\.cost\)\)/);
});

test("a disabled operation submit says why", () => {
  assert.match(operation, /aria-describedby=\{blockedReason \? "stock-operation-blocked" : undefined\}/);
  assert.match(operation, /bu stok başka bir satırda zaten var/);
});

test("count fields and dialog close buttons have meaningful Turkish names", () => {
  assert.match(count, /accessibleLabel=\{`\$\{item\.name\} sayılan miktar \(\$\{item\.unit\}\)`\}/);
  for (const source of [dialog, sheet]) {
    assert.match(source, /<span className="sr-only">Kapat<\/span>/);
    assert.doesNotMatch(source, />Close</);
  }
});

test("the recipe editor comes into view when a product is picked", () => {
  assert.match(workspace, /setRecipeTarget\(menuItem\.id\); setRecipeJump\(\(value\) => value \+ 1\);/);
  assert.match(workspace, /editorElement\?\.scrollIntoView\(\{ block: "start", behavior: "smooth" \}\)/);
});

test("phones get a section select and card lists instead of off-screen tables", () => {
  assert.match(workspace, /<Field className="sm:hidden">[\s\S]*id="inventory-section"/);
  assert.match(workspace, /<div className="hidden overflow-x-auto sm:block">/);
  assert.match(workspace, /aria-label=\{`\$\{i\.name\} düzenle`\}/);
  assert.equal(workspace.match(/<Table className="hidden sm:table">/g)?.length, 2);
});

test("stock card edits send the details version so sales do not block them", () => {
  assert.match(editor, /detailsVersion: item\.detailsVersion/);
});

test("an empty movement page does not read as a range", () => {
  assert.match(workspace, /"Henüz stok hareketi yok\. "/);
});
