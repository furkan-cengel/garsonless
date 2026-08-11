import { RefreshCw, X } from 'lucide-react'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TABLE_LATE_AFTER_MINUTES } from './tables-operation-model'
import { TABLES_REALTIME_COPY, type TablesRealtimeStatus } from './tables-realtime-model'

export function TablesNavigationHeader({
  tableCount,
  activeCount,
  lateCount,
  connectionStatus,
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
  const realtimeVariant = connectionStatus === 'live'
    ? 'positive'
    : connectionStatus === 'connecting'
      ? 'info'
      : connectionStatus === 'reconnecting'
        ? 'warning'
        : 'destructive'
  return (
    <div className="tb-tables__nav-header border-b px-4 pt-3.5 pb-3">
      <div className="mb-1 flex items-center gap-2">
        <div className="flex-1 text-sm font-semibold tracking-tight">Masalar</div>
        <Badge variant="outline" className="h-5 min-w-5 px-1.5 font-mono tabular-nums">{tableCount}</Badge>
        <Button className="tb-tables__nav-history" type="button" variant="ghost" size="xs" onClick={onOpenHistory}>Geçmiş</Button>
      </div>
      <div className="text-xs text-muted-foreground">
        {activeCount} açık · {lateCount} geciken · {TABLE_LATE_AFTER_MINUTES} dk eşik
      </div>
      <div className="mt-2 flex items-center gap-1.5" role="status" aria-live="polite">
        <Badge variant={realtimeVariant} className="h-5 max-w-full truncate px-1.5 text-[10.5px]">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
          {TABLES_REALTIME_COPY[connectionStatus]}
        </Badge>
        {connectionStatus !== 'live' && (
          <Button type="button" variant="ghost" size="xs" onClick={onRetryRealtime}><RefreshCw />Yenile</Button>
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
        <Alert variant="destructive" className="mx-3 mt-2 w-auto text-xs">
          <AlertDescription className="grid gap-1.5 text-xs">İstek tamamlanamadı: {requestError}<Button type="button" variant="outline" size="xs" disabled={requestRetrying} onClick={onRetryPendingRequests} className="w-fit">{requestRetrying && <Spinner data-icon="inline-start" />}İstek listesini yenile</Button></AlertDescription>
        </Alert>
      )}
      {sessionError && (
        <Alert variant="destructive" className="mx-3 mt-2 w-auto text-xs">
          <AlertDescription className="grid gap-1.5 text-xs">Masa durumu yenilenemedi: {sessionError}<Button type="button" variant="outline" size="xs" disabled={sessionRetrying} onClick={onRetrySessions} className="w-fit">{sessionRetrying && <Spinner data-icon="inline-start" />}Masa durumunu yeniden dene</Button></AlertDescription>
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
