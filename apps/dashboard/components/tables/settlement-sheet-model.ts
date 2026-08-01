import type { SettlementOrder, SettlementShare } from '../../lib/actions/settlement'

export type { SettlementShare } from '../../lib/actions/settlement'

export type SettlementMethod = 'cash' | 'pos' | 'comp'

export type SettlementProjection = {
  all: SettlementOrder[]
  isSplitMode: boolean
  paid: SettlementOrder[]
  unpaid: SettlementOrder[]
  total: number
  assigned: number
  remaining: number
  allStaged: boolean
  settledShares: SettlementShare[]
  declaredCashShares: SettlementShare[]
  pendingCardShares: SettlementShare[]
  settledShareTotal: number
  declaredCashTotal: number
  pendingCardTotal: number
  splitRemaining: number
  tally: Record<SettlementMethod, number>
  collected: number
}

export function deriveSettlementProjection(
  orders: SettlementOrder[] | null,
  shares: SettlementShare[],
  staged: Record<string, SettlementMethod>,
): SettlementProjection {
  const all = orders ?? []
  const isSplitMode = shares.length > 0 || all.some((order) => order.paymentMethod === 'split')
  const paid = all.filter((order) => order.paidAt !== null)
  const unpaid = all.filter((order) => order.paidAt === null)
  const total = all.reduce((sum, order) => sum + order.total, 0)
  const stagedCount = isSplitMode ? 0 : unpaid.filter((order) => staged[order.id]).length
  const assigned = paid.length + stagedCount
  const remaining = unpaid
    .filter((order) => !staged[order.id])
    .reduce((sum, order) => sum + order.total, 0)
  const allStaged = isSplitMode
    ? unpaid.length === 0
    : unpaid.every((order) => Boolean(staged[order.id]))

  const settledShares = shares.filter((share) => share.status === 'settled')
  const declaredCashShares = shares.filter(
    (share) => share.status === 'declared' && share.method === 'cash',
  )
  const pendingCardShares = shares.filter(
    (share) => share.status === 'declared' && share.method === 'iyzico',
  )
  const settledShareTotal = settledShares.reduce((sum, share) => sum + share.amount, 0)
  const declaredCashTotal = declaredCashShares.reduce((sum, share) => sum + share.amount, 0)
  const pendingCardTotal = pendingCardShares.reduce((sum, share) => sum + share.amount, 0)
  const splitRemaining = Math.max(0, total - settledShareTotal)

  const tally: Record<SettlementMethod, number> = { cash: 0, pos: 0, comp: 0 }
  for (const order of paid) {
    const method = order.paymentMethod
    if (method === 'cash' || method === 'pos' || method === 'comp') tally[method] += order.total
  }
  if (!isSplitMode) {
    for (const order of unpaid) {
      const method = staged[order.id]
      if (method) tally[method] += order.total
    }
  }

  const iyzicoPaid = paid
    .filter((order) => order.paymentMethod === 'iyzico')
    .reduce((sum, order) => sum + order.total, 0)
  const splitCollected = settledShares.reduce((sum, share) => sum + share.amount, 0)
  const collected = tally.cash + tally.pos + iyzicoPaid + splitCollected

  return {
    all,
    isSplitMode,
    paid,
    unpaid,
    total,
    assigned,
    remaining,
    allStaged,
    settledShares,
    declaredCashShares,
    pendingCardShares,
    settledShareTotal,
    declaredCashTotal,
    pendingCardTotal,
    splitRemaining,
    tally,
    collected,
  }
}

export function toggleSettlementMethod(
  staged: Record<string, SettlementMethod>,
  orderId: string,
  method: SettlementMethod,
): Record<string, SettlementMethod> {
  if (staged[orderId] !== method) return { ...staged, [orderId]: method }
  const next = { ...staged }
  delete next[orderId]
  return next
}

export function fillSettlementMethods(
  staged: Record<string, SettlementMethod>,
  unpaid: SettlementOrder[],
  method: SettlementMethod,
): Record<string, SettlementMethod> {
  const next = { ...staged }
  for (const order of unpaid) next[order.id] = method
  return next
}
