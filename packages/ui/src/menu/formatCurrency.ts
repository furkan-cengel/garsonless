export function formatTRY(amount: number): string {
  const fixed = amount.toFixed(2)
  const [intPart = '0', decPart = '00'] = fixed.split('.')
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `₺${withThousands},${decPart}`
}
