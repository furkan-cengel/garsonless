import { computeVatBreakdown } from '@garsonless/db/browser'

type AnalyticsOrderItem = {
  name?: string
  price?: number
  qty?: number
  quantity?: number
  modifiersPriceDelta?: number
  vatRate?: number | null
}

export type AnalyticsFinancialOrder = {
  total?: number | null
  items?: unknown
  created_at?: string
}

export interface AnalyticsFinancialSummary {
  /** Sum of line snapshots before order-level discounts. */
  grossSales: number
  /** Line gross minus the charged order total, never below zero. */
  discountTotal: number
  /** Canonical charged order totals. */
  netSales: number
  /** VAT included in netSales for lines carrying a valid VAT rate. */
  vatTotal: number
  /** Net-of-VAT amount for lines carrying a valid VAT rate. */
  netOfVatTotal: number
  /** Discounted gross whose VAT rate is absent/invalid. */
  unknownVatGross: number
  /** Order total above line gross; intentionally not attributed to products. */
  unattributedAmount: number
}

export type CancelledFinancialOrder = {
  total?: number | null
  paidAt: string | null
  paymentMethod: string | null
}

export interface CancellationFinancialSummary {
  lostAmount: number
  collectedCancelledCount: number
  collectedCancelledAmount: number
  compCancelledCount: number
  compCancelledAmount: number
}

type NormalizedLine = {
  name: string
  quantity: number
  gross: number
  vatRate: number | null
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function finiteMoney(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? roundMoney(value)
    : null
}

function normalizeLines(value: unknown): NormalizedLine[] {
  if (!Array.isArray(value)) return []

  return (value as AnalyticsOrderItem[]).map((item) => {
    const quantityValue = typeof item.quantity === 'number' ? item.quantity : item.qty
    const quantity = typeof quantityValue === 'number' && Number.isFinite(quantityValue) && quantityValue > 0
      ? quantityValue
      : 1
    const price = typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : 0
    const modifierDelta = typeof item.modifiersPriceDelta === 'number' && Number.isFinite(item.modifiersPriceDelta)
      ? item.modifiersPriceDelta
      : 0
    const vatRate = typeof item.vatRate === 'number' && Number.isFinite(item.vatRate)
      ? item.vatRate
      : null
    return {
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Ürün',
      quantity,
      gross: roundMoney(Math.max(0, price + modifierDelta) * quantity),
      vatRate,
    }
  })
}

function sumLineGross(lines: NormalizedLine[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.gross, 0))
}

/**
 * Allocates an order-level discount proportionally to product lines. The final
 * kuruş residue lands on the largest line, so allocated product revenue equals
 * the canonical order total whenever total <= line gross. Amounts above the
 * line gross (future service fee/tip/etc.) are deliberately not invented as
 * product revenue.
 */
export function foldOrderItemsToNet(
  rows: AnalyticsFinancialOrder[],
  since?: Date,
): Map<string, { count: number; revenue: number }> {
  const result = new Map<string, { count: number; revenue: number }>()

  for (const row of rows) {
    if (since && row.created_at && new Date(row.created_at) < since) continue
    const lines = normalizeLines(row.items)
    const lineGross = sumLineGross(lines)
    if (lines.length === 0 || lineGross <= 0) continue

    const orderTotal = finiteMoney(row.total)
    const productTarget = orderTotal === null ? lineGross : Math.min(orderTotal, lineGross)
    const factor = productTarget / lineGross
    const allocations = lines.map((line) => roundMoney(line.gross * factor))
    const allocated = roundMoney(allocations.reduce((sum, amount) => sum + amount, 0))
    const residual = roundMoney(productTarget - allocated)
    if (residual !== 0) {
      const largestIndex = lines.reduce(
        (largest, line, index) => line.gross > lines[largest]!.gross ? index : largest,
        0,
      )
      allocations[largestIndex] = roundMoney(allocations[largestIndex]! + residual)
    }

    lines.forEach((line, index) => {
      const current = result.get(line.name) ?? { count: 0, revenue: 0 }
      current.count += line.quantity
      current.revenue = roundMoney(current.revenue + allocations[index]!)
      result.set(line.name, current)
    })
  }

  return result
}

export function aggregateCollectedFinancials(rows: AnalyticsFinancialOrder[]): AnalyticsFinancialSummary {
  const summary: AnalyticsFinancialSummary = {
    grossSales: 0,
    discountTotal: 0,
    netSales: 0,
    vatTotal: 0,
    netOfVatTotal: 0,
    unknownVatGross: 0,
    unattributedAmount: 0,
  }

  for (const row of rows) {
    const lines = normalizeLines(row.items)
    const lineGross = sumLineGross(lines)
    const orderTotal = finiteMoney(row.total) ?? lineGross
    const breakdown = computeVatBreakdown(
      lines.map((line) => ({
        price: line.quantity > 0 ? line.gross / line.quantity : 0,
        quantity: line.quantity,
        vatRate: line.vatRate,
      })),
      orderTotal,
    )

    summary.grossSales = roundMoney(summary.grossSales + lineGross)
    summary.discountTotal = roundMoney(summary.discountTotal + breakdown.discountTotal)
    summary.netSales = roundMoney(summary.netSales + orderTotal)
    summary.vatTotal = roundMoney(summary.vatTotal + breakdown.vatTotal)
    summary.netOfVatTotal = roundMoney(summary.netOfVatTotal + breakdown.netTotal)
    summary.unknownVatGross = roundMoney(summary.unknownVatGross + breakdown.unknownGrossTotal)
    summary.unattributedAmount = roundMoney(
      summary.unattributedAmount + Math.max(0, roundMoney(orderTotal - lineGross)),
    )
  }

  return summary
}

export function summarizeCancelledFinancials(
  rows: CancelledFinancialOrder[],
): CancellationFinancialSummary {
  const uncollected = rows.filter((row) => row.paidAt === null && row.paymentMethod !== 'comp')
  const collected = rows.filter((row) => row.paidAt !== null && row.paymentMethod !== 'comp')
  const comp = rows.filter((row) => row.paymentMethod === 'comp')
  const sum = (values: CancelledFinancialOrder[]) => roundMoney(
    values.reduce((total, row) => total + (finiteMoney(row.total) ?? 0), 0),
  )

  return {
    lostAmount: sum(uncollected),
    collectedCancelledCount: collected.length,
    collectedCancelledAmount: sum(collected),
    compCancelledCount: comp.length,
    compCancelledAmount: sum(comp),
  }
}
