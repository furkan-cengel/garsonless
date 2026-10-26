import { useEffect, useRef } from 'react'
import { RefreshCw, TriangleAlert, WifiOff, X } from 'lucide-react'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { realtimeStatusTone, TABLES_REALTIME_COPY, type TablesRealtimeStatus } from './tables-realtime-model'

export function TablesNavigationHeader({
  tableCount,
  activeCount,
  lateCount,
}: {
  tableCount: number
  activeCount: number
  lateCount: number
}) {
  return (
    <div className="tb-tables__nav-header flex items-center gap-2 px-4 pt-3.5 pb-1">
      <h1 className="text-[15px] font-semibold tracking-tight">Masalar</h1>
      <Badge variant="outline" className="h-5 min-w-5 px-1.5 font-mono tabular-nums">{tableCount}</Badge>
      <span className="ml-auto text-xs text-muted-foreground">
        {activeCount} açık{lateCount > 0 ? <> · <strong className="font-semibold text-[var(--critical)]">{lateCount} geciken</strong></> : ' · 0 geciken'}
      </span>
    </div>
  )
}

/** Live-sync state for the top bar: quiet when live, with a retry when it is not. */
export function TablesRealtimeIndicator({ connectionStatus, onRetry }: { connectionStatus: TablesRealtimeStatus; onRetry: () => void }) {
  const tone = realtimeStatusTone(connectionStatus)
  const variant = tone === 'critical' ? 'destructive' : connectionStatus === 'connecting' ? 'info' : tone
  return (
    <div className="tb-tables__realtime flex min-w-0 items-center gap-1.5" role="status" aria-live="polite">
      <Badge variant={variant} className="h-6 max-w-full truncate px-2 text-[11px]">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
        <span className="tb-tables__realtime-text">{TABLES_REALTIME_COPY[connectionStatus]}</span>
      </Badge>
      {connectionStatus !== 'live' && (
        <Button type="button" variant="ghost" size="xs" onClick={onRetry} aria-label="Canlı güncellemeyi yeniden bağla"><RefreshCw /><span className="tb-tables__realtime-text">Yenile</span></Button>
      )}
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
        <Alert variant="destructive" className="mx-3 mt-2 w-auto text-xs">
          <AlertDescription className="grid gap-1.5 text-xs">İstek tamamlanamadı: {requestError}<Button type="button" variant="outline" size="xs" aria-busy={requestRetrying} disabled={requestRetrying} onClick={onRetryPendingRequests} className="w-fit">{requestRetrying && <Spinner aria-hidden="true" data-icon="inline-start" />}{requestRetrying ? 'Yenileniyor…' : 'İstek listesini yenile'}</Button></AlertDescription>
        </Alert>
      )}
      {sessionError && (
        <Alert variant="destructive" className="mx-3 mt-2 w-auto text-xs">
          <AlertDescription className="grid gap-1.5 text-xs">Masa durumu yenilenemedi: {sessionError}<Button type="button" variant="outline" size="xs" aria-busy={sessionRetrying} disabled={sessionRetrying} onClick={onRetrySessions} className="w-fit">{sessionRetrying && <Spinner aria-hidden="true" data-icon="inline-start" />}{sessionRetrying ? 'Yenileniyor…' : 'Masa durumunu yeniden dene'}</Button></AlertDescription>
        </Alert>
      )}
      {feedbackNotice && (
        <Alert className="mx-3 mt-2 w-auto border-[var(--positive)]/30 bg-[var(--positive-bg)] text-[var(--positive)]">
          <AlertDescription className="text-xs font-medium text-current" role="status" aria-live="polite">{feedbackNotice}</AlertDescription>
          <AlertAction><Button type="button" variant="ghost" size="icon-xs" aria-label="İşlem bildirimini kapat" onClick={onDismissFeedbackNotice}><X /></Button></AlertAction>
        </Alert>
      )}
    </>
  )
}

/** Shown while live updates are down: the plan stays visible, but staff are told how old it is. */
export function TablesSyncNotice({ connectionStatus, onRetry }: { connectionStatus: TablesRealtimeStatus; onRetry: () => void }) {
  const lastLiveAt = useRef(Date.now())
  const down = connectionStatus === 'offline' || connectionStatus === 'stale'
  useEffect(() => {
    if (connectionStatus === 'live') lastLiveAt.current = Date.now()
  })
  if (!down) return null
  const asOf = new Date(lastLiveAt.current).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="tb-sync-notice" role="alert">
      <WifiOff aria-hidden="true" />
      <span><strong>Masalar şu an güncellenmiyor.</strong> Gördüğün durum {asOf} itibarıyla. Yeni siparişler gelmiş olabilir.</span>
      <button type="button" onClick={onRetry}>Yeniden bağlan</button>
    </div>
  )
}

/** A quick action that failed: stays until dismissed or retried, never fades on its own. */
export function TablesActionFailureToast({ failure, onDismiss }: { failure: { message: string; retry: () => void } | null; onDismiss: () => void }) {
  if (!failure) return null
  return (
    <div className="tb-action-failure" role="alert">
      <TriangleAlert aria-hidden="true" />
      <span>{failure.message}</span>
      <button type="button" onClick={() => { onDismiss(); failure.retry() }}>Tekrar dene</button>
      <button type="button" className="is-icon" aria-label="Bildirimi kapat" onClick={onDismiss}><X /></button>
    </div>
  )
}
