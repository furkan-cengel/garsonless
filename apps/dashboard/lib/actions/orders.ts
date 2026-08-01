'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import {
  cancelDashboardOrder,
  createDashboardOrder,
  transitionDashboardOrder,
} from '@garsonless/application/orders'
import {
  finalizeIyzicoOrderRefund,
  markIyzicoOrderRefundUnsuccessful,
  recordManualOrderRefund,
  reserveIyzicoOrderRefund,
} from '@garsonless/application/refunds'
import { startOfDayNDaysAgo } from '@garsonless/db/browser'
import {
  createDashboardOrderPort,
  createDashboardOrderLifecyclePort,
  createOrderRefundPort,
  readIyzicoCredentialRecord,
} from '@garsonless/db/server'
import type { Json } from '@garsonless/db/types'
import type { OrderLifecycleTarget } from '@garsonless/domain/orders'
import { assertAccess, assertOwner } from '../auth/access'
import { getRestaurantTimezone } from '../queries/insights-shared'
import {
  dashboardAccessFailure,
  dashboardActionFailure,
  dashboardOrderFailure,
  type DashboardActionFailure,
} from '../server-action-error'
import {
  IyzicoRefundRejectedError,
  IyzicoRefundUncertainError,
  requestVerifiedIyzicoRefund,
} from '../iyzico-order-refund'

const IYZICO_SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const IYZICO_LIVE_URL = 'https://api.iyzipay.com'

// 'cancelled' is deliberately NOT in this enum — cancellation has payment rules
// (İyzico block, required reason for cash/pos-paid) and audit stamping, owned
// by the dedicated cancelOrder action below.
const schema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    'sent_to_kitchen',
    'preparing',
    'ready',
    'served',
  ]),
  restaurantId: z.string().uuid(),
})

export async function updateOrderStatus(
  orderId: string,
  status: OrderLifecycleTarget,
  restaurantId: string,
): Promise<DashboardActionFailure | { success: true }> {
  const parsed = schema.safeParse({ orderId, status, restaurantId })
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'orders.update-status' })

  // The adapter resolves the user; application re-checks tenant + permission
  // before the package-private atomic repository primitive can be reached.
  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'orders.update-status')

  try {
    const result = await transitionDashboardOrder(
      {
        actor: 'dashboard-member',
        userId: gate.userId,
        restaurantId,
        permissions: ['orders'],
        isOwner: gate.access.isOwner,
      },
      { orderId, status, restaurantId },
      createDashboardOrderLifecyclePort(),
    )
    if (!result.ok) return dashboardOrderFailure(result.error, 'orders.update-status')
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'orders.update-status', cause })
  }

  revalidatePath(`/dashboard/${restaurantId}/orders`)
  return { success: true }
}

const cancelSchema = z.object({
  orderId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  reason: z.string().trim().max(200).optional(),
})

/**
 * THE dashboard cancel path. Rules by payment state:
 *  - İyzico-paid or split-paid → BLOCKED (typed error; refund/adjustment needs
 *    the provider/share ledger path). Also enforced atomically by the DB port.
 *  - cash/pos-paid → reason REQUIRED (min 3 chars): money was collected and is
 *    being refunded in person — the decision must be recorded.
 *  - unpaid → plain cancel (reason optional), loyalty refund identical to before.
 * cancelled_by = the acting staff user (audit), like settled_by on settlements.
 */
export async function cancelOrder(
  orderId: string,
  restaurantId: string,
  reason?: string,
): Promise<DashboardActionFailure | { success: true }> {
  const parsed = cancelSchema.safeParse({ orderId, restaurantId, reason })
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'orders.cancel' })

  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'orders.cancel')

  try {
    const result = await cancelDashboardOrder(
      {
        actor: 'dashboard-member',
        userId: gate.userId,
        restaurantId,
        permissions: ['orders'],
        isOwner: gate.access.isOwner,
      },
      { orderId, restaurantId, reason: parsed.data.reason },
      createDashboardOrderLifecyclePort(),
    )
    if (!result.ok) return dashboardOrderFailure(result.error, 'orders.cancel')
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'orders.cancel', cause })
  }

  revalidatePath(`/dashboard/${restaurantId}/orders`)
  return { success: true }
}

const refundSchema = z.object({
  orderId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  method: z.enum(['cash', 'pos', 'iyzico']),
  amount: z.number().positive().max(1_000_000)
    .refine((value) => Math.round(value * 100) === value * 100, 'Tutar en fazla iki ondalık basamak içermeli'),
  reason: z.string().trim().min(3).max(200),
  requestId: z.string().uuid(),
})

export type RecordOrderRefundResult =
  | { success: true; refundId: string; status: 'succeeded' }
  | { error: string; code?: 'PROVIDER_REJECTED' | 'RECONCILIATION_REQUIRED' | 'VALIDATION_FAILED' | 'NOT_AUTHORIZED' }

function publicRefundError(error: string): string {
  const normalized = error.toLocaleLowerCase('tr-TR')
  if (normalized.includes('sipariş bulunamadı')) return 'Sipariş bulunamadı.'
  if (normalized.includes('kalan iade edilebilir')) return 'İade tutarı kalan iade edilebilir tutarı aşıyor.'
  if (normalized.includes('paymentid eşlemesi') || normalized.includes('ödeme eşlemesi')) {
    return 'Bu eski ödemenin İyzico kimliği kayıtlı değil; otomatik iade güvenle başlatılamaz.'
  }
  if (normalized.includes('yalnızca tahsil edilmiş')) return 'Siparişin ödeme yöntemi bu iade akışıyla uyuşmuyor.'
  return 'İade işlemi güvenli biçimde tamamlanamadı.'
}

/** Owner-entered cash / physical-POS refund. This never accepts iyzico. */
export async function recordManualRefund(input: z.infer<typeof refundSchema>): Promise<RecordOrderRefundResult> {
  const parsed = refundSchema.safeParse(input)
  if (!parsed.success || parsed.data.method === 'iyzico') return { error: 'Geçersiz manuel iade bilgisi', code: 'VALIDATION_FAILED' }

  const gate = await assertOwner(parsed.data.restaurantId)
  if ('error' in gate) return { error: gate.error, code: 'NOT_AUTHORIZED' }
  const port = createOrderRefundPort()
  const result = await recordManualOrderRefund(
    {
      actor: 'dashboard-member', userId: gate.userId, restaurantId: parsed.data.restaurantId,
      permissions: ['orders'], isOwner: true,
    },
    {
      orderId: parsed.data.orderId,
      restaurantId: parsed.data.restaurantId,
      method: parsed.data.method,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.requestId,
    },
    port,
  )
  if (!result.ok) return { error: publicRefundError(result.error) }
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/analytics`)
  return { success: true, refundId: result.value.id, status: 'succeeded' }
}

/** Owner initiates the operation, but the monetary ledger moves to succeeded
 * only after the iyzico SDK callback response passes field + HMAC verification. */
export async function refundIyzicoOrder(input: z.infer<typeof refundSchema>): Promise<RecordOrderRefundResult> {
  const parsed = refundSchema.safeParse(input)
  if (!parsed.success || parsed.data.method !== 'iyzico') return { error: 'Geçersiz İyzico iade bilgisi', code: 'VALIDATION_FAILED' }

  const gate = await assertOwner(parsed.data.restaurantId)
  if ('error' in gate) return { error: gate.error, code: 'NOT_AUTHORIZED' }
  const context = {
    actor: 'dashboard-member' as const, userId: gate.userId, restaurantId: parsed.data.restaurantId,
    permissions: ['orders'] as const, isOwner: true,
  }
  const port = createOrderRefundPort()
  const reserved = await reserveIyzicoOrderRefund(context, {
    orderId: parsed.data.orderId,
    restaurantId: parsed.data.restaurantId,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    idempotencyKey: parsed.data.requestId,
  }, port)
  if (!reserved.ok) return { error: publicRefundError(reserved.error) }
  if (reserved.value.replayed) {
    if (reserved.value.status === 'succeeded') return { success: true, refundId: reserved.value.id, status: 'succeeded' }
    return {
      error: reserved.value.status === 'pending_reconciliation'
        ? 'Bu iadenin sağlayıcı sonucu belirsiz; İyzico panelinden teyit edilmeden tekrar denenemez.'
        : 'Bu iade talebi daha önce işlendi. Yeni işlem için yeni bir talep oluşturun.',
      code: reserved.value.status === 'pending_reconciliation' ? 'RECONCILIATION_REQUIRED' : 'PROVIDER_REJECTED',
    }
  }
  if (!reserved.value.providerPaymentId) {
    return { error: 'İyzico ödeme eşlemesi bulunamadı', code: 'VALIDATION_FAILED' }
  }

  const credential = await readIyzicoCredentialRecord(parsed.data.restaurantId)
  if (credential.error || !credential.record) {
    await markIyzicoOrderRefundUnsuccessful(context, {
      refundId: reserved.value.id, orderId: parsed.data.orderId, restaurantId: parsed.data.restaurantId,
      status: 'failed', failureCode: 'credentials_missing', failureMessage: 'İyzico yapılandırması bulunamadı',
    }, port)
    return { error: 'İyzico yapılandırması bulunamadı', code: 'PROVIDER_REJECTED' }
  }

  try {
    const provider = await requestVerifiedIyzicoRefund({
      apiKey: credential.record.apiKey,
      secretKey: credential.record.secretKey,
      baseUrl: credential.record.mode === 'live' ? IYZICO_LIVE_URL : IYZICO_SANDBOX_URL,
    }, {
      refundId: reserved.value.id,
      providerPaymentId: reserved.value.providerPaymentId,
      amount: parsed.data.amount,
    })
    const finalized = await finalizeIyzicoOrderRefund(
      { actor: 'payment-provider', restaurantId: parsed.data.restaurantId, provider: 'iyzico' },
      {
        refundId: reserved.value.id,
        orderId: parsed.data.orderId,
        restaurantId: parsed.data.restaurantId,
        amount: provider.amount,
        providerPaymentId: provider.providerPaymentId,
        providerRefundRef: provider.providerRefundRef,
        idempotencyKey: parsed.data.requestId,
      },
      port,
    )
    if (!finalized.ok) {
      await markIyzicoOrderRefundUnsuccessful(context, {
        refundId: reserved.value.id, orderId: parsed.data.orderId, restaurantId: parsed.data.restaurantId,
        status: 'pending_reconciliation', failureCode: 'local_finalize_failed', failureMessage: publicRefundError(finalized.error),
      }, port)
      return { error: 'İyzico iadesi başarılı, yerel kayıt uzlaştırma bekliyor. Tekrar iade yapmayın.', code: 'RECONCILIATION_REQUIRED' }
    }
    revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
    revalidatePath(`/dashboard/${parsed.data.restaurantId}/analytics`)
    return { success: true, refundId: finalized.value.id, status: 'succeeded' }
  } catch (cause) {
    const rejected = cause instanceof IyzicoRefundRejectedError
    const status = rejected ? 'failed' : 'pending_reconciliation'
    const code = rejected ? cause.code : 'provider_result_uncertain'
    const message = cause instanceof Error ? cause.message : 'İyzico iade sonucu bilinmiyor'
    await markIyzicoOrderRefundUnsuccessful(context, {
      refundId: reserved.value.id, orderId: parsed.data.orderId, restaurantId: parsed.data.restaurantId,
      status, failureCode: code, failureMessage: message,
    }, port)
    if (cause instanceof IyzicoRefundUncertainError || !rejected) {
      return { error: message, code: 'RECONCILIATION_REQUIRED' }
    }
    return { error: message, code: 'PROVIDER_REJECTED' }
  }
}

export interface HistoryOrder {
  id: string
  table_id: string | null
  status: string
  items: Json
  total: number
  created_at: string
  paid_at: string | null
  payment_method: string | null
  customer_tier: Json | null
}

/**
 * Past served/cancelled orders (last 30 days) for the "Geçmiş siparişler" modal.
 * Owner OR a member with 'orders'; read through the RLS-scoped auth client.
 */
export async function getOrderHistory(
  restaurantId: string,
): Promise<DashboardActionFailure | { orders: HistoryOrder[]; truncated: boolean }> {
  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'orders.history')

  const supabase = await createDashboardServerClient()
  const since = startOfDayNDaysAgo(await getRestaurantTimezone(restaurantId), 30)

  const { data, error } = await supabase
    .from('orders')
    .select('id, table_id, status, items, total, created_at, paid_at, payment_method, customer_tier')
    .eq('restaurant_id', restaurantId)
    .in('status', ['served', 'cancelled'])
    .gte('created_at', since.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(201)

  if (error) return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'orders.history', cause: error })
  const rows = (data ?? []) as HistoryOrder[]
  return { orders: rows.slice(0, 200), truncated: rows.length > 200 }
}

const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid().nullable(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
    selectedModifiers: z.array(z.object({
      group_id: z.string(),
      option_id: z.string(),
      quantity: z.number().int().positive().optional(),
    })).optional(),
    removedIngredientIds: z.array(z.string()).optional(),
  })),
})

export async function createOrderFromDashboard(
  input: z.infer<typeof createOrderSchema>,
): Promise<DashboardActionFailure | { orderId: string }> {
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'orders.create' })

  const gate = await assertAccess(parsed.data.restaurantId, 'orders')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'orders.create')

  let orderId: string
  try {
    const result = await createDashboardOrder(
      {
        actor: 'dashboard-member',
        userId: gate.userId,
        restaurantId: parsed.data.restaurantId,
        permissions: ['orders'],
      },
      {
        restaurantId: parsed.data.restaurantId,
        tableId: parsed.data.tableId,
        lines: parsed.data.items,
      },
      createDashboardOrderPort(),
    )
    if (!result.ok) return dashboardOrderFailure(result.error, 'orders.create')
    orderId = result.value.orderId
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'orders.create', cause })
  }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { orderId }
}
