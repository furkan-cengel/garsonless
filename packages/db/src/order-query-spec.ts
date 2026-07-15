import { COLLECTED_ORDER_SPEC } from '@garsonless/domain/orders'

/** Minimal structural contract shared by Supabase/PostgREST query builders. */
export interface CollectedOrderFilterBuilder<TSelf> {
  not(column: string, operator: string, value: unknown): TSelf
  neq(column: string, value: string): TSelf
  or(filters: string): TSelf
}

/** Translate the canonical domain specification to PostgREST filters. */
export function applyCollectedOrderFilter<T extends CollectedOrderFilterBuilder<T>>(query: T): T {
  let filtered = query

  if (COLLECTED_ORDER_SPEC.paidAtRequired) {
    filtered = filtered.not('paid_at', 'is', null)
  }
  for (const status of COLLECTED_ORDER_SPEC.excludedStatuses) {
    filtered = filtered.neq('status', status)
  }
  for (const method of COLLECTED_ORDER_SPEC.excludedPaymentMethods) {
    filtered = COLLECTED_ORDER_SPEC.includeNullPaymentMethod
      ? filtered.or(`payment_method.is.null,payment_method.neq.${method}`)
      : filtered.neq('payment_method', method)
  }

  return filtered
}
