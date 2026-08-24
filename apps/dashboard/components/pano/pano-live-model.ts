export const PANO_STALE_AFTER_MS = 150_000
export const PANO_RECONCILE_INTERVAL_MS = 120_000
export const PANO_EVENT_DEBOUNCE_MS = 250
export const PANO_EVENT_MAX_WAIT_MS = 2_000
export const PANO_RECONNECT_BASE_MS = 1_000
export const PANO_RECONNECT_MAX_MS = 30_000

export function panoReconnectDelay(attempt: number): number {
  const exponent = Math.max(0, Math.min(attempt, 8))
  return Math.min(PANO_RECONNECT_MAX_MS, PANO_RECONNECT_BASE_MS * (2 ** exponent))
}

export type PanoChannelStatus = 'connecting' | 'live' | 'offline'
export type PanoLiveStatus = 'connecting' | 'live' | 'stale' | 'offline' | 'error'

export function projectPanoLiveStatus({
  channel,
  lastSuccessfulAt,
  now,
  refreshFailed,
}: {
  channel: PanoChannelStatus
  lastSuccessfulAt: number
  now: number
  refreshFailed: boolean
}): PanoLiveStatus {
  if (channel === 'offline') return 'offline'
  if (channel === 'connecting') return 'connecting'
  if (refreshFailed) return 'error'
  if (!Number.isFinite(lastSuccessfulAt) || now - lastSuccessfulAt > PANO_STALE_AFTER_MS) return 'stale'
  return 'live'
}
