'use client'

import { useCallback, useRef } from 'react'
import { formatTRY } from '@garsonless/ui/menu'
import type { CartItem, OrderSummaryItem } from '@garsonless/ui/menu'
import { readOrderApiResponse } from '../order-api-response'

interface StartTrackingOptions {
  orderId: string
  items: OrderSummaryItem[]
  total: number
  view: 'sheet' | 'bubble'
}

interface UseMenuCheckoutOptions {
  restaurantSlug: string
  tableToken: string | null
  sessionId: string
  cartItems: CartItem[]
  subtotal: () => number
  redeemPoints: number
  claimStamp: boolean
  catalogItemId: string | null
  previewTotal: number | null
  memberActive: boolean
  setIsPlacing: (isPlacing: boolean) => void
  setError: (message: string | null) => void
  startTracking: (options: StartTrackingOptions) => void
  refreshBill: () => Promise<unknown>
  refetchBalances: () => Promise<void>
  clearCart: () => void
  clearRedemption: () => void
  closeCart: () => void
  onPaymentReady: (orderId: string, total: number) => void
}

const CHECKOUT_UNAVAILABLE_MESSAGE = 'Sipariş vermek için masadaki QR kodunu okutun.'

class OrderResponseError extends Error {}

function snapshotOrderItems(cartItems: CartItem[]): OrderSummaryItem[] {
  return cartItems.map((item) => ({
    quantity: item.quantity,
    name: item.name,
    unitPrice: item.price + item.modifiersPriceDelta,
    modifierNames: item.modifierNames,
    removedIngredientNames: item.removedIngredientNames,
    ...(item.productNote ? { productNote: item.productNote } : {}),
    ...(item.originalPrice !== undefined && item.originalPrice !== item.price
      ? { originalPrice: item.originalPrice + item.modifiersPriceDelta }
      : {}),
  }))
}

/** Owns idempotent order creation and the pay-now/pay-later transition. */
export function useMenuCheckout({
  restaurantSlug,
  tableToken,
  sessionId,
  cartItems,
  subtotal,
  redeemPoints,
  claimStamp,
  catalogItemId,
  previewTotal,
  memberActive,
  setIsPlacing,
  setError,
  startTracking,
  refreshBill,
  refetchBalances,
  clearCart,
  clearRedemption,
  closeCart,
  onPaymentReady,
}: UseMenuCheckoutOptions) {
  const orderRequestRef = useRef<string | null>(null)

  const createOrder = useCallback(async () => {
    const requestId = orderRequestRef.current ?? crypto.randomUUID()
    orderRequestRef.current = requestId
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: restaurantSlug,
        tableToken,
        sessionId,
        requestId,
        items: cartItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          selectedModifiers: item.modifiers,
          removedIngredientIds: item.removedIngredientIds,
          ...(item.productNote ? { productNote: item.productNote } : {}),
          ...(item.recommendationSourceItemId
            ? { recommendationSourceItemId: item.recommendationSourceItemId }
            : {}),
          ...(item.combo ? { combo: item.combo } : {}),
          ...(item.promotion ? { promotion: item.promotion } : {}),
        })),
        redeemPoints,
        redeemStampClaim: claimStamp,
        catalogItemId,
      }),
    })
    const payload = await readOrderApiResponse(response)
    if (!payload.success || !payload.data) {
      if (response.status < 500) orderRequestRef.current = null
      throw new OrderResponseError(payload.error ?? 'Sipariş oluşturulamadı.')
    }
    orderRequestRef.current = null
    return payload.data
  }, [restaurantSlug, tableToken, sessionId, cartItems, redeemPoints, claimStamp, catalogItemId])

  const finishCart = useCallback(() => {
    if (memberActive) void refetchBalances()
    clearCart()
    clearRedemption()
    closeCart()
  }, [memberActive, refetchBalances, clearCart, clearRedemption, closeCart])

  const handlePlaceOrder = useCallback(async () => {
    if (cartItems.length === 0) return
    if (!tableToken) {
      setError(CHECKOUT_UNAVAILABLE_MESSAGE)
      return
    }
    setError(null)
    setIsPlacing(true)
    const summaryItems = snapshotOrderItems(cartItems)
    try {
      const order = await createOrder()
      startTracking({
        orderId: order.orderId,
        items: summaryItems,
        total: order.breakdown.finalTotal,
        view: 'sheet',
      })
      void refreshBill()
      finishCart()
    } catch (error) {
      setError(error instanceof OrderResponseError
        ? error.message
        : 'Sipariş sunucuya ulaştırılamadı. Tekrar deneyebilirsiniz.')
    } finally {
      setIsPlacing(false)
    }
  }, [cartItems, tableToken, setError, setIsPlacing, createOrder, startTracking, refreshBill, finishCart])

  const handlePayClick = useCallback(async () => {
    if (cartItems.length === 0) return
    if (!tableToken) {
      setError(CHECKOUT_UNAVAILABLE_MESSAGE)
      return
    }
    setError(null)
    setIsPlacing(true)
    const summaryItems = snapshotOrderItems(cartItems)
    const amountShownToCustomer = previewTotal ?? subtotal()
    try {
      const order = await createOrder()
      const finalTotal = order.breakdown.finalTotal
      if (order.breakdown.clamped && finalTotal > amountShownToCustomer) {
        const confirmed = window.confirm(
          `Puan bakiyen değiştiği için tutar güncellendi.\nYeni tutar: ${formatTRY(finalTotal)}\nÖdemeye devam edilsin mi?`,
        )
        if (!confirmed) {
          startTracking({ orderId: order.orderId, items: summaryItems, total: finalTotal, view: 'sheet' })
          finishCart()
          return
        }
      }

      startTracking({ orderId: order.orderId, items: summaryItems, total: finalTotal, view: 'bubble' })
      void refreshBill()
      finishCart()
      onPaymentReady(order.orderId, finalTotal)
    } catch (error) {
      setError(error instanceof OrderResponseError
        ? error.message
        : 'Sipariş sunucuya ulaştırılamadı. Tekrar deneyebilirsiniz.')
    } finally {
      setIsPlacing(false)
    }
  }, [
    cartItems,
    tableToken,
    setError,
    setIsPlacing,
    previewTotal,
    subtotal,
    createOrder,
    startTracking,
    refreshBill,
    finishCart,
    onPaymentReady,
  ])

  return {
    checkoutUnavailableMessage: CHECKOUT_UNAVAILABLE_MESSAGE,
    handlePlaceOrder,
    handlePayClick,
  }
}
