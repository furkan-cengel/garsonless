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
