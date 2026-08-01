export const INITIAL_COLUMN_ORDER_LIMIT = 48
export const COLUMN_ORDER_LIMIT_STEP = 48

export function boundedColumnWindow<T>(
  orders: readonly T[],
  requestedLimit: number,
): { visible: readonly T[]; hiddenCount: number; nextLimit: number } {
  const normalizedLimit = Number.isFinite(requestedLimit)
    ? Math.max(INITIAL_COLUMN_ORDER_LIMIT, Math.floor(requestedLimit))
    : INITIAL_COLUMN_ORDER_LIMIT
  const visibleCount = Math.min(orders.length, normalizedLimit)

  return {
    visible: orders.slice(0, visibleCount),
    hiddenCount: Math.max(0, orders.length - visibleCount),
    nextLimit: Math.min(orders.length, visibleCount + COLUMN_ORDER_LIMIT_STEP),
  }
}
