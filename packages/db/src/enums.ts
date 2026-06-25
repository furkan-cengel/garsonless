// Hand-maintained domain enums. types.gen.ts is overwritten by `pnpm types:gen`
// (DB columns are plain text with check constraints), so these unions live here.
// Source of truth: 20260517000000_initial_schema.sql check constraints
// + 'paid' used by the İyzico payment callback (Sprint 6).

export type OrderStatus =
  | 'pending'
  | 'pending_approval'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled'

export type RestaurantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

// How an order was settled (orders.payment_method). null = unpaid OR legacy-paid.
// 'comp' (İkram) is settled but ₺0 COLLECTED — excluded from ciro, reportable
// separately. Source of truth: 20260625000000_payment_method_settle.sql.
export type PaymentMethod = 'iyzico' | 'cash' | 'pos' | 'comp'
