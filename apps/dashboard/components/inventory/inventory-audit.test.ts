import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
const workspace = read("./InventoryWorkspace.tsx");
const overview = read("./StockOverview.tsx");
const panel = read("./StockDetailPanel.tsx");
const receive = read("./ReceiveDialog.tsx");
const waste = read("./WasteDialog.tsx");
const count = read("./CountFlow.tsx");
const operation = read("./StockOperation.tsx");
const editor = read("./StockEditor.tsx");
const port = readFileSync(new URL("../../../../packages/db/src/inventory-port.ts", import.meta.url), "utf8");
const dialog = read("../ui/dialog.tsx");
const sheet = read("../ui/sheet.tsx");

test("the header says whether sales move stock and offers the three daily jobs", () => {
  assert.match(workspace, /`Satışlarla düşüyor\$\{lastSaleAt/);
  assert.match(workspace, /"Otomatik düşüm kapalı"/);
  assert.match(workspace, />Fire kaydet<\/Button>/);
  assert.match(workspace, />Sayım başlat<\/Button>/);
  assert.match(workspace, />Mal kabul<\/Button>/);
});

test("the overview leads with what needs attention today", () => {
  assert.match(overview, /Stok bitse de satış durmaz; bu yüzden önce bunlara bak\./);
  assert.match(overview, /view\.status === "negative" \?[\s\S]*Sayımla düzelt/);
  assert.match(overview, /“Yeter mi\?” son 7 günün ortalama tüketimine göre tahmindir\./);
  assert.match(overview, /aria-pressed=\{filter === value\}/);
});

test("the stock card sits beside the list when wide and opens as a sheet otherwise", () => {
  assert.match(workspace, /const WIDE_LAYOUT_QUERY = "\(min-width: 1180px\)"/);
  assert.match(workspace, /\{wide && detail && \(\s*<aside aria-label="Stok kartı"/);
  assert.match(workspace, /\{!wide && \(\s*<Sheet open=\{Boolean\(detail\)\}/);
  assert.match(panel, /role="img" aria-label=\{`Son 7 günün günlük tüketimi/);
  assert.match(panel, /Fiyat bir önceki alıma göre/);
});

test("ledger actions that cannot be undone ask first", () => {
  assert.match(workspace, /onClick=\{\(\) => setTrackingConfirm\("activate"\)\}/);
  assert.match(workspace, /onClick=\{\(\) => setTrackingConfirm\("pause"\)\}/);
  assert.match(workspace, /Duraklatma süresince satışlar stoktan düşmez/);
  assert.match(count, /onClick=\{\(\) => setConfirmApprove\(true\)\}/);
  assert.match(count, /title="Sayım onaylansın mı\?"/);
});

test("goods in are typed per invoice unit and show the effect before saving", () => {
  assert.match(receive, /baseUnitCost\(line\.price, line\.unit \|\| item\.unit, item\)/);
  assert.match(receive, /Kaydedince ne olur\?/);
  assert.match(receive, /Fatura toplamı/);
  assert.match(receive, /fiyat son alıma göre/);
  assert.match(receive, /aria-describedby=\{blocked \? "receive-blocked" : undefined\}/);
});

test("waste is what, how much and why, with the money effect first", () => {
  assert.match(waste, /const REASONS = \["Bozuldu", "Döküldü \/ düştü", "Son kullanma geçti", "Hatalı hazırlık"\]/);
  assert.match(waste, /yaklaşık \$\{money\(Number\(quantity\) \* Number\(item\.cost\)\)\} fire/);
  assert.match(waste, /aria-describedby=\{blocked \? "waste-blocked" : undefined\}/);
});

test("a phone count goes shelf by shelf, can be blind, and saves each finished shelf", () => {
  assert.match(count, /const \[blind, setBlind\] = useState\(true\)/);
  assert.match(count, /Kayıtlı miktar gizli \(kör sayım\)\./);
  assert.match(count, /A finished shelf is saved as a draft/);
  assert.match(count, /aria-label=\{`\$\{item\.name\} sayılan miktar \(\$\{unitLabel\(unit\)\}\)`\}/);
  assert.match(count, /Sayım hâlâ doğru/);
  assert.match(count, /isOwner \? "Sayımı kaydet" : "Onaya gönder"/);
});

test("the overview figures are optional and only read after an authorized snapshot", () => {
  assert.match(port, /result\.ok &&\s*input\.mode === "snapshot"/);
  assert.match(port, /rpc\("inventory_insights"/);
  assert.match(overview, /"Hesaplanamadı\."/);
});

test("a disabled operation submit says why", () => {
  assert.match(operation, /aria-describedby=\{blockedReason \? "stock-operation-blocked" : undefined\}/);
  assert.match(operation, /bu stok başka bir satırda zaten var/);
});

test("dialog close buttons have a Turkish name", () => {
  for (const source of [dialog, sheet]) {
    assert.match(source, /<span className="sr-only">Kapat<\/span>/);
    assert.doesNotMatch(source, />Close</);
  }
});

test("the recipe editor comes into view when a product is picked", () => {
  assert.match(workspace, /setRecipeTarget\(menuItem\.id\); setRecipeJump\(\(value\) => value \+ 1\);/);
  assert.match(workspace, /editorElement\?\.scrollIntoView\(\{ block: "start", behavior: "smooth" \}\)/);
});

test("stock card edits send the details version so sales do not block them", () => {
  assert.match(editor, /detailsVersion: item\.detailsVersion/);
});

test("an empty movement page does not read as a range", () => {
  assert.match(workspace, /"Henüz stok hareketi yok\. "/);
});
