import type { CancellationReport, StaffSettlementRow } from '../../lib/queries/analytics'

export function projectOperationDelta(change: number | null, suffix = '%') {
  const isNew = change === null
  const isFlat = change === 0
  const direction = isNew || (change ?? 0) > 0 ? 'up' : isFlat ? 'flat' : 'down'
  const tone = isFlat ? 'neutral' : isNew || (change ?? 0) > 0 ? 'critical' : 'positive'
  const text = isNew
    ? 'Yeni'
    : isFlat
      ? `0${suffix === '%' ? '%' : ` ${suffix}`}`
      : `${Math.abs(change).toLocaleString('tr-TR')}${suffix === '%' ? '%' : ` ${suffix}`}`
  return { direction, tone, text } as const
}

export function compactCancellationTrend(data: CancellationReport['trend'], range: string) {
  const targetCount = range === 'week'
    ? Math.min(7, data.length)
    : range === 'quarter'
      ? 3
      : range === 'month' || range === 'year'
        ? 4
        : 7
  const labels = range === 'day'
    ? ['00', '04', '08', '12', '16', '20', '23']
    : range === 'month'
      ? ['1. hf', '2. hf', '3. hf', '4. hf']
      : range === 'quarter'
        ? ['1. ay', '2. ay', '3. ay']
        : range === 'year'
          ? ['Q1', 'Q2', 'Q3', 'Q4']
          : data.map((point) => point.date)
  return Array.from({ length: targetCount }, (_, groupIndex) => {
    const start = Math.floor((groupIndex * data.length) / targetCount)
    const end = Math.floor(((groupIndex + 1) * data.length) / targetCount)
    return {
      label: labels[groupIndex] ?? String(groupIndex + 1),
      count: data.slice(start, end).reduce((sum, point) => sum + point.count, 0),
    }
  })
}

export function sumStaffMethod(rows: StaffSettlementRow[], method: 'cash' | 'pos') {
  return rows
    .filter((row) => row.role !== 'system')
    .reduce((sum, row) => sum + row[method], 0)
}
