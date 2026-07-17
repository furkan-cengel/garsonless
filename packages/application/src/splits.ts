import type { CommandContext, Result } from '@garsonless/domain'
import { err, hasSameRestaurant, ok } from '@garsonless/domain'

export interface SplitAssignedItem {
  orderId: string
  itemId: string
}

export interface SplitOrderSnapshot {
  id: string
  total: number
  items: unknown
}

export interface SplitDeclarationSnapshot {
  orders: SplitOrderSnapshot[]
  settledTotal: number
}

export interface SplitPaymentPort {
  readDeclarationSnapshot(input: {
    restaurantId: string
    tableId: string
    tableSessionId: string
  }): Promise<Result<SplitDeclarationSnapshot>>
  createDeclaredShare(input: {
    restaurantId: string
    tableSessionId: string
    amount: number
    method: 'iyzico' | 'cash'
    customerId: string | null
    label: string | null
    assignedItems: SplitAssignedItem[] | null
  }): Promise<Result<{ shareId: string }>>
  reserveOnlineCheckout(input: {
    restaurantId: string
    tableId: string
    shareId: string
  }): Promise<Result<{
    amount: number
    restaurantSettings: unknown
  }>>
  releaseOnlineCheckout(input: {
    restaurantId: string
    shareId: string
  }): Promise<Result<true>>
  settleShare(input: {
    restaurantId: string
    shareId: string
    settledBy: string | null
    expectedMethod: 'iyzico' | 'cash'
  }): Promise<Result<{ finalized: boolean; amount: number; idempotent: boolean }>>
}

interface StoredOrderLine {
  itemId?: unknown
  price?: unknown
  quantity?: unknown
  modifiersPriceDelta?: unknown
}

const money = (value: number) => Math.round(value * 100) / 100

function totalOfOrders(orders: SplitOrderSnapshot[]): number {
  return money(orders.reduce((sum, order) => sum + (Number.isFinite(order.total) ? order.total : 0), 0))
}

function assignedItemsTotal(orders: SplitOrderSnapshot[], assignedItems: SplitAssignedItem[]): number {
  let total = 0
  const uniqueRefs = new Set(assignedItems.map((item) => `${item.orderId}:${item.itemId}`))
  for (const ref of uniqueRefs) {
    const separator = ref.indexOf(':')
    const orderId = ref.slice(0, separator)
    const itemId = ref.slice(separator + 1)
    const order = orders.find((row) => row.id === orderId)
    if (!order || !Array.isArray(order.items)) continue
    for (const raw of order.items as StoredOrderLine[]) {
      if (raw.itemId !== itemId) continue
      const price = typeof raw.price === 'number' ? raw.price : 0
      const delta = typeof raw.modifiersPriceDelta === 'number' ? raw.modifiersPriceDelta : 0
      const quantity = typeof raw.quantity === 'number' && raw.quantity > 0 ? raw.quantity : 1
      total += Math.max(0, price + delta) * quantity
    }
  }
  return money(total)
}

/** Declares one server-authoritative share. Duplicate item references are
 * collapsed and every share is capped at the amount still owed. */
export async function declareSplitShare(
  context: Extract<CommandContext, { actor: 'table-guest' }>,
  input: {
    restaurantId: string
    tableSessionId: string
    method: 'iyzico' | 'cash'
    amount?: number
    assignedItems?: SplitAssignedItem[]
    customerId: string | null
    label?: string | null
  },
  port: SplitPaymentPort,
): Promise<Result<{ shareId: string; amount: number }>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Invalid table context')
  const snapshot = await port.readDeclarationSnapshot({
    restaurantId: input.restaurantId,
    tableId: context.tableId,
    tableSessionId: input.tableSessionId,
  })
  if (!snapshot.ok) return snapshot

  const remaining = money(totalOfOrders(snapshot.value.orders) - snapshot.value.settledTotal)
  if (remaining <= 0) return err('Hesap zaten kapandı')
  const assigned = input.assignedItems?.length ? input.assignedItems : null
  const requested = assigned
    ? assignedItemsTotal(snapshot.value.orders, assigned)
    : typeof input.amount === 'number' ? input.amount : 0
  const amount = money(Math.min(requested, remaining))
  if (amount <= 0) return err(assigned ? 'Seçili kalemlerden tutar çıkmadı' : 'Tutar gerekli')

  const created = await port.createDeclaredShare({
    restaurantId: input.restaurantId,
    tableSessionId: input.tableSessionId,
    amount,
    method: input.method,
    customerId: input.customerId,
    label: input.label ?? null,
    assignedItems: assigned,
  })
  return created.ok ? ok({ shareId: created.value.shareId, amount }) : created
}

/** Reserves the provider charge atomically against the persisted session
 * balance. Concurrent checkouts for the same table therefore cannot reserve
 * the same money twice. */
export async function prepareSplitCheckout(
  context: Extract<CommandContext, { actor: 'table-guest' }>,
  input: { restaurantId: string; shareId: string },
  port: SplitPaymentPort,
): Promise<Result<{ amount: number; restaurantSettings: unknown }>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Invalid table context')
  return port.reserveOnlineCheckout({
    restaurantId: input.restaurantId,
    tableId: context.tableId,
    shareId: input.shareId,
  })
}

/** Releases an unbound checkout reservation. Once a provider token has been
 * attached the DB refuses release, because real money may still arrive. */
export async function releaseSplitCheckout(
  context: Extract<CommandContext, { actor: 'table-guest' }>,
  input: { restaurantId: string; shareId: string },
  port: SplitPaymentPort,
): Promise<Result<true>> {
  if (!hasSameRestaurant(context, input.restaurantId)) return err('Invalid table context')
  return port.releaseOnlineCheckout(input)
}

export async function confirmDashboardCashShare(
  context: Extract<CommandContext, { actor: 'dashboard-member' }>,
  input: { restaurantId: string; shareId: string },
  port: SplitPaymentPort,
): Promise<Result<{ finalized: boolean; amount: number; idempotent: boolean }>> {
  if (!hasSameRestaurant(context, input.restaurantId) || !context.permissions.includes('tables')) {
    return err('Not authorized')
  }
  return port.settleShare({
    ...input,
    settledBy: context.userId,
    expectedMethod: 'cash',
  })
}

export async function settleProviderShare(
  context: Extract<CommandContext, { actor: 'payment-provider' }>,
  input: { restaurantId: string; shareId: string },
  port: SplitPaymentPort,
): Promise<Result<{ finalized: boolean; amount: number; idempotent: boolean }>> {
  if (!hasSameRestaurant(context, input.restaurantId) || context.provider !== 'iyzico') {
    return err('Not authorized')
  }
  return port.settleShare({
    ...input,
    settledBy: null,
    expectedMethod: 'iyzico',
  })
}
