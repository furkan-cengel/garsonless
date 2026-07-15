import { notFound } from 'next/navigation'
import { getRestaurantById, getRestaurantTimezone } from '../../../../lib/queries'
import { startOfRestaurantDay } from '@garsonless/db'
import { readOrdersBoard } from '@garsonless/application/read-models'
import { createOrdersBoardReadModelPort } from '@garsonless/db/server'
import OrderBoard from '../../../../components/orders/OrderBoard'
import type { Order } from '../../../../components/orders/useOrdersRealtime'
import { readNotificationPrefs } from '../../../../lib/notification-prefs'
import { readLateThresholdMin } from '../../../../lib/orders-prefs'
import { assertAccess, requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function OrdersPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'orders')
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()

  // Restaurant-local "today" — the board scopes to the café's own day, not the
  // server's (consistent with every reporting query).
  const today = startOfRestaurantDay(await getRestaurantTimezone(restaurantId))
  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) throw new Error(gate.error)
  const board = await readOrdersBoard(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['orders'] },
    { restaurantId, since: today.toISOString() },
    createOrdersBoardReadModelPort(),
  )
  if (!board.ok) throw new Error(board.error)

  const settings = (restaurant.settings as Record<string, unknown> | null) ?? {}
  const receiptTax = typeof settings['tax'] === 'object' && settings['tax'] !== null && !Array.isArray(settings['tax'])
    ? settings['tax'] as Record<string, unknown>
    : null

  return (
    <OrderBoard
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initialOrders={board.value.orders as Order[]}
      tables={board.value.tables}
      kitchenToken={board.value.kitchenToken}
      receiptTax={receiptTax}
      notifPrefs={readNotificationPrefs(restaurant.settings)}
      lateThresholdMin={readLateThresholdMin(restaurant.settings)}
      initialSince={today.toISOString()}
    />
  )
}
