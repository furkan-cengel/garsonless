// Shared chart value formatters — ONE source for every axis tickFormatter and
// tooltip in the analytics charts. This is the anti-drift fix: the old charts
// each hand-rolled `₺{round(max·p/1000)}K` / `%{round(yMax·p)}`, which degenerated
// to repeated "₺0K ₺0K" / "%0 %0" on small numbers. Here the currency tick is
// magnitude-adaptive and the percent keeps one decimal, so labels never collapse.

import { formatCurrency } from '../../../lib/utils'

/** Full currency, tr-TR (₺1.234,56). Reuses the app-wide formatter. */
export const money = formatCurrency

/**
 * Compact, magnitude-adaptive currency for AXIS TICKS only:
 *   < 1.000  → ₺850            (no fake "₺0K")
 *   < 1.000.000 → ₺12,5B  (B = bin/thousand)
 *   ≥ 1.000.000 → ₺3,2M
 * Tooltips always use full `money()` — ticks are the only place we abbreviate.
 */
export function moneyTick(value: number): string {
  const abs = Math.abs(value)
  if (abs < 1_000) return `₺${Math.round(value).toLocaleString('tr-TR')}`
  if (abs < 1_000_000) return `₺${trimTrailingZero(value / 1_000)}B`
  return `₺${trimTrailingZero(value / 1_000_000)}M`
}

/** Percent, one decimal, tr-TR (%12,5). Never rounds to a degenerate "%0". */
export function percent(value: number): string {
  return `%${value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`
}

/** Plain integer count, tr-TR grouping. */
export function count(value: number): string {
  return Math.round(value).toLocaleString('tr-TR')
}

function trimTrailingZero(n: number): string {
  // 12.0 → "12", 12.5 → "12,5" (one decimal max, tr-TR separator)
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}
