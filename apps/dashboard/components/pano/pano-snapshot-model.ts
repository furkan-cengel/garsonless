import type { ActivityEvent, PanoAttentionItem, PanoSnapshot, TableStatusData } from '../../lib/queries/pano'

export type PanoLiveSnapshot = Omit<PanoSnapshot, 'timezone' | 'initialFeed' | 'tableStatuses'>

const METRIC_ATTENTION_KINDS = new Set<PanoAttentionItem['kind']>(['pending_order'])

function mergeAttention(
  current: PanoAttentionItem[],
  incoming: PanoAttentionItem[],
  metricsFresh: boolean,
  operationalFresh: boolean,
): PanoAttentionItem[] {
  if (metricsFresh && operationalFresh) return incoming
  return [
    ...(metricsFresh ? incoming : current).filter((item) => METRIC_ATTENTION_KINDS.has(item.kind)),
    ...(operationalFresh ? incoming : current).filter((item) => !METRIC_ATTENTION_KINDS.has(item.kind)),
  ]
}

export function mergePanoRefresh(
  currentSnapshot: PanoLiveSnapshot,
  currentFeed: ActivityEvent[],
  currentTables: TableStatusData[],
  incoming: PanoSnapshot,
): {
  snapshot: PanoLiveSnapshot
  feed: ActivityEvent[]
  tableStatuses: TableStatusData[]
  retainedData: boolean
  fullyFresh: boolean
} {
  // During a rolling deployment a newly loaded client can briefly reach an
  // older server action instance that predates slice health metadata. Legacy
  // snapshots represented all-or-nothing success, so treat missing metadata as
  // fully fresh instead of throwing and stranding the UI in stale state.
  const metricsFresh = incoming.health?.metrics !== 'failed'
  const operationalFresh = incoming.health?.operational !== 'degraded'
  const { timezone: _timezone, initialFeed, tableStatuses, ...incomingSnapshot } = incoming

  const snapshot: PanoLiveSnapshot = {
    ...incomingSnapshot,
    ...(!metricsFresh ? {
      kpis: currentSnapshot.kpis,
      orderSummary: currentSnapshot.orderSummary,
      hourlySales: currentSnapshot.hourlySales,
      topItems: currentSnapshot.topItems,
      heatmap: currentSnapshot.heatmap,
    } : {}),
    ...(!operationalFresh ? {
      pendingServiceRequests: currentSnapshot.pendingServiceRequests,
      actionableOrders: currentSnapshot.actionableOrders,
      paymentStatus: currentSnapshot.paymentStatus,
    } : {}),
    // A failed business read keeps the last good figures instead of blanking the view.
    business: incomingSnapshot.business ?? currentSnapshot.business,
    till: incomingSnapshot.till ?? currentSnapshot.till,
    staff: incomingSnapshot.staff ?? currentSnapshot.staff,
    attentionItems: mergeAttention(
      currentSnapshot.attentionItems,
      incomingSnapshot.attentionItems,
      metricsFresh,
      operationalFresh,
    ),
  }

  return {
    snapshot,
    feed: metricsFresh ? initialFeed : currentFeed,
    tableStatuses: operationalFresh ? tableStatuses : currentTables,
    retainedData: !metricsFresh || !operationalFresh,
    fullyFresh: metricsFresh && operationalFresh,
  }
}
