export const PANO_STALE_AFTER_MS = 60_000
export const PANO_RECONCILE_INTERVAL_MS = 45_000
export const PANO_EVENT_DEBOUNCE_MS = 250

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
