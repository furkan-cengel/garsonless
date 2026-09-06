/** Fold hourly RPC rows without dropping repeated day/hour buckets. */
export function sumAnalyticsSalesBuckets<K extends string | number>(
  rows: ReadonlyArray<{ period: string; day: string; hour: number; total: number }>,
  period: 'current' | 'previous',
  key: (row: { day: string; hour: number }) => K,
): Map<K, number> {
  const cents = new Map<K, number>()
  for (const row of rows) {
    if (row.period !== period) continue
    const bucket = key(row)
    cents.set(bucket, (cents.get(bucket) ?? 0) + Math.round(row.total * 100))
  }
  return new Map([...cents].map(([bucket, amount]) => [bucket, amount / 100]))
}
