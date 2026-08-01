import { TABLE_LATE_AFTER_MINUTES } from './tables-operation-model'
import { TABLES_REALTIME_COPY, type TablesRealtimeStatus } from './tables-realtime-model'
import { TABLES_NAV_STYLES } from './tables-navigation-ui'

export function TablesNavigationHeader({
  tableCount,
  activeCount,
  lateCount,
  connectionStatus,
  realtimeColor,
  realtimeBackground,
  onOpenHistory,
  onRetryRealtime,
}: {
  tableCount: number
  activeCount: number
  lateCount: number
  connectionStatus: TablesRealtimeStatus
  realtimeColor: string
  realtimeBackground: string
  onOpenHistory: () => void
  onRetryRealtime: () => void
}) {
  return (
    <div className="tb-tables__nav-header" style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.01em', flex: 1 }}>Masalar</div>
        <span style={{ ...TABLES_NAV_STYLES.mono, fontSize: 11, color: 'var(--text-3)' }}>{tableCount}</span>
        <button className="tb-tables__nav-history" type="button" onClick={onOpenHistory} style={{ border: 0, background: 'transparent', fontSize: 11, color: 'var(--action)', cursor: 'pointer', padding: '0 8px' }}>Geçmiş</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
        {activeCount} açık · {lateCount} geciken · {TABLE_LATE_AFTER_MINUTES} dk eşik
      </div>
      <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, color: realtimeColor, fontSize: 10.5, fontWeight: 650 }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: realtimeColor, boxShadow: `0 0 0 3px ${realtimeBackground}` }} />
        <span style={{ flex: 1 }}>{TABLES_REALTIME_COPY[connectionStatus]}</span>
        {connectionStatus !== 'live' && (
          <button type="button" onClick={onRetryRealtime} style={{ border: 0, padding: 0, background: 'transparent', color: realtimeColor, fontSize: 10.5, fontWeight: 750, cursor: 'pointer' }}>Yenile</button>
        )}
      </div>
    </div>
  )
}

export function TablesNavigationFeedback({
  requestError,
  sessionError,
  feedbackNotice,
  requestRetrying,
  sessionRetrying,
  onRetryPendingRequests,
  onRetrySessions,
  onDismissFeedbackNotice,
}: {
  requestError: string | null
  sessionError: string | null
  feedbackNotice: string | null
  requestRetrying: boolean
  sessionRetrying: boolean
  onRetryPendingRequests: () => void
  onRetrySessions: () => void
  onDismissFeedbackNotice: () => void
}) {
  return (
    <>
      {requestError && (
        <div role="alert" style={{ margin: '8px 12px 0', padding: '8px 10px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
          <div>İstek tamamlanamadı: {requestError}</div>
          <button type="button" disabled={requestRetrying} onClick={onRetryPendingRequests} style={{ marginTop: 7, border: '1px solid currentColor', borderRadius: 6, background: 'transparent', color: 'inherit', padding: '5px 8px', fontWeight: 750, cursor: requestRetrying ? 'wait' : 'pointer' }}>{requestRetrying ? 'Yenileniyor…' : 'İstek listesini yenile'}</button>
        </div>
      )}
      {sessionError && (
        <div role="alert" style={{ margin: '8px 12px 0', padding: '8px 10px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
          <div>Masa durumu yenilenemedi: {sessionError}</div>
          <button type="button" disabled={sessionRetrying} onClick={onRetrySessions} style={{ marginTop: 7, border: '1px solid currentColor', borderRadius: 6, background: 'transparent', color: 'inherit', padding: '5px 8px', fontWeight: 750, cursor: sessionRetrying ? 'wait' : 'pointer' }}>{sessionRetrying ? 'Yenileniyor…' : 'Masa durumunu yeniden dene'}</button>
        </div>
      )}
      {feedbackNotice && (
        <div role="status" aria-live="polite" style={{ margin: '8px 12px 0', padding: '8px 8px 8px 10px', borderRadius: 7, background: 'var(--positive-bg)', color: 'var(--positive)', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1 }}>{feedbackNotice}</span>
          <button type="button" aria-label="İşlem bildirimini kapat" onClick={onDismissFeedbackNotice} style={{ width: 32, height: 32, border: 0, borderRadius: 6, background: 'transparent', color: 'inherit', fontSize: 17, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </>
  )
}
