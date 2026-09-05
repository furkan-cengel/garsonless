import type { KitchenOrderProjectionBatch } from '@garsonless/application/tables'

export interface KitchenConnectionState {
  status: 'connecting' | 'live' | 'stale' | 'offline'
  lastSuccess: number | null
}

export function createKitchenOrderPoller(options: {
  cursor: KitchenOrderProjectionBatch['cursor']
  read: (cursor: KitchenOrderProjectionBatch['cursor'] | null) => Promise<{ batch: KitchenOrderProjectionBatch } | { error: string }>
  isOnline: () => boolean
  isVisible: () => boolean
  now: () => number
  onBatch: (batch: KitchenOrderProjectionBatch) => void
  onState: (state: KitchenConnectionState) => void
  onExpired: () => void
}) {
  let alive = true
  let pending = false
  let cursor = options.cursor
  let snapshotRequired = true
  let lastSnapshot = 0
  let lastSuccess: number | null = null
  let failed = false
  const report = () => options.onState({
    status: !options.isOnline() ? 'offline'
      : failed || (lastSuccess !== null && options.now() - lastSuccess >= 10_000) ? 'stale'
      : lastSuccess === null ? 'connecting' : 'live',
    lastSuccess,
  })
  return {
    stop() { alive = false },
    async poll(forceSnapshot = false) {
      if (!alive) return
      snapshotRequired ||= forceSnapshot || !options.isOnline()
      report()
      if (pending || !options.isOnline() || !options.isVisible()) return
      pending = true
      const snapshot = snapshotRequired || options.now() - lastSnapshot >= 60_000
      snapshotRequired = false
      try {
        const result = await options.read(snapshot ? null : cursor)
        if (!alive) return
        if ('error' in result) {
          failed = true
          snapshotRequired = true
          if (result.error === 'Kitchen session expired') options.onExpired()
        } else {
          cursor = result.batch.cursor
          lastSuccess = options.now()
          if (result.batch.snapshot) lastSnapshot = lastSuccess
          failed = false
          options.onBatch(result.batch)
        }
      } catch {
        failed = true
        snapshotRequired = true
      } finally {
        pending = false
        if (alive) report()
      }
    },
  }
}
