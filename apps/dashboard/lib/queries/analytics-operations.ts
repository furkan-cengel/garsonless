import { assertAccess, getUserRestaurantAccess } from '../auth/access'
import {
  analyticsReadModel,
  analyticsOrderReadFilters,
  COMP_METHOD,
  getRestaurantTimezone,
  rangeWindowFor,
  type TopItem,
} from './insights-shared'
import { coerceAnalyticsQuery, type AnalyticsQuery } from '../analytics-filter-contract'
import { projectCancellationAggregate } from '../analytics-cancellation-aggregate'

/* ══════════════════════════════════════════════════════════════════════════
   OPERASYON reports (Wave-1 Phase A) — read-only, range-aware, OWNER-ONLY.
   These are AUDIT reports ("para ve personel kaçağı denetimi"): the staff
   settlement section exposes team emails, per-person cash totals and the
   "yüksek nakit" fraud flag — showing that to the very staff being audited
   defeats the purpose and leaks PII across a privilege boundary. Members with
   'analytics' keep the four business tabs; the Operasyon tab is the owner's.
   Gate lives INSIDE each query (defense in depth: every caller path covered).
   ══════════════════════════════════════════════════════════════════════════ */

// Owner-only gate for the audit reports. Returns false for members (any
// permissions), non-members, cross-tenant callers and anonymous sessions.
async function isOwnerViewer(restaurantId: string): Promise<boolean> {
  const access = await getUserRestaurantAccess(restaurantId)
  return access?.isOwner === true
}

// % change helper: null when there's no prior baseline (>0 now, 0 before) so the
// UI can show "Yeni" instead of a fake +100%; 0 when both are 0.
function pctChange(cur: number, prev: number): number | null {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 1000) / 10
  return cur > 0 ? null : 0
}

// ── 1. İptal raporu ──────────────────────────────────────────────────────────
export interface CancellationReport {
  count: number
  lostAmount: number             // Σ total of cancelled orders without paid_at
  collectedCancelledCount: number
  collectedCancelledAmount: number
  compCancelledCount: number
  compCancelledAmount: number
  allOrders: number              // denominator = every non-deleted order in window
  rate: number                   // cancelled / all %, current window
  topItems: TopItem[]            // folded from cancelled orders' items JSON
  trend: Array<{ date: string; count: number }>
  deltaCount: number | null      // % vs previous window
  deltaLost: number | null
  deltaRate: number | null       // percentage-POINT delta of the rate
}

export async function getCancellationReport(restaurantId: string, range: string | AnalyticsQuery = 'week', asOf = new Date()): Promise<CancellationReport> {
  const empty: CancellationReport = {
    count: 0,
    lostAmount: 0,
    collectedCancelledCount: 0,
    collectedCancelledAmount: 0,
    compCancelledCount: 0,
    compCancelledAmount: 0,
    allOrders: 0,
    rate: 0,
    topItems: [],
    trend: [],
    deltaCount: 0,
    deltaLost: 0,
    deltaRate: 0,
  }
  if (!(await isOwnerViewer(restaurantId))) return empty

  const query = coerceAnalyticsQuery(range)
  const tz = await getRestaurantTimezone(restaurantId)
  const { currentStart, previousStart, currentEnd } = await rangeWindowFor(restaurantId, query, asOf)
  // Cancellation is itself the report's status dimension. Applying the global
  // lifecycle filter here (for example `ready`) removes every cancelled order
  // and turns the report into a false zero. Source and payment filters remain
  // report-wide AND filters; only the incompatible status dimension is ignored.
  const filters = analyticsOrderReadFilters({
    ...query,
    filters: { ...query.filters, status: 'all' },
  })
  const aggregateResult = await analyticsReadModel.readCancellationAggregate({
    restaurantId,
    since: previousStart.toISOString(),
    currentStart: currentStart.toISOString(),
    before: currentEnd.toISOString(),
    timezone: tz,
    filters,
  })
  if (!aggregateResult.ok) throw new Error(`getCancellationReport: ${aggregateResult.error}`)
  return projectCancellationAggregate(aggregateResult.value, tz, currentStart, currentEnd)
}

// ── 2. Anormal kapatma / kaçak ───────────────────────────────────────────────
interface AbnormalCloseRow {
  tableLabel: string
  closedAt: string
  reason: string                 // RAW staff-typed free text (no structured categories exist)
  amount: number                 // unpaid non-cancelled ₺ abandoned in that session
  closedBy: null                 // NOT captured (table_sessions has no closed_by) → UI shows "—"
}
export interface AbnormalCloseReport {
  count: number
  unpaidTotal: number
  rows: AbnormalCloseRow[]
  deltaCount: number | null
  deltaUnpaid: number | null
}

export async function getAbnormalCloseReport(restaurantId: string, range: string | AnalyticsQuery = 'week', asOf = new Date()): Promise<AbnormalCloseReport> {
  const empty: AbnormalCloseReport = { count: 0, unpaidTotal: 0, rows: [], deltaCount: 0, deltaUnpaid: 0 }
  if (!(await isOwnerViewer(restaurantId))) return empty

  const { currentStart, previousStart, currentEnd } = await rangeWindowFor(restaurantId, range, asOf)
  const result = await analyticsReadModel.readAbnormalCloseData({
    restaurantId,
    since: previousStart.toISOString(),
    before: currentEnd.toISOString(),
  })
  if (!result.ok) throw new Error(`getAbnormalCloseReport: ${result.error}`)
  const sessions = result.value.sessions.map((session) => ({
    id: session.id,
    table_id: session.tableId,
    closed_at: session.closedAt,
    close_reason: session.closeReason,
  }))
  if (sessions.length === 0) return empty

  const cur = sessions.filter((s) => new Date(s.closed_at) >= currentStart)
  const prev = sessions.filter((s) => { const d = new Date(s.closed_at); return d >= previousStart && d < currentStart })

  // Unpaid money abandoned = Σ total of UNPAID non-cancelled orders in those sessions.
  const unpaidBySession = new Map<string, number>()
  for (const order of result.value.unpaidOrders) {
    if (!order.tableSessionId) continue
    unpaidBySession.set(order.tableSessionId, (unpaidBySession.get(order.tableSessionId) ?? 0) + (order.total ?? 0))
  }

  const labelById = new Map(Object.entries(result.value.tableLabels))

  const rows: AbnormalCloseRow[] = cur
    .map((s) => ({
      tableLabel: labelById.get(s.table_id) ?? 'Masa',
      closedAt: s.closed_at,
      reason: s.close_reason,
      amount: unpaidBySession.get(s.id) ?? 0,
      closedBy: null as null,
    }))
    .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())

  const unpaidTotal = rows.reduce((s, r) => s + r.amount, 0)
  const prevUnpaid = prev.reduce((s, x) => s + (unpaidBySession.get(x.id) ?? 0), 0)

  return {
    count: rows.length,
    unpaidTotal,
    rows,
    deltaCount: pctChange(rows.length, prev.length),
    deltaUnpaid: pctChange(unpaidTotal, prevUnpaid),
  }
}

// ── 3. Personel tahsilat performansı ─────────────────────────────────────────
export interface StaffSettlementRow {
  label: string                  // owner/member email, "İyzico (otomatik)", or "Bilinmeyen kullanıcı"
  role: 'owner' | 'member' | 'system' | 'unknown'
  sections: string[] | null      // member's granted sections (permissions); null otherwise
  cash: number
  pos: number
  otherCollected: number         // iyzico + legacy null-method paid (system row)
  compAmount: number             // İkram (₺0 collected)
  compCount: number
  collected: number              // cash + pos + otherCollected
  settledCount: number           // orders THEY SETTLED (not "took")
  highCash: boolean              // cash / (cash + pos) >= 0.8 — skimming audit signal
}
export interface StaffSettlementReport {
  rows: StaffSettlementRow[]
  totalCollected: number
}
export async function getStaffSettlementReport(restaurantId: string, range: string | AnalyticsQuery = 'week', asOf = new Date()): Promise<StaffSettlementReport> {
  const empty: StaffSettlementReport = { rows: [], totalCollected: 0 }
  if (!(await isOwnerViewer(restaurantId))) return empty
  const { currentStart, currentEnd } = await rangeWindowFor(restaurantId, range, asOf)
  const filters = analyticsOrderReadFilters(range)
  const result = await analyticsReadModel.readStaffSettlementData({
    restaurantId,
    since: currentStart.toISOString(),
    before: currentEnd.toISOString(),
    filters,
  })
  if (!result.ok) throw new Error(`getStaffSettlementReport: ${result.error}`)
  const { orders, groups, ownerId, ownerEmail, members } = result.value
  const memberMap = new Map(members.filter((member) => member.userId).map((member) => [member.userId as string, member]))
  const SYSTEM = '__system'
  type Agg = { cash: number; pos: number; otherCollected: number; compAmount: number; compCount: number; settledCount: number }
  const bySettler = new Map<string, Agg>()
  if (groups) {
    for (const group of groups) {
      bySettler.set(group.settledBy ?? SYSTEM, {
        cash: group.cash,
        pos: group.pos,
        otherCollected: group.otherCollected,
        compAmount: group.compAmount,
        compCount: group.compCount,
        settledCount: group.settledCount,
      })
    }
  } else {
    for (const o of orders) {
      const key = o.settledBy ?? SYSTEM
      const agg = bySettler.get(key) ?? { cash: 0, pos: 0, otherCollected: 0, compAmount: 0, compCount: 0, settledCount: 0 }
      const amt = o.total ?? 0
      if (o.paymentMethod === 'cash') agg.cash += amt
      else if (o.paymentMethod === 'pos') agg.pos += amt
      else if (o.paymentMethod === COMP_METHOD) { agg.compAmount += amt; agg.compCount += 1 }
      else agg.otherCollected += amt // iyzico or legacy null-method paid
      agg.settledCount += 1
      bySettler.set(key, agg)
    }
  }
  const rows: StaffSettlementRow[] = Array.from(bySettler.entries()).map(([key, agg]) => {
    let label = 'Bilinmeyen kullanıcı'
    let role: StaffSettlementRow['role'] = 'unknown'
    let sections: string[] | null = null
    if (key === SYSTEM) { label = 'İyzico (otomatik)'; role = 'system' }
    else if (key === ownerId) { label = ownerEmail ?? 'Sahip'; role = 'owner' }
    else if (memberMap.has(key)) { const m = memberMap.get(key)!; label = m.email; role = 'member'; sections = m.permissions }
    const cardCash = agg.cash + agg.pos
    return {
      label, role, sections,
      cash: agg.cash, pos: agg.pos, otherCollected: agg.otherCollected,
      compAmount: agg.compAmount, compCount: agg.compCount,
      collected: agg.cash + agg.pos + agg.otherCollected,
      settledCount: agg.settledCount,
      highCash: cardCash > 0 && agg.cash / cardCash >= 0.8,
    }
  }).sort((a, b) => b.collected - a.collected)
  return { rows, totalCollected: rows.reduce((s, r) => s + r.collected, 0) }
}

/* ══════════════════════════════════════════════════════════════════════════
   SADAKAT report (Wave-1 Phase B) — loyalty_transactions aggregates, range-
   scoped. AGGREGATES ONLY (no customer identity/PII), so the regular
   analytics gate applies (owner OR member with 'analytics') — unlike the
   owner-only Operasyon audit tab. İkram ₺ is NOT a ledger row: it is reused
   from getPaymentBreakdown's comp figure (orders.payment_method='comp') and
   merged in by the action layer, so both tabs show the same number.
   ══════════════════════════════════════════════════════════════════════════ */
export interface LoyaltyReport {
  /** Σ delta, type='points', direction='earn' (includes welcome bonuses). */
  pointsIssued: number
  /** Σ |delta|, type='points', direction='redeem'. */
  pointsRedeemed: number
  /** redeemed / issued %, 0 when nothing issued. */
  redeemRate: number
  /** Σ delta, type='points', direction='refund' (cancel refunds return points). */
  pointsRefunded: number
  stampsIssued: number
  stampsRedeemed: number
  stampsRefunded: number
  /** Visit credits (type='visit', direction='earn') — one per member per closed session. */
  visits: number
  welcomeCount: number
  welcomePoints: number
  /** Redemptions grouped by the ledger's RAW reason string (no invented categories). */
  redemptionsByReason: Array<{ reason: string; count: number; points: number; stamps: number }>
  /** İkram (comp) — merged from getPaymentBreakdown by the action; ₺0 collected. */
  comp: { amount: number; count: number }
}

export async function getLoyaltyReport(restaurantId: string, range: string | AnalyticsQuery = 'week', asOf = new Date()): Promise<LoyaltyReport> {
  const empty: LoyaltyReport = {
    pointsIssued: 0, pointsRedeemed: 0, redeemRate: 0, pointsRefunded: 0,
    stampsIssued: 0, stampsRedeemed: 0, stampsRefunded: 0,
    visits: 0, welcomeCount: 0, welcomePoints: 0,
    redemptionsByReason: [], comp: { amount: 0, count: 0 },
  }
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return empty

  const { currentStart, currentEnd } = await rangeWindowFor(restaurantId, range, asOf)
  const result = await analyticsReadModel.readLoyaltyRows({
    restaurantId,
    since: currentStart.toISOString(),
    before: currentEnd.toISOString(),
  })
  if (!result.ok) throw new Error(`getLoyaltyReport: ${result.error}`)
  const rows = result.value
  const out = { ...empty, redemptionsByReason: [] as LoyaltyReport['redemptionsByReason'] }
  const byReason = new Map<string, { count: number; points: number; stamps: number }>()

  for (const r of rows) {
    const mag = Math.abs(r.delta ?? 0)
    if (r.type === 'points') {
      if (r.direction === 'earn') {
        out.pointsIssued += mag
        if (r.reason === 'welcome') { out.welcomeCount += 1; out.welcomePoints += mag }
      } else if (r.direction === 'redeem') out.pointsRedeemed += mag
      else if (r.direction === 'refund') out.pointsRefunded += mag
    } else if (r.type === 'stamp') {
      if (r.direction === 'earn') out.stampsIssued += mag
      else if (r.direction === 'redeem') out.stampsRedeemed += mag
      else if (r.direction === 'refund') out.stampsRefunded += mag
    } else if (r.type === 'visit' && r.direction === 'earn') {
      out.visits += mag
    }
    if (r.direction === 'redeem') {
      const key = r.reason || 'redeem'
      const g = byReason.get(key) ?? { count: 0, points: 0, stamps: 0 }
      g.count += 1
      if (r.type === 'points') g.points += mag
      if (r.type === 'stamp') g.stamps += mag
      byReason.set(key, g)
    }
  }

  out.redeemRate = out.pointsIssued > 0
    ? Math.round((out.pointsRedeemed / out.pointsIssued) * 1000) / 10
    : 0
  out.redemptionsByReason = Array.from(byReason.entries())
    .map(([reason, g]) => ({ reason, ...g }))
    .sort((a, b) => b.count - a.count)

  return out
}
