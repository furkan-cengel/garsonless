export type NotificationReceiptStore = Pick<Storage, 'getItem' | 'setItem'>

const RECEIPT_PREFIX = 'masabu:order-notification'

export function orderNotificationReceiptKey(restaurantId: string, orderId: string): string {
  return `${RECEIPT_PREFIX}:${restaurantId}:${orderId}`
}

/**
 * Claims a browser-notification delivery once per tab session. Realtime may
 * reconnect and React effects may rerun after preference changes; neither
 * should play the sound or show the same operating-system notification twice.
 */
export function claimOrderNotificationDelivery(
  restaurantId: string,
  orderId: string,
  inMemoryReceipts: Set<string>,
  store?: NotificationReceiptStore,
): boolean {
  const key = orderNotificationReceiptKey(restaurantId, orderId)
  if (inMemoryReceipts.has(key)) return false

  try {
    if (store?.getItem(key) === '1') {
      inMemoryReceipts.add(key)
      return false
    }
    store?.setItem(key, '1')
  } catch {
    // Privacy modes may reject sessionStorage. The in-memory receipt still
    // prevents duplicate effects for the lifetime of this mounted board.
  }

  inMemoryReceipts.add(key)
  return true
}
