import type {
  AddOnPurchase,
  AddOnPurchasePort,
} from '@garsonless/application/add-on-purchases'
import type {
  AddOnPrice,
  AddOnStore,
} from '@garsonless/domain/add-on-purchases'
import {
  RESTAURANT_ADD_ONS,
  type RestaurantAddOn,
} from '@garsonless/domain/entitlements'
import { createServiceClient } from './service-client'

type Rpc = (
  name: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>
function rpcClient(): Rpc {
  const client = createServiceClient()
  return client.rpc.bind(client) as unknown as Rpc
}
export function createAddOnPurchasePort(
  rpc: Rpc = rpcClient(),
): AddOnPurchasePort & {
  store(restaurantId: string): Promise<AddOnStore>
  history(): Promise<AddOnPrice[]>
  setPrice(input: {
    actorUserId: string
    addOn: RestaurantAddOn
    expectedVersion: number
    netAmountMinor: number
    vatRate: number
    active: boolean
  }): Promise<void>
  pending(): Promise<AddOnPurchase[]>
} {
  async function call(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const { data, error } = await rpc(name, args)
    if (error) throw new Error(error.message)
    return data
  }
  function purchase(data: unknown): AddOnPurchase {
    if (!data || typeof data !== 'object')
      throw new Error('add_on_invalid_projection')
    const p = data as AddOnPurchase
    if (
      !p.id ||
      !p.restaurantId ||
      !RESTAURANT_ADD_ONS.includes(p.addOn) ||
      ![
        'initializing',
        'pending',
        'review',
        'paid',
        'failed',
        'refunded',
        'chargeback',
      ].includes(p.status) ||
      !Number.isSafeInteger(p.totalAmountMinor) ||
      p.totalAmountMinor <= 0 ||
      p.currency !== 'TRY' ||
      !p.profile
    )
      throw new Error('add_on_invalid_projection')
    return p
  }
  return {
    async prepare(input) {
      const result = (await call('prepare_add_on_purchase', {
        p_restaurant_id: input.restaurantId,
        p_user_id: input.userId,
        p_add_on: input.addOn,
        p_price_version: input.priceVersion,
        p_request_id: input.requestId,
        p_return_context: input.returnContext,
      })) as { purchase: unknown; dispatchable: boolean }
      if (typeof result?.dispatchable !== 'boolean')
        throw new Error('add_on_invalid_projection')
      return {
        purchase: purchase(result.purchase),
        dispatchable: result.dispatchable,
      }
    },
    async failInitialization(id) {
      await call('fail_add_on_initialization', { p_id: id })
    },
    async attach(id, token, url) {
      await call('attach_add_on_checkout', {
        p_id: id,
        p_token: token,
        p_url: url,
      })
    },
    async read(id) {
      const result = await call('read_add_on_purchase', { p_id: id })
      return result ? purchase(result) : null
    },
    async readByToken(token) {
      const result = await call('read_add_on_purchase', { p_token: token })
      return result ? purchase(result) : null
    },
    async apply(id, evidence) {
      return purchase(
        await call('apply_add_on_payment', { p_id: id, p_evidence: evidence }),
      )
    },
    async store(restaurantId) {
      const result = (await call('read_add_on_store', {
        p_restaurant_id: restaurantId,
      })) as AddOnStore
      if (
        !result ||
        !Array.isArray(result.prices) ||
        !Array.isArray(result.owned) ||
        !Array.isArray(result.purchases)
      )
        throw new Error('add_on_invalid_projection')
      return result
    },
    async history() {
      return (await call('read_add_on_price_history')) as AddOnPrice[]
    },
    async setPrice(input) {
      await call('set_add_on_price', {
        p_actor_user_id: input.actorUserId,
        p_add_on: input.addOn,
        p_expected_version: input.expectedVersion,
        p_net_amount_minor: input.netAmountMinor,
        p_vat_rate: input.vatRate,
        p_active: input.active,
      })
    },
    async pending() {
      return (
        (await call('list_add_on_reconciliation_purchases')) as unknown[]
      ).map(purchase)
    },
  }
}
