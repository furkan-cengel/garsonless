// These are domain semantics, not generated database types. Keep concrete
// runtime bindings here temporarily so existing browser consumers retain their
// import path while the strangler migration moves them to @garsonless/domain.
// A direct re-export confused Next's development module graph across the
// workspace boundary, making these values appear absent after a cold restart.
import {
  ORDER_STATUS_TRANSITIONS as domainOrderStatusTransitions,
  canTransitionOrderStatus as domainCanTransitionOrderStatus,
} from '@garsonless/domain/orders'

export const ORDER_STATUS_TRANSITIONS = domainOrderStatusTransitions
export const canTransitionOrderStatus = domainCanTransitionOrderStatus
export type { OrderStatus, PaymentMethod } from '@garsonless/domain/orders'

export type { RestaurantPlan } from '@garsonless/domain/entitlements'

// How an order was settled (orders.payment_method). null = unpaid OR legacy-paid.
// 'comp' (İkram) is settled but ₺0 COLLECTED — excluded from ciro, reportable
// separately. 'split' means the order was covered by payment_shares; the share
// ledger is the source of truth for card/cash sub-breakdown.
