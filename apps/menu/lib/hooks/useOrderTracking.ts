'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { orderStatusPhase } from '@garsonless/ui'
import type { OrderSummaryItem } from '@garsonless/ui'
import type { OrderStatus } from '@garsonless/db/types'
import { useOrderStore } from '../store/useOrderStore'

interface UseOrderTrackingOptions {
  restaurantId: string
  tableToken: string | null
  sessionId: string
  memberActive: boolean
  onMemberActivity: () => void
}

interface StartTrackingOptions {
  orderId: string
  items: OrderSummaryItem[]
  total: number
  view: 'sheet' | 'bubble'
}

interface UseOrderTrackingResult {
  orderId: string | null
  orderStatus: OrderStatus | null
  orderMeta: {
    items: OrderSummaryItem[]
    total: number
    createdAt: string
    paid: boolean
  } | null
  orderView: 'sheet' | 'bubble' | null
  isPlacing: boolean
  orderError: string | null
  sheetClosing: boolean
  unseen: number
  toastPhase: number | null
  bubbleWiggle: boolean
  setIsPlacing: (isPlacing: boolean) => void
  setError: (message: string | null) => void
  setOrderView: (view: 'sheet' | 'bubble' | null) => void
  subscribeRealtime: (
    orderId: string,
    onStatusChange: (status: OrderStatus, paidAt: string | null) => void,
  ) => () => void
  startTracking: (options: StartTrackingOptions) => void
  openOrderSheet: () => void
  handleSheetClose: () => void
  markPaidAndOpenSheet: () => void
}

/** Owns persisted order reconciliation and minimized-order presentation state. */
export function useOrderTracking({
  restaurantId,
  tableToken,
  sessionId,
  memberActive,
  onMemberActivity,
}: UseOrderTrackingOptions): UseOrderTrackingResult {
  const orderId = useOrderStore((state) => state.orderId)
  const orderStatus = useOrderStore((state) => state.status)
  const orderMeta = useOrderStore((state) => state.meta)
  const orderView = useOrderStore((state) => state.view)
  const isPlacing = useOrderStore((state) => state.isPlacing)
  const orderError = useOrderStore((state) => state.error)
  const setOrder = useOrderStore((state) => state.setOrder)
  const setOrderStatus = useOrderStore((state) => state.setStatus)
  const setOrderMeta = useOrderStore((state) => state.setMeta)
  const setOrderView = useOrderStore((state) => state.setView)
  const setIsPlacing = useOrderStore((state) => state.setIsPlacing)
  const setError = useOrderStore((state) => state.setError)
  const resetOrder = useOrderStore((state) => state.reset)

  const [sheetClosing, setSheetClosing] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [toastPhase, setToastPhase] = useState<number | null>(null)
  const [bubbleWiggle, setBubbleWiggle] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousPhaseRef = useRef<number | null>(null)

  const subscribeRealtime = useCallback(
    (currentOrderId: string, onStatusChange: (status: OrderStatus, paidAt: string | null) => void) => {
      let active = true
      let lastStatus = ''
      const poll = async () => {
        try {
          if (!tableToken) return
          const response = await fetch(
            `/api/orders/status?orderId=${encodeURIComponent(currentOrderId)}&sessionId=${encodeURIComponent(sessionId)}&tableToken=${encodeURIComponent(tableToken)}`,
            { cache: 'no-store' },
          )
          const payload = await response.json() as {
            success: boolean
            data?: { status: OrderStatus; paid_at: string | null }
          }
          if (active && payload.success && payload.data && payload.data.status !== lastStatus) {
            lastStatus = payload.data.status
            onStatusChange(payload.data.status, payload.data.paid_at)
          }
        } catch {
          // A later poll reconciles transient network failures.
        }
      }
      void poll()
      const timer = window.setInterval(() => void poll(), 3_000)
      return () => {
        active = false
        window.clearInterval(timer)
      }
    },
    [sessionId, tableToken],
  )

  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      await useOrderStore.persist.rehydrate()
      if (cancelled) return
      useOrderStore.getState().bindScope(restaurantId, tableToken)
      const state = useOrderStore.getState()
      if (!state.orderId) return
      if (state.view === 'sheet') state.setView('bubble')

      const tooOld = !state.meta?.createdAt
        || Date.now() - new Date(state.meta.createdAt).getTime() > 6 * 3_600_000
      if (tooOld) {
        state.reset()
        return
      }
      if (!tableToken) return

      const response = await fetch(
        `/api/orders/status?orderId=${encodeURIComponent(state.orderId)}&sessionId=${encodeURIComponent(sessionId)}&tableToken=${encodeURIComponent(tableToken)}`,
      )
      const payload = await response.json() as {
        success: boolean
        data?: { status: string; paid_at: string | null }
      }
      if (cancelled) return

      const row = payload.success ? payload.data ?? null : null
      const fetchedStatus = row?.status as OrderStatus | undefined
      if (!fetchedStatus || fetchedStatus === 'served' || fetchedStatus === 'cancelled') {
        useOrderStore.getState().reset()
        return
      }
      previousPhaseRef.current = orderStatusPhase(fetchedStatus)
      useOrderStore.getState().setStatus(fetchedStatus)
      if (row?.paid_at) {
        const { meta, setMeta } = useOrderStore.getState()
        if (meta && !meta.paid) setMeta({ ...meta, paid: true })
      }
      useOrderStore.getState().setView('bubble')
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [restaurantId, sessionId, tableToken])

  useEffect(() => {
    if (!orderId) return
    return subscribeRealtime(orderId, (nextStatus, paidAt) => {
      setOrderStatus(nextStatus)
      if (paidAt) {
        const { meta, setMeta } = useOrderStore.getState()
        if (meta && !meta.paid) setMeta({ ...meta, paid: true })
      }
      if (memberActive) onMemberActivity()
    })
  }, [orderId, subscribeRealtime, setOrderStatus, memberActive, onMemberActivity])

  useEffect(() => {
    if (!orderStatus || orderStatus === 'cancelled') {
      previousPhaseRef.current = null
      return
    }
    const phase = orderStatusPhase(orderStatus)
    const previousPhase = previousPhaseRef.current
    previousPhaseRef.current = phase
    if (previousPhase === null || phase <= previousPhase || orderView !== 'bubble') return

    setUnseen((current) => current + 1)
    setToastPhase(phase)
    setBubbleWiggle(true)
    if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current)
    wiggleTimerRef.current = setTimeout(() => setBubbleWiggle(false), 650)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastPhase(null), 4_200)
  }, [orderStatus, orderView])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  const startTracking = useCallback(({ orderId: nextOrderId, items, total, view }: StartTrackingOptions) => {
    setOrderMeta({ items, total, createdAt: new Date().toISOString(), paid: false })
    setOrder(nextOrderId)
    setOrderView(view)
    previousPhaseRef.current = 0
  }, [setOrder, setOrderMeta, setOrderView])

  const openOrderSheet = useCallback(() => {
    setUnseen(0)
    setToastPhase(null)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setSheetClosing(false)
    setOrderView('sheet')
  }, [setOrderView])

  const handleSheetClose = useCallback(() => {
    const finished = orderStatus === 'served' || orderStatus === 'cancelled'
    if (finished) {
      resetOrder()
      setUnseen(0)
      setToastPhase(null)
      previousPhaseRef.current = null
      return
    }
    setSheetClosing(true)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setSheetClosing(false)
      setOrderView('bubble')
    }, 340)
  }, [orderStatus, resetOrder, setOrderView])

  const markPaidAndOpenSheet = useCallback(() => {
    const currentMeta = useOrderStore.getState().meta
    if (currentMeta) setOrderMeta({ ...currentMeta, paid: true })
    setOrderView('sheet')
  }, [setOrderMeta, setOrderView])

  return {
    orderId,
    orderStatus,
    orderMeta,
    orderView,
    isPlacing,
    orderError,
    sheetClosing,
    unseen,
    toastPhase,
    bubbleWiggle,
    setIsPlacing,
    setError,
    setOrderView,
    subscribeRealtime,
    startTracking,
    openOrderSheet,
    handleSheetClose,
    markPaidAndOpenSheet,
  }
}
