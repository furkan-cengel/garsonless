export type TablesRealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'stale' | 'offline'

export const TABLES_REALTIME_SAFETY_INTERVAL_MS = 45_000

export const TABLES_REALTIME_COPY: Record<TablesRealtimeStatus, string> = {
  connecting: 'Canlı güncelleme bağlanıyor',
  live: 'Canlı güncelleme bağlı',
  reconnecting: 'Canlı güncelleme yeniden bağlanıyor',
  stale: 'Veriler güncel olmayabilir',
  offline: 'Canlı güncelleme kesildi',
}

export function realtimeStatusTone(status: TablesRealtimeStatus): 'positive' | 'warning' | 'critical' {
  if (status === 'live') return 'positive'
  if (status === 'offline' || status === 'stale') return 'critical'
  return 'warning'
}
