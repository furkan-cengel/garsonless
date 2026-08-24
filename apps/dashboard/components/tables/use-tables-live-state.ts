'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  closeTableSession,
  getOpenTableSessions,
  getTableDirectory,
} from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import {
  getPendingServiceRequests,
  resolveServiceRequest,
} from '../../lib/actions/service-requests'
import {
  applySessionsToTables,
  mapDBTables,
  removePendingRequest,
  requestsByTable,
  sessionRequiresSettlement,
  sessionsByTable,
} from './tables-builder-model'
import type { PendingTableRequestView, TableItem } from './tables-builder-types'
import { useTablesRealtimeChannel } from './use-tables-realtime-channel'

interface UseTablesLiveStateOptions {
  restaurantId: string
  initialOpenSessions: OpenSessionInfo[]
  initialSessionError: string | null
  initialDirectoryError: string | null
  setTables: Dispatch<SetStateAction<TableItem[]>>
}

export interface SettlementTarget {
  session: OpenSessionInfo
  label: string
}

export function useTablesLiveState({
  restaurantId,
  initialOpenSessions,
  initialSessionError,
  initialDirectoryError,
  setTables,
}: UseTablesLiveStateOptions) {
  const [openSessions, setOpenSessions] = useState<Record<string, OpenSessionInfo>>(
    () => sessionsByTable(initialOpenSessions),
  )
  const [sessionError, setSessionError] = useState<string | null>(initialSessionError)
  const [directoryError, setDirectoryError] = useState<string | null>(initialDirectoryError)
  const [settlementTarget, setSettlementTarget] = useState<SettlementTarget | null>(null)
  const [pendingRequests, setPendingRequests] = useState<Record<string, PendingTableRequestView[]>>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)
  const [sessionRetrying, setSessionRetrying] = useState(false)
  const [requestRetrying, setRequestRetrying] = useState(false)
  const [layoutInvalidation, setLayoutInvalidation] = useState(0)
  const sessionLoadSeq = useRef(0)
  const requestLoadSeq = useRef(0)
  const openSessionsRef = useRef(openSessions)
  openSessionsRef.current = openSessions

  const refreshSessions = useCallback(async () => {
    const seq = ++sessionLoadSeq.current
    try {
      const result = await getOpenTableSessions(restaurantId)
      if (seq !== sessionLoadSeq.current) return true
      if (!Array.isArray(result)) {
        setSessionError(result.error)
        return false
      }

      const nextSessions = sessionsByTable(result)
      openSessionsRef.current = nextSessions
      setSessionError(null)
      setOpenSessions(nextSessions)
      setTables((current) => applySessionsToTables(current, nextSessions))
      return true
    } catch {
      if (seq === sessionLoadSeq.current) setSessionError('Canlı masa durumu alınamadı. Lütfen tekrar deneyin.')
      return false
    }
  }, [restaurantId, setTables])

  const markSessionClosed = useCallback((sessionId: string) => {
    setOpenSessions((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([, session]) => session.sessionId !== sessionId),
      )
      openSessionsRef.current = next
      setTables((tables) => applySessionsToTables(tables, next))
      return next
    })
  }, [setTables])

  const refreshTableDirectory = useCallback(async () => {
    try {
      const result = await getTableDirectory(restaurantId)
      if (!Array.isArray(result)) {
        setDirectoryError(result.error)
        return false
      }
      setDirectoryError(null)
      setTables((current) => mapDBTables(
        result,
        Object.values(openSessionsRef.current),
        Object.fromEntries(current.flatMap((table) => table.qrToken ? [[table.id, table.qrToken]] : [])),
      ))
      return true
    } catch {
      setDirectoryError('Masa listesi güncellenemedi. Lütfen tekrar deneyin.')
      return false
    }
  }, [restaurantId, setTables])

  const refreshPendingRequests = useCallback(async () => {
    const seq = ++requestLoadSeq.current
    try {
      const result = await getPendingServiceRequests(restaurantId)
      if (seq !== requestLoadSeq.current) return true
      if (!Array.isArray(result)) {
        setRequestError(result.error)
        return false
      }

      setRequestError(null)
      setPendingRequests(requestsByTable(result))
      return true
    } catch {
      if (seq === requestLoadSeq.current) setRequestError('Servis istekleri alınamadı. Lütfen tekrar deneyin.')
      return false
    }
  }, [restaurantId])

  const reconcile = useCallback(async () => {
    const [sessionsOk, requestsOk, directoryOk] = await Promise.all([
      refreshSessions(),
      refreshPendingRequests(),
      refreshTableDirectory(),
    ])
    if (directoryOk) setLayoutInvalidation((generation) => generation + 1)
    return sessionsOk && requestsOk && directoryOk
  }, [refreshPendingRequests, refreshSessions, refreshTableDirectory])

  const onLayoutInvalidated = useCallback(() => {
    setLayoutInvalidation((generation) => generation + 1)
  }, [])
  const realtime = useTablesRealtimeChannel({
    restaurantId, reconcile, refreshSessions, refreshPendingRequests,
    refreshTableDirectory, onLayoutInvalidated,
  })

  const retrySessions = useCallback(async () => {
    if (sessionRetrying) return
    setSessionRetrying(true)
    const [sessionsOk, directoryOk] = await Promise.all([refreshSessions(), refreshTableDirectory()])
    const ok = sessionsOk && directoryOk
    if (directoryOk) setLayoutInvalidation((generation) => generation + 1)
    setSessionRetrying(false)
    if (ok) setFeedbackNotice('Masa durumları yenilendi.')
  }, [refreshSessions, refreshTableDirectory, sessionRetrying])

  const retryPendingRequests = useCallback(async () => {
    if (requestRetrying) return
    setRequestRetrying(true)
    const ok = await refreshPendingRequests()
    setRequestRetrying(false)
    if (ok) setFeedbackNotice('Servis istekleri yenilendi.')
  }, [refreshPendingRequests, requestRetrying])

  useEffect(() => {
    if (!feedbackNotice) return
    const timeout = window.setTimeout(() => setFeedbackNotice(null), 5_000)
    return () => window.clearTimeout(timeout)
  }, [feedbackNotice])

  const resolveRequest = useCallback(async (requestId: string) => {
    setRequestError(null)
    setFeedbackNotice(null)
    try {
      const result = await resolveServiceRequest(requestId, restaurantId)
      if ('error' in result) {
        setRequestError(result.error)
        void refreshPendingRequests()
        return
      }

      setPendingRequests((current) => removePendingRequest(current, requestId))
      setFeedbackNotice('Servis isteği tamamlandı.')
      void refreshPendingRequests()
    } catch {
      setRequestError('Servis isteği tamamlanamadı. Bağlantınızı kontrol edip listeyi yenileyin.')
    }
  }, [restaurantId, refreshPendingRequests])

  const requestSessionClose = useCallback(async (session: OpenSessionInfo, label: string) => {
    // Money remaining on the adisyon must enter the settlement flow. A fully
    // paid session can close directly through the same server-side guard.
    if (sessionRequiresSettlement(session)) {
      setSettlementTarget({ session, label })
      return
    }

    setFeedbackNotice(null)
    try {
      const result = await closeTableSession(session.sessionId, restaurantId)
      if ('error' in result) {
        setSessionError(result.error)
        return
      }
      markSessionClosed(session.sessionId)
      setFeedbackNotice(`${label} adisyonu kapatıldı.`)
      void refreshSessions()
    } catch {
      setSessionError('Adisyon kapatılamadı. Bağlantınızı kontrol edip masa durumunu yenileyin.')
    }
  }, [restaurantId, refreshSessions, markSessionClosed])

  const startSettlement = useCallback((session: OpenSessionInfo, label: string) => {
    setSettlementTarget({ session, label })
  }, [])

  return {
    openSessions,
    sessionError: sessionError ?? directoryError,
    reportSessionError: setSessionError,
    refreshSessions,
    markSessionClosed,
    settlementTarget,
    dismissSettlement: () => setSettlementTarget(null),
    requestSessionClose,
    startSettlement,
    pendingRequests,
    requestError,
    resolveRequest,
    feedbackNotice,
    dismissFeedbackNotice: () => setFeedbackNotice(null),
    sessionRetrying,
    requestRetrying,
    retrySessions,
    retryPendingRequests,
    connectionStatus: realtime.connectionStatus,
    retryRealtime: realtime.retryRealtime,
    layoutInvalidation,
  }
}
