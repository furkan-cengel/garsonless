const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const integerFormatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
})

export function formatPanoCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatPanoInteger(value: number): string {
  return integerFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatPanoDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0))
  if (safeMinutes < 60) return `${formatPanoInteger(safeMinutes)} dk`
  const hours = Math.floor(safeMinutes / 60)
  if (hours < 24) return `${formatPanoInteger(hours)} sa ${safeMinutes % 60} dk`
  const days = Math.floor(hours / 24)
  return `${formatPanoInteger(days)} gün ${hours % 24} sa`
}
