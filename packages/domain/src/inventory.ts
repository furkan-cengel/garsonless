/** Browser-safe inventory vocabulary. Decimal quantities cross boundaries as strings. */
export const INVENTORY_MODES = [
  "snapshot",
  "item",
  "recipe",
  "receipt",
  "waste",
  "adjustment",
  "external_sale",
  "production",
  "count_save",
  "count_approve",
  "return",
  "activate",
  "pause",
  "import",
] as const;
export type InventoryMode = (typeof INVENTORY_MODES)[number];
export type InventoryUnit = "g" | "ml" | "adet";
export type InventoryError =
  | "forbidden"
  | "plan_required"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "request_mismatch"
  | "unavailable"
  | "not_initialized"
  | "recipe_cycle";
export type InventoryRequest = {
  restaurantId: string;
  mode: InventoryMode;
  requestId?: string;
  payload?: Record<string, unknown>;
};
export interface InventoryWarning {
  code: "negative_stock" | "critical_stock" | "missing_cost";
  itemId: string;
}
export interface InventoryCommandReceipt {
  documentId: string | null;
  id: string | null;
  balances: Array<{
    itemId: string;
    quantity: string;
    cost: string | null;
    version: string;
  }>;
  warnings: InventoryWarning[];
}
export type InventoryResult =
  | { ok: true; data: InventorySnapshot | InventoryCommandReceipt }
  | { ok: false; error: InventoryError };
export interface StockItem {
  id: string;
  name: string;
  kind: "raw" | "finished" | "prepared";
  unit: InventoryUnit;
  category: string;
  shelf: string;
  threshold: string;
  quantity: string;
  cost: string | null;
  version: string;
  archived: boolean;
  conversions: Record<string, string>;
}
export interface RecipeLine {
  itemId: string;
  quantity: string;
  ingredientId?: string;
  groupId?: string;
  optionId?: string;
  replacesItemId?: string;
}
export interface InventoryRecipe {
  id: string;
  menuItemId: string | null;
  outputItemId: string | null;
  outputQuantity: string;
  mode: "none" | "direct" | "recipe";
  version: number;
  lines: RecipeLine[];
}
export interface InventoryMovement {
  id: string;
  documentId: string;
  itemId: string;
  name: string;
  quantity: string;
  cost: string | null;
  kind: string;
  reason: string;
  actor: string;
  createdAt: string;
  orderId: string | null;
  reversalOf: string | null;
}
export interface InventoryCount {
  id: string;
  version: number;
  status: "draft" | "approved";
  lines: Array<{ itemId: string; quantity: string | null; version: string }>;
  createdAt: string;
}
export interface InventoryMenuItem {
  id: string;
  name: string;
  ingredients: Array<{ id: string; name: string; removable: boolean }>;
  modifiers: Array<{
    id: string;
    name: string;
    options: Array<{ id: string; name: string }>;
  }>;
}
export interface InventoryDocument {
  id: string;
  kind: string;
  reason: string;
  actor: string;
  createdAt: string;
  order: {
    id: string;
    status: string;
    createdAt: string;
    items: Array<{ name: string; quantity: number }>;
  } | null;
  lines: Array<{
    name: string;
    unit: string;
    quantity: string;
    cost: string | null;
    reversalOf: string | null;
  }>;
}
export interface InventorySnapshot {
  asOf: string;
  document?: InventoryDocument;
  items: StockItem[];
  recipes: InventoryRecipe[];
  menuItems: InventoryMenuItem[];
  movements: InventoryMovement[];
  counts: InventoryCount[];
  summary: Array<{
    itemId: string;
    kind: string;
    quantity: string;
    value: string | null;
  }>;
  enabled: boolean;
  startedAt: string | null;
  movementOffset: number;
  hasMore: boolean;
  legacyOpenOrders: number;
  cancelledWaste: Array<{
    orderId: string;
    name: string;
    quantity: string;
    itemId: string;
    returned: string;
  }>;
}
export const INVENTORY_ERRORS: Record<InventoryError, string> = {
  forbidden: "Bu işlem için yetkiniz yok.",
  plan_required: "Stok yönetimi Pro veya Business paketi gerektirir.",
  invalid_request: "Alanları ve miktarları kontrol edin.",
  not_found: "Kayıt bulunamadı.",
  conflict:
    "Kayıt veya stok değişti. Güncel veriyi yükleyip ilgili satırları yeniden kontrol edin.",
  request_mismatch:
    "Bu işlem kimliği farklı bir içerikle kullanılmış. Verileri yenileyin.",
  not_initialized:
    "Stok yönetimi bu ortamda henüz kullanıma hazır değil. Kurulum tamamlandıktan sonra stoklarınızı ekleyebilirsiniz.",
  unavailable: "İşlem tamamlanamadı. Taslağınız korunuyor; yeniden deneyin.",
  recipe_cycle: "Reçeteler birbirini döngüsel olarak içeremez.",
};
export function inventoryDecimal(
  value: unknown,
  signed = false,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (
    !(signed ? /^-?\d{1,12}(\.\d{1,6})?$/ : /^\d{1,12}(\.\d{1,6})?$/).test(
      normalized,
    )
  )
    return null;
  return normalized;
}
export function convertInventoryQuantity(
  quantity: string,
  unit: string,
  item: Pick<StockItem, "unit" | "conversions">,
): string | null {
  const parsed = inventoryDecimal(quantity);
  if (parsed === null) return null;
  const scale =
    unit === item.unit
      ? "1"
      : (unit === "kg" && item.unit === "g") ||
          (unit === "l" && item.unit === "ml")
        ? "1000"
        : item.conversions[unit];
  if (!scale || !inventoryDecimal(scale)) return null;
  const fixed = (v: string) => {
    const [a, b = ""] = v.split(".");
    return BigInt(a!) * 1000000n + BigInt(b.padEnd(6, "0"));
  };
  const product = fixed(parsed) * fixed(scale);
  if (product % 1000000n !== 0n) return null;
  const result = product / 1000000n;
  return `${result / 1000000n}.${(result % 1000000n).toString().padStart(6, "0")}`;
}
/** RFC4180 quoted fields, embedded newlines, UTF-8 BOM. No spreadsheet formula execution. */
export function parseInventoryCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += ch;
  }
  if (quoted) throw new Error("Kapanmamış CSV tırnağı.");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function inventoryCsv(rows: unknown[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return (
              '"' +
              (/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll(
                '"',
                '""',
              ) +
              '"'
            );
          })
          .join(","),
      )
      .join("\r\n")
  );
}
