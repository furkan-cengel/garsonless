import type { Order } from '../orders/useOrdersRealtime'

export function isPendingCustomerOrder(order: Pick<Order, 'source' | 'status'>) {
  return order.source !== 'staff' && (order.status === 'pending' || order.status === 'pending_approval')
}
export function enqueueOrderAlert(queue: Order[], order: Order): Order[] {
  if (!isPendingCustomerOrder(order) || queue.some((item) => item.id === order.id)) return queue
  return [...queue, order]
}

export function resolveOrderAlert(queue: Order[], orderId: string): Order[] {
  return queue.filter((order) => order.id !== orderId)
}
