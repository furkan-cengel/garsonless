export const ANALYTICS_SOURCE_ROW_LIMIT = 10_000
export const ANALYTICS_SOURCE_SENTINEL = ANALYTICS_SOURCE_ROW_LIMIT + 1

export function analyticsSourceSizeWithinBudget(rowCount: number): boolean {
  return Number.isInteger(rowCount) && rowCount >= 0 && rowCount <= ANALYTICS_SOURCE_ROW_LIMIT
}
/** Queries request LIMIT+1 so reaching the sentinel is an explicit error,
 * never a plausible but incomplete report. */
export function boundedAnalyticsRows<T>(rows: T[]): T[] | null {
  return analyticsSourceSizeWithinBudget(rows.length) ? rows : null
}
