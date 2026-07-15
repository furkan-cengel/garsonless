// These are domain semantics, not generated database types. Re-export them
// here temporarily so existing consumers keep their import path while the
// strangler migration moves to @garsonless/domain/orders.
export {
  ORDER_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
} from '@garsonless/domain/orders'
export type { OrderStatus, PaymentMethod } from '@garsonless/domain/orders'

export type RestaurantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

// How an order was settled (orders.payment_method). null = unpaid OR legacy-paid.
// 'comp' (İkram) is settled but ₺0 COLLECTED — excluded from ciro, reportable
// separately. 'split' means the order was covered by payment_shares; the share
// ledger is the source of truth for card/cash sub-breakdown.
