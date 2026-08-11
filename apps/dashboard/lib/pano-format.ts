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
