import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import Iyzipay from 'iyzipay'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../lib/billing/iyzico-subscription-provider'
type Row = Record<string, unknown>
type Call = (
  input: Row,
  callback: (error: Error | null, result: Row) => void,
) => void
const config = readIyzicoSubscriptionProviderConfig()
assert.equal(config.baseUrl, 'https://sandbox-api.iyzipay.com', 'Sandbox only')
const combined = config.addOns.storefront_video_hero?.starter?.monthly
assert(combined, 'Legacy sandbox variant must be configured')
const client = new Iyzipay({
  apiKey: config.apiKey,
  secretKey: config.secretKey,
  uri: config.baseUrl,
}) as unknown as {
  subscription: { initialize: Call; search: Call; cancel: Call }
}
const invoke = (method: Call, input: Row) =>
  new Promise<Row>((resolve, reject) =>
    method(input, (error, result) => (error ? reject(error) : resolve(result))),
  )
const path = '/private/tmp/masabu-addon-legacy-transition.json'
const state: Row = existsSync(path)
  ? JSON.parse(readFileSync(path, 'utf8'))
  : { id: randomUUID() }
const save = () => writeFileSync(path, JSON.stringify(state), { mode: 0o600 })
if (!state.subscription) {
  assert(
    !state.initializing,
    'Ambiguous initialization requires provider reconciliation',
  )
  state.initializing = true
  save()
  const address = {
    contactName: 'Masabu Sandbox',
    address: 'Test Caddesi No: 2',
    city: 'Istanbul',
    country: 'Turkey',
    zipCode: '34840',
  }
  const result = await invoke(
    client.subscription.initialize.bind(client.subscription),
    {
      locale: 'tr',
      conversationId: state.id,
      pricingPlanReferenceCode: combined.referenceCode,
      subscriptionInitialStatus: 'ACTIVE',
      paymentCard: {
        cardHolderName: 'Masabu Sandbox',
        cardNumber: '5528790000000008',
        expireMonth: '12',
        expireYear: '2030',
        cvc: '123',
        registerCard: '0',
      },
      customer: {
        name: 'Masabu',
        surname: 'Sandbox',
        email: 'sandbox-addon@example.com',
        gsmNumber: '+905350000000',
        identityNumber: '11111111111',
        billingAddress: address,
        shippingAddress: address,
      },
    },
  )
  assert.equal(
    result.status,
    'success',
    `Sandbox initialization failed: ${String(result.errorCode)}`,
  )
  state.subscription = result.data
  save()
}
const subscription = state.subscription as Row
const ref = String(subscription.referenceCode)
const before = await invoke(
  client.subscription.search.bind(client.subscription),
  { subscriptionReferenceCode: ref, page: 1, count: 20 },
)
assert.equal(before.status, 'success')
const item = ((before.data as Row).items as Row[]).find(
  (p) => p.referenceCode === ref,
)
assert(item)
const firstOrder = (item.orders as Row[]).find(
  (order) => order.orderStatus === 'SUCCESS',
)
assert(firstOrder, 'Paid original period missing')
if (!state.transition) {
  assert(
    !state.transitioning,
    'Ambiguous transition requires provider reconciliation',
  )
  state.transitioning = true
  save()
  const result = await createIyzicoSubscriptionBillingProvider(
    config,
  ).upgradeSubscription({
    providerSubscriptionRef: ref,
    providerTargetPlanRef: config.plans.starter.monthly.referenceCode,
    effectivePolicy: 'next_period',
    idempotencyKey: `lifetime-proof:${state.id}`,
  })
  assert(result.ok, result.ok ? '' : result.error)
  state.transition = result.value
  save()
}
const transition = state.transition as Row
assert.equal(
  transition.providerTargetPlanRef,
  config.plans.starter.monthly.referenceCode,
)
const after = await invoke(
  client.subscription.search.bind(client.subscription),
  { subscriptionReferenceCode: ref, page: 1, count: 20 },
)
assert.equal(after.status, 'success')
const original = ((after.data as Row).items as Row[]).find(
  (p) => p.referenceCode === ref,
)
assert(original)
const paidOrder = (original.orders as Row[]).find(
  (order) => order.referenceCode === firstOrder.referenceCode,
)
assert(paidOrder)
assert.equal(paidOrder.startPeriod, firstOrder.startPeriod)
assert.equal(paidOrder.endPeriod, firstOrder.endPeriod)
assert.equal(paidOrder.price, firstOrder.price)
const target = await invoke(
  client.subscription.search.bind(client.subscription),
  {
    subscriptionReferenceCode: transition.providerTargetSubscriptionRef,
    page: 1,
    count: 20,
  },
)
assert.equal(target.status, 'success')
const child = ((target.data as Row).items as Row[]).find(
  (p) => p.referenceCode === transition.providerTargetSubscriptionRef,
)
assert(child)
assert.equal(
  child.pricingPlanReferenceCode,
  config.plans.starter.monthly.referenceCode,
)
assert(
  (child.orders as Row[]).some(
    (order) =>
      Number(order.startPeriod) === Number(firstOrder.endPeriod) &&
      Math.round(Number(order.price) * 100) ===
        config.plans.starter.monthly.amountMinor,
  ),
  'Base-only renewal must start at the original boundary',
)
if (!state.cancelled) {
  const cancelled = await invoke(
    client.subscription.cancel.bind(client.subscription),
    { subscriptionReferenceCode: transition.providerTargetSubscriptionRef },
  )
  assert.equal(cancelled.status, 'success')
  state.cancelled = true
  save()
}
console.log(
  JSON.stringify({
    verified: true,
    originalPeriodUnchanged: true,
    originalChargeUnchanged: true,
    nextRenewalExcludesAddOn: true,
    testSubscriptionCancelled: true,
  }),
)
