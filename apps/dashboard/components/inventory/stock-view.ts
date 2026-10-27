import type { InventorySnapshot, StockItem } from "@garsonless/domain/inventory";
import { averageDailyUse, coverText, stockStatus, type StockStatus } from "./inventory-model";

type InsightItem = NonNullable<InventorySnapshot["insights"]>["items"][number];

/** One stock card with everything the overview, the list and the side card show. */
export type StockView = {
  item: StockItem;
  quantity: number;
  threshold: number;
  dailyUse: number;
  status: StockStatus;
  cover: string;
  value: number | null;
  insight: InsightItem | undefined;
  usedIn: Array<{ name: string; quantity: string; menuItemId: string | null }>;
};

export function buildStockViews(data: InventorySnapshot): StockView[] {
  const insights = new Map(data.insights?.items.map((entry) => [entry.itemId, entry]));
  const menuNames = new Map(data.menuItems.map((menuItem) => [menuItem.id, menuItem.name]));
  const outputNames = new Map(data.items.map((stock) => [stock.id, stock.name]));
  return data.items.filter((item) => !item.archived).map((item) => {
    const quantity = Number(item.quantity);
    const threshold = Number(item.threshold);
    const insight = insights.get(item.id);
    const dailyUse = averageDailyUse(insight?.daily);
    const usedIn = data.recipes.flatMap((recipe) => {
      if (recipe.mode === "none") return [];
      const line = recipe.lines.find((l) => l.itemId === item.id && !l.optionId);
      if (!line) return [];
      const name = recipe.menuItemId ? menuNames.get(recipe.menuItemId) : `Üretim: ${outputNames.get(recipe.outputItemId ?? "") ?? ""}`;
      return name ? [{ name, quantity: line.quantity, menuItemId: recipe.menuItemId }] : [];
    });
    return {
      item,
      quantity,
      threshold,
      dailyUse,
      status: stockStatus(quantity, threshold, dailyUse),
      cover: coverText(quantity, dailyUse),
      value: item.cost === null ? null : Math.max(0, quantity) * Number(item.cost),
      insight,
      usedIn,
    };
  });
}

export const STATUS_BADGE: Record<StockStatus, "destructive" | "warning" | "positive" | "secondary"> = {
  negative: "destructive",
  critical: "destructive",
  low: "warning",
  ok: "positive",
};
export const STATUS_BAR: Record<StockStatus, string> = {
  negative: "var(--critical)",
  critical: "var(--critical)",
  low: "var(--warning)",
  ok: "var(--positive)",
};
