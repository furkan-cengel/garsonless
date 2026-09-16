import type { RestaurantAddOn } from '@garsonless/domain/entitlements'
import type {
  AddOnReturnContext,
  AddOnPurchaseStatus,
} from '@garsonless/domain/add-on-purchases'

export type AddOnPurchase = {
  id: string
  restaurantId: string
  addOn: RestaurantAddOn
  status: AddOnPurchaseStatus
  netAmountMinor: number
  totalAmountMinor: number
  vatRate: number
  currency: 'TRY'
  token: string | null
  paymentPageUrl: string | null
  returnContext: AddOnReturnContext
  profile: {
    legalName: string
    name: string
    surname: string
    identityNumber: string
    email: string
    gsmNumber: string
    billingAddress: Record<string, unknown>
  }
}
export type AddOnPaymentEvidence = {
  token: string
  paymentId: string
  basketId: string
  conversationId: string
  totalAmountMinor: number
  currency: string
  status: 'paid' | 'review' | 'failed'
  refundedAmountMinor: number
  chargeback: boolean
}
export class AddOnInitializationRejected extends Error {}
export interface AddOnPurchasePort {
  prepare(input: {
    restaurantId: string
    userId: string
    addOn: RestaurantAddOn
    priceVersion: number
    requestId: string
    returnContext: AddOnReturnContext
  }): Promise<{ purchase: AddOnPurchase; dispatchable: boolean }>
  failInitialization(id: string): Promise<void>
  attach(id: string, token: string, paymentPageUrl: string): Promise<void>
  read(id: string): Promise<AddOnPurchase | null>
  readByToken(token: string): Promise<AddOnPurchase | null>
  apply(id: string, evidence: AddOnPaymentEvidence): Promise<AddOnPurchase>
}
export interface AddOnPaymentProvider {
  initialize(
    purchase: AddOnPurchase,
  ): Promise<{ token: string; paymentPageUrl: string }>
  verifyUnpaidInitialization(conversationId: string): Promise<boolean>
  retrieve(token: string, conversationId: string): Promise<AddOnPaymentEvidence>
}
export async function startAddOnPurchase(
  input: Parameters<AddOnPurchasePort['prepare']>[0],
  port: AddOnPurchasePort,
  provider: AddOnPaymentProvider,
): Promise<AddOnPurchase> {
  const prepared = await port.prepare(input)
  if (!prepared.dispatchable) return prepared.purchase
  // An ambiguous provider failure leaves the operation initializing. Never dispatch it twice.
  let checkout
  try {
    checkout = await provider.initialize(prepared.purchase)
  } catch (error) {
    if (error instanceof AddOnInitializationRejected)
      await port.failInitialization(prepared.purchase.id)
    throw error
  }
  await port.attach(
    prepared.purchase.id,
    checkout.token,
    checkout.paymentPageUrl,
  )
  return { ...prepared.purchase, ...checkout, status: 'pending' }
}
export async function reconcileAddOnPurchase(
  purchase: AddOnPurchase,
  port: AddOnPurchasePort,
  provider: AddOnPaymentProvider,
): Promise<AddOnPurchase> {
  if (!purchase.token) {
    // No hosted URL was exposed until attach committed. Before releasing an ambiguous
    // initialization, additionally confirm the provider has no payment for this ID.
    if (
      purchase.status === 'initializing' &&
      (await provider.verifyUnpaidInitialization(purchase.id))
    ) {
      await port.failInitialization(purchase.id)
      return (await port.read(purchase.id)) ?? purchase
    }
    return purchase
  }
  const evidence = await provider.retrieve(purchase.token, purchase.id)
  if (
    evidence.token !== purchase.token ||
    evidence.basketId !== purchase.id ||
    evidence.conversationId !== purchase.id ||
    evidence.currency !== purchase.currency ||
    evidence.totalAmountMinor !== purchase.totalAmountMinor ||
    !evidence.paymentId ||
    !Number.isSafeInteger(evidence.refundedAmountMinor) ||
    evidence.refundedAmountMinor < 0 ||
    evidence.refundedAmountMinor > purchase.totalAmountMinor
  ) {
    throw new Error('Eklenti ödeme kanıtı eşleşmedi')
  }
  return port.apply(purchase.id, evidence)
}
