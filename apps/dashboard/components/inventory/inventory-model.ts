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
