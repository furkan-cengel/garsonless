/**
 * ÖKC (fiscal cash register) integration core, independent of any one maker.
 *
 * Masabu keeps the bill; the ÖKC issues the fiscal receipt. A table bill is
 * sent to the device as a "basket" while it is open, the cashier takes payment
 * on the device, and the device reports the result back. See
 * docs/okc-integration.md for the regulation and the maker programmes.
 */

export const FISCAL_PROVIDERS = ['tokenx'] as const
export type FiscalProvider = (typeof FISCAL_PROVIDERS)[number]

/** One basket line in the device's integer units. */
export interface FiscalBasketItem {
  name: string
  /** Unit price in kuruş. */
  price: number
  sectionNo: number
  /** VAT rate × 100 (10% → 1000). */
  taxPercent: number
  /** Quantity × 1000 (1 piece → 1000). */
  quantity: number
}

export interface FiscalBasket {
  items: FiscalBasketItem[]
  /** Bill-level discount in kuruş (loyalty, member price), 0 when none. */
  discount: number
  /** What the device must collect, in kuruş: Σ price × quantity / 1000 − discount. */
  total: number
}

/** A device VAT section: the device only accepts items whose rate matches a section. */
export interface FiscalSection {
  sectionNo: number
  name: string
  taxPercent: number
}

/** An order of the bill with the line snapshot fields the basket needs. */
export interface FiscalOrderInput {
  id: string
  /** What the order really costs after discounts, in lira. */
  total: number
  lines: Array<{ name: string; price: number; modifiersPriceDelta?: number; quantity: number; vatRate: number | null }>
}

const kurus = (lira: number) => Math.round((lira + Number.EPSILON) * 100)

/**
 * Picks a section for each VAT rate. An owner override wins; otherwise the
 * first device section with the same rate. Rates with no section are returned
 * so the bill is held back instead of being sent with a wrong rate.
 */
export function mapFiscalSections(
  rates: number[],
  sections: FiscalSection[],
  overrides: Record<string, number> = {},
): { map: Map<number, number>; missing: number[] } {
  const map = new Map<number, number>()
  const missing: number[] = []
  for (const rate of [...new Set(rates)]) {
    const taxPercent = Math.round(rate * 100)
    const override = overrides[String(taxPercent)]
    const section = override !== undefined
      ? sections.find((candidate) => candidate.sectionNo === override && candidate.taxPercent === taxPercent)
      : sections.find((candidate) => candidate.taxPercent === taxPercent)
    if (section) map.set(taxPercent, section.sectionNo)
    else missing.push(rate)
  }
  return { map, missing: missing.sort((a, b) => a - b) }
}

/**
 * Turns the unpaid, uncancelled orders of a bill into a basket. Lines keep
 * their unit price and quantity; a discount (order total below its lines) goes
 * to the basket's adjustment so the receipt still shows real prices.
 */
export function buildFiscalBasket(
  orders: FiscalOrderInput[],
  sections: FiscalSection[],
  overrides: Record<string, number> = {},
): { ok: true; basket: FiscalBasket } | { ok: false; reason: 'unknown_vat' | 'unmapped_vat'; rates: number[] } {
  const lines = orders.flatMap((order) => order.lines)
  const unknown = lines.filter((line) => line.vatRate === null || !Number.isFinite(line.vatRate))
  if (unknown.length > 0) return { ok: false, reason: 'unknown_vat', rates: [] }
  const { map, missing } = mapFiscalSections(lines.map((line) => line.vatRate!), sections, overrides)
  if (missing.length > 0) return { ok: false, reason: 'unmapped_vat', rates: missing }

  const items = lines
    .map((line) => {
      const taxPercent = Math.round(line.vatRate! * 100)
      return {
        name: line.name.trim().slice(0, 40) || 'Ürün',
        price: kurus(Math.max(0, line.price + (line.modifiersPriceDelta ?? 0))),
        sectionNo: map.get(taxPercent)!,
        taxPercent,
        quantity: Math.max(1, Math.round(line.quantity)) * 1000,
      }
    })
    .filter((item) => item.price > 0)
  const gross = items.reduce((sum, item) => sum + (item.price * item.quantity) / 1000, 0)
  const charged = orders.reduce((sum, order) => sum + kurus(order.total), 0)
  const discount = Math.max(0, gross - charged)
  return { ok: true, basket: { items, discount, total: gross - discount } }
}

export type FiscalPaymentMethod = 'cash' | 'pos'

/** Device payment type → Masabu method. Only cash is cash; every card or other type is POS. */
export function fiscalPaymentMethod(type: number): FiscalPaymentMethod {
  return type === 1 ? 'cash' : 'pos'
}

/**
 * Masabu settles per order, the device per bill. A bill paid partly in cash
 * and partly by card is split by giving each order (largest first) to the
 * method with the most still to cover. The device's own payment lines are kept
 * as the record of how much was paid how; this only labels the orders.
 */
export function allocateFiscalPayment(
  orders: Array<{ id: string; total: number }>,
  payments: Array<{ type: number; amount: number }>,
): Array<{ orderId: string; method: FiscalPaymentMethod }> {
  const remaining = new Map<FiscalPaymentMethod, number>()
  for (const payment of payments) {
    const method = fiscalPaymentMethod(payment.type)
    remaining.set(method, (remaining.get(method) ?? 0) + Math.max(0, payment.amount))
  }
  if (remaining.size === 0) remaining.set('pos', 0)
  return [...orders]
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
    .map((order) => {
      const [method] = [...remaining.entries()].sort((a, b) => b[1] - a[1] || (a[0] === 'cash' ? -1 : 1))[0]!
      remaining.set(method, remaining.get(method)! - kurus(order.total))
      return { orderId: order.id, method }
    })
}

export type FiscalEvent =
  | {
      kind: 'completed'
      basketId: string
      terminalId: string | null
      receiptNo: string | null
      zNo: string | null
      payments: Array<{ type: number; amount: number; description: string | null; operatorId: string | null }>
    }
  | { kind: 'cancelled'; basketId: string }
  | { kind: 'voided'; basketId: string }
  | { kind: 'locked' | 'unlocked'; basketId: string; terminalId: string | null }

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null)
const record = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)

/** TokenX webhook body → event; null for anything this integration does not act on. */
export function parseTokenxEvent(body: unknown): FiscalEvent | null {
  const root = record(body)
  const data = record(root?.['data'])
  const basketId = text(data?.['basketID'])
  if (!root || !data || !basketId) return null
  const terminalId = text(root['terminalId'])
  switch (root['operation']) {
    case 'BASKET_LOCKED':
      return { kind: 'locked', basketId, terminalId }
    case 'BASKET_UNLOCKED':
      return { kind: 'unlocked', basketId, terminalId }
    case 'BASKET_COMPLETED': {
      const status = Number(data['status'])
      if (status === -1) return { kind: 'cancelled', basketId }
      if (status === 99) return { kind: 'voided', basketId }
      if (status !== 0) return null
      const items = Array.isArray(data['paymentItems']) ? data['paymentItems'] : []
      return {
        kind: 'completed',
        basketId,
        terminalId,
        receiptNo: text(data['receiptNo']),
        zNo: text(data['zNo']),
        payments: items.flatMap((item) => {
          const row = record(item)
          const type = Number(row?.['type'])
          const amount = Number(row?.['amount'])
          return row && Number.isInteger(type) && Number.isFinite(amount)
            ? [{ type, amount, description: text(row['description']), operatorId: text(row['operatorId']) }]
            : []
        }),
      }
    }
    default:
      return null
  }
}

/** "merchantId_branchId_terminalId" from the QR code in the TokenX Connect app. */
export function parseTokenxPairingCode(value: string): { merchantId: string; branchId: string; terminalId: string } | null {
  const parts = value.trim().split('_')
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9-]{2,64}$/.test(part))) return null
  return { merchantId: parts[0]!, branchId: parts[1]!, terminalId: parts[2]! }
}
