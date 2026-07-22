import type { PaymentMethod } from './orders'
import type { SubscriptionStatus } from './billing'
import type { RestaurantPlan } from './entitlements'

export type DomainEventType =
  | 'order.created'
  | 'order.status_changed'
  | 'order.settled'
  | 'table_session.closed'
  | 'service_request.created'
  | 'customer.welcome_bonus_requested'
  | 'campaign.delivery_requested'
  | 'subscription.trial_started'
  | 'subscription.status_changed'
  | 'invoice.created'
  | 'invoice.payment_failed'
  | 'invoice.paid'
  | 'tenant.suspended'
  | 'tenant.reactivated'

export type DomainAggregateType =
  | 'order'
  | 'table_session'
  | 'service_request'
  | 'customer'
  | 'campaign'
  | 'billing_subscription'
  | 'billing_invoice'

interface EventBase<TType extends DomainEventType, TAggregate extends DomainAggregateType, TPayload> {
  id: string
  type: TType
  restaurantId: string
  aggregateType: TAggregate
  aggregateId: string
  payload: TPayload
  attempts: number
}
export type DomainEvent =
  | EventBase<'order.created', 'order', Record<string, unknown>>
  | EventBase<'order.status_changed', 'order', { from: string; to: string }>
  | EventBase<'order.settled', 'order', { paymentMethod: PaymentMethod | null; paidAt: string; total: number }>
  | EventBase<'table_session.closed', 'table_session', { tableId: string; closedAt: string; closeReason: string | null }>
  | EventBase<'service_request.created', 'service_request', Record<string, unknown>>
  | EventBase<'customer.welcome_bonus_requested', 'customer', { customerId: string }>
  | EventBase<'campaign.delivery_requested', 'campaign', { campaignId: string; createdBy: string | null; segmentLabel: string }>
  | EventBase<'subscription.trial_started', 'billing_subscription', { plan: RestaurantPlan; trialEndsAt: string }>
  | EventBase<'subscription.status_changed', 'billing_subscription', { from: SubscriptionStatus; to: SubscriptionStatus; reasonCode: string }>
  | EventBase<'invoice.created', 'billing_invoice', { subscriptionId: string; amountMinor: number; currency: 'TRY'; dueAt: string }>
  | EventBase<'invoice.payment_failed', 'billing_invoice', { subscriptionId: string; attemptId: string; failureCode: string | null }>
  | EventBase<'invoice.paid', 'billing_invoice', { subscriptionId: string; amountMinor: number; currency: 'TRY'; paidAt: string }>
  | EventBase<'tenant.suspended', 'billing_subscription', { reasonCode: string }>
  | EventBase<'tenant.reactivated', 'billing_subscription', { reasonCode: string }>

export type DurableConsumerName = 'loyalty-ledger' | 'campaign-sms'

export function consumerForDomainEvent(event: DomainEvent): DurableConsumerName | null {
  switch (event.type) {
    case 'order.settled':
    case 'order.status_changed':
    case 'table_session.closed':
    case 'customer.welcome_bonus_requested':
      return 'loyalty-ledger'
    case 'campaign.delivery_requested':
      return 'campaign-sms'
    default:
      return null
  }
}

export function shouldCreditLoyalty(event: DomainEvent): boolean {
  if (event.type === 'order.settled') return event.payload.paymentMethod !== 'comp'
  if (event.type === 'order.status_changed') return event.payload.to === 'served' || event.payload.to === 'cancelled'
  if (event.type === 'table_session.closed') return event.payload.closeReason == null
  return event.type === 'customer.welcome_bonus_requested'
}
