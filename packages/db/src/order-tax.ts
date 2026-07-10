export interface VatLineInput {
  price: number
  quantity: number
  modifiersPriceDelta?: number
  vatRate?: number | null
}

export interface VatBreakdownRate {
  rate: number
  net: number
  vat: number
  gross: number
}

export interface VatBreakdown {
  netTotal: number
  vatTotal: number
  grossTotal: number
  unknownGrossTotal: number
  /** Line-sum gross − charged total, when a chargedTotal below the line sum is
   *  provided (loyalty/member discounts). 0 when no discount applies. */
  discountTotal: number
  byRate: VatBreakdownRate[]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeVatRate(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return null
  }
  return Math.round(value * 100) / 100
}

/**
 * VAT-inclusive breakdown grouped by rate, from order-line snapshots.
 *
 * @param chargedTotal the REAL post-discount order total (`orders.total`). When
 *   it is below the line-sum gross (loyalty/member discounts), the discount is
 *   allocated PROPORTIONALLY across the rate buckets (unknown-rate bucket
 *   included) before VAT is derived — KDV is owed on the DISCOUNTED base, and
 *   the printed breakdown must sum EXACTLY to what was charged (a receipt whose
 *   net+KDV disagrees with its own TOPLAM is a money-honesty bug). Rounding
 *   residue lands on the largest bucket so the sum is kuruş-exact. Omitted or
 *   ≥ line sum → pure line-basis breakdown, discountTotal 0 (never inflates).
 */
export function computeVatBreakdown(lines: VatLineInput[], chargedTotal?: number | null): VatBreakdown {
  // 1. Fold line gross into per-rate buckets (rounded per line, as before).
  const grossByRate = new Map<number, number>()
  let unknownGross = 0

  for (const line of lines) {
    const quantity = Math.max(1, Math.floor(finiteNumber(line.quantity, 1)))
    const unitGross = Math.max(0, finiteNumber(line.price) + finiteNumber(line.modifiersPriceDelta))
    const gross = roundMoney(unitGross * quantity)
    const rate = normalizeVatRate(line.vatRate)

    if (rate === null) {
      unknownGross = roundMoney(unknownGross + gross)
      continue
    }
    grossByRate.set(rate, roundMoney((grossByRate.get(rate) ?? 0) + gross))
  }

  const rates = [...grossByRate.keys()].sort((a, b) => a - b)
  const lineGrossTotal = roundMoney(
    rates.reduce((sum, rate) => sum + (grossByRate.get(rate) ?? 0), 0) + unknownGross,
  )

  // 2. Discount allocation: scale every bucket by chargedTotal/lineGrossTotal,
  //    then push the rounding residual onto the largest bucket → Σ == charged.
  let discountTotal = 0
  let unknownGrossTotal = unknownGross
  if (
    typeof chargedTotal === 'number' && Number.isFinite(chargedTotal) &&
    chargedTotal >= 0 && lineGrossTotal > 0 && chargedTotal < lineGrossTotal
  ) {
    discountTotal = roundMoney(lineGrossTotal - chargedTotal)
    const factor = chargedTotal / lineGrossTotal
    let allocated = 0
    for (const rate of rates) {
      const scaled = roundMoney((grossByRate.get(rate) ?? 0) * factor)
      grossByRate.set(rate, scaled)
      allocated = roundMoney(allocated + scaled)
    }
    unknownGrossTotal = roundMoney(unknownGross * factor)
    allocated = roundMoney(allocated + unknownGrossTotal)

    const residual = roundMoney(chargedTotal - allocated)
    if (residual !== 0) {
      if (rates.length > 0) {
        const largest = rates.reduce((a, b) =>
          (grossByRate.get(b) ?? 0) > (grossByRate.get(a) ?? 0) ? b : a,
        )
        grossByRate.set(largest, roundMoney((grossByRate.get(largest) ?? 0) + residual))
      } else {
        unknownGrossTotal = roundMoney(unknownGrossTotal + residual)
      }
    }
  }

  // 3. Derive VAT/net per bucket from the (possibly discounted) gross.
  const byRate: VatBreakdownRate[] = rates.map((rate) => {
    const gross = grossByRate.get(rate) ?? 0
    const vat = roundMoney(gross * rate / (100 + rate))
    return { rate, net: roundMoney(gross - vat), vat, gross }
  })

  const netTotal = roundMoney(byRate.reduce((sum, row) => sum + row.net, 0))
  const vatTotal = roundMoney(byRate.reduce((sum, row) => sum + row.vat, 0))
  const grossTotal = roundMoney(
    byRate.reduce((sum, row) => sum + row.gross, 0) + unknownGrossTotal,
  )

  return { netTotal, vatTotal, grossTotal, unknownGrossTotal, discountTotal, byRate }
}
