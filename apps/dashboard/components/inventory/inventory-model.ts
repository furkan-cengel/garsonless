import {
  convertInventoryQuantity,
  inventoryDecimal,
  type StockItem,
} from "@garsonless/domain/inventory";

/** Invoices price the unit the goods arrive in (kg, koli), so a receipt asks the
 * price in the entry unit and the ledger stores it per base unit (g, ml, adet). */
export function baseUnitCost(
  cost: string,
  unit: string,
  item: Pick<StockItem, "unit" | "conversions">,
): string | null {
  const price = inventoryDecimal(cost.trim().replace(",", "."));
  const scale = convertInventoryQuantity("1", unit, item);
  if (price === null || scale === null || Number(scale) <= 0) return null;
  return String(Number((Number(price) / Number(scale)).toFixed(6)));
}

const IMPORT_HEADERS = {
  en: ["name", "kind", "unit", "quantity", "cost", "threshold", "category", "shelf"],
  tr: ["ad", "tür", "birim", "miktar", "maliyet", "eşik", "kategori", "raf"],
};
export const STOCK_IMPORT_TEMPLATE = [
  IMPORT_HEADERS.tr,
  ["Kahve çekirdeği", "Hammadde", "g", "1000", "0.6", "200", "İçecek", "Raf 1"],
];
const KINDS: Record<string, StockItem["kind"]> = {
  raw: "raw", hammadde: "raw",
  finished: "finished", "hazır ürün": "finished", "hazir urun": "finished",
  prepared: "prepared", "yarı mamul": "prepared", "yari mamul": "prepared",
};
const UNITS = ["g", "ml", "adet"] as const;

export type StockImportRow = {
  name: string;
  kind: StockItem["kind"];
  unit: StockItem["unit"];
  openingQuantity: string;
  openingCost: string;
  threshold: string;
  category: string;
  shelf: string;
};

/** Checks an import before anything is sent. Every message names the row and the
 * field so the owner can fix the file without guessing. */
export function readStockImport(rows: string[][], existingNames: string[]): StockImportRow[] {
  const headers = rows[0]?.map((h) => h.trim().toLocaleLowerCase("tr-TR"));
  const body = rows.slice(1);
  if (!headers || (headers.join() !== IMPORT_HEADERS.en.join() && headers.join() !== IMPORT_HEADERS.tr.join()))
    throw new Error(`İlk satır şu başlıkları bu sırayla içermeli: ${IMPORT_HEADERS.tr.join(", ")}. Şablonu indirip doldurmanız en kolayı.`);
  if (!body.length || body.length > 500) throw new Error("Bir dosyada 1–500 stok kartı ekleyin.");
  const seen = new Set(existingNames.map((n) => n.toLocaleLowerCase("tr-TR")));
  return body.map((row, index) => {
    const line = `${index + 2}. satır`;
    if (row.length !== 8) throw new Error(`${line}: 8 sütun olmalı, ${row.length} sütun var.`);
    const [name, kind, unit, quantity, cost, threshold, category, shelf] = row.map((cell) => cell.trim()) as [string, string, string, string, string, string, string, string];
    if (!name) throw new Error(`${line}: stok adı boş.`);
    const key = name.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) throw new Error(`${line}: “${name}” zaten var. İçe aktarma yalnız yeni kart ekler.`);
    seen.add(key);
    const mappedKind = KINDS[kind.toLocaleLowerCase("tr-TR")];
    if (!mappedKind) throw new Error(`${line}: tür “${kind}” tanınmadı. Hammadde, Hazır ürün veya Yarı mamul yazın.`);
    const mappedUnit = UNITS.find((u) => u === unit.toLocaleLowerCase("tr-TR"));
    if (!mappedUnit) throw new Error(`${line}: birim “${unit}” tanınmadı. g, ml veya adet yazın.`);
    const openingQuantity = inventoryDecimal(quantity);
    if (openingQuantity === null) throw new Error(`${line}: miktar “${quantity}” bir sayı değil.`);
    const openingCost = cost ? inventoryDecimal(cost) : "";
    if (openingCost === null) throw new Error(`${line}: maliyet “${cost}” bir sayı değil; bilinmiyorsa boş bırakın.`);
    const parsedThreshold = inventoryDecimal(threshold || "0");
    if (parsedThreshold === null) throw new Error(`${line}: eşik “${threshold}” bir sayı değil.`);
    return { name, kind: mappedKind, unit: mappedUnit, openingQuantity, openingCost, threshold: parsedThreshold, category, shelf };
  });
}

export type StockStatus = "negative" | "critical" | "low" | "ok";
export const STOCK_STATUS_ORDER: Record<StockStatus, number> = { negative: 0, critical: 1, low: 2, ok: 3 };
export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  negative: "Eksi bakiye",
  critical: "Kritik",
  low: "Azalıyor",
  ok: "Yeterli",
};

/** Average daily use over the days given (the last seven, today included). */
export function averageDailyUse(daily: string[] | undefined): number {
  if (!daily?.length) return 0;
  return daily.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) / daily.length;
}

/** Below zero means the ledger is wrong; under a day of use or at half the
 * threshold is critical; at or under the threshold is running low. */
export function stockStatus(quantity: number, threshold: number, dailyUse: number): StockStatus {
  if (quantity < 0) return "negative";
  if ((dailyUse > 0 && quantity / dailyUse < 1) || quantity <= threshold * 0.5) return "critical";
  if (quantity <= threshold) return "low";
  return "ok";
}

/** How long the stock lasts at today's pace, in words. */
export function coverText(quantity: number, dailyUse: number): string {
  if (quantity <= 0) return "Bitti";
  if (dailyUse <= 0) return "Tüketim yok";
  const days = quantity / dailyUse;
  if (days < 1) return `${Math.max(1, Math.round(days * 12))} saat`;
  return `${days.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} gün`;
}

/** Grams above a kilo read as kg and millilitres above a litre as L. */
export function formatStock(value: number, unit: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const big = (unit === "g" || unit === "ml") && abs >= 1000;
  const shown = big ? abs / 1000 : abs;
  const label = big ? (unit === "g" ? "kg" : "L") : unit;
  return `${sign}${shown.toLocaleString("tr-TR", { maximumFractionDigits: big ? 2 : 3 })} ${label}`;
}

/** Percent change of the last purchase price against the one before, rounded. */
export function priceChangePercent(lastCost: string | null | undefined, previousCost: string | null | undefined): number | null {
  const last = Number(lastCost);
  const previous = Number(previousCost);
  if (!lastCost || !previousCost || !Number.isFinite(last) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((last - previous) / previous) * 100);
}

/** "l" is the conversion key; people write litres as L. */
export const unitLabel = (unit: string) => (unit === "l" ? "L" : unit);

/** Entry units offered for a stock: its base unit, kg or L, and its own units. */
export function entryUnits(item: Pick<StockItem, "unit" | "conversions">): Array<{ unit: string; factor: number }> {
  return [
    { unit: item.unit, factor: 1 },
    ...(item.unit === "g" ? [{ unit: "kg", factor: 1000 }] : item.unit === "ml" ? [{ unit: "l", factor: 1000 }] : []),
    ...Object.entries(item.conversions).map(([unit, factor]) => ({ unit, factor: Number(factor) })),
  ];
}

/** The unit a stock is ordered in and how many base units it holds. */
export function orderUnitOf(item: Pick<StockItem, "unit" | "conversions" | "orderUnit">): { unit: string; factor: number } {
  const units = entryUnits(item);
  return units.find((u) => u.unit === item.orderUnit) ?? units[0]!;
}

/** Four days of today's pace plus the threshold, minus what is on hand, in order units. */
export function suggestOrder(quantity: number, threshold: number, dailyUse: number, factor: number): number {
  const need = dailyUse * 4 + threshold - quantity;
  return Math.max(1, Math.ceil(need / Math.max(factor, 1)));
}

/** A message the owner can paste into WhatsApp or an email. */
export function reorderMessage(restaurantName: string, lines: Array<{ name: string; quantity: number; unit: string }>): string {
  return [
    `Merhaba, ${restaurantName} için sipariş:`,
    ...lines.map((line) => `• ${line.name}: ${line.quantity.toLocaleString("tr-TR")} ${unitLabel(line.unit)}`),
    "Teşekkürler.",
  ].join("\n");
}

/** Food cost as a whole percent of revenue; null when there was no revenue. */
export function foodCostPercent(consumption: string | undefined, revenue: string | undefined): number | null {
  const used = Number(consumption);
  const sold = Number(revenue);
  if (!Number.isFinite(used) || !Number.isFinite(sold) || sold <= 0) return null;
  return Math.round((used / sold) * 100);
}

const UNIT_WORDS: Record<string, string> = {
  kg: "kg", kilo: "kg", kilogram: "kg",
  g: "g", gr: "g", gram: "g",
  l: "l", lt: "l", litre: "l", liter: "l",
  ml: "ml",
  adet: "adet", ad: "adet", tane: "adet", pcs: "adet",
};
const normalizeWords = (value: string) =>
  value.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length > 1);

/** How alike a printed product name and a stock card name are: 1 for the same words, 0 for none shared. */
function nameScore(printed: string, stock: string): number {
  const a = new Set(normalizeWords(printed));
  const b = new Set(normalizeWords(stock));
  if (!a.size || !b.size) return 0;
  const shared = [...b].filter((word) => a.has(word) || [...a].some((other) => other.startsWith(word) || word.startsWith(other))).length;
  return shared / b.size;
}

export type InvoiceLineMatch = { itemId: string; unit: string; amount: string; price: string; printed: string };

/** Turns a line read from an invoice into a receive line: the best matching stock card,
 * the printed unit mapped to one of its entry units, and the amounts as typed text. */
export function matchInvoiceLine(
  line: { name: string; quantity: number | null; unit: string; unitPrice: number | null },
  items: Array<Pick<StockItem, "id" | "name" | "unit" | "conversions" | "archived">>,
): InvoiceLineMatch {
  const candidates = items.filter((item) => !item.archived).map((item) => ({ item, score: nameScore(line.name, item.name) })).sort((x, y) => y.score - x.score);
  const best = candidates[0] && candidates[0].score >= 0.5 ? candidates[0].item : null;
  const printedUnit = line.unit.trim().toLocaleLowerCase("tr-TR");
  let unit = "";
  if (best) {
    const units = entryUnits(best);
    const word = UNIT_WORDS[printedUnit.replace(/\.$/, "")];
    unit = units.find((u) => u.unit === word)?.unit
      ?? units.find((u) => printedUnit && u.unit.toLocaleLowerCase("tr-TR").split(/[\s(]/)[0] === printedUnit.split(/\s/)[0])?.unit
      ?? best.unit;
  }
  const text = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));
  return { itemId: best?.id ?? "", unit, amount: text(line.quantity), price: text(line.unitPrice), printed: `${line.name}${line.quantity !== null ? ` · ${text(line.quantity)} ${line.unit}` : ""}` };
}
