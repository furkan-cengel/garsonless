import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { requireSection } from '../../../../lib/auth/access'
import { getDashboardFeatureContext } from '../../../../lib/queries/context'
import { readCustomers } from '@garsonless/application/customers'
import {
  createCustomerApplicationPort,
  canRestaurantUseFeature,
  getCampaignEmailDeliveryAvailability,
  getLoyaltyScope,
  readCampaignEmailIdentity,
} from '@garsonless/db/server'
import CustomersClient from '../../../../components/customers/CustomersClient'
import { parseCustomerListState } from '../../../../components/customers/customer-list-state'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function toUrlSearchParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') params.set(key, value)
    else if (value?.[0]) params.set(key, value[0])
  }
  return params
}

export default async function CustomersPage({ params, searchParams }: Props) {
  const [{ restaurantId }, rawSearchParams] = await Promise.all([params, searchParams])
  const access = await requireSection(restaurantId, 'customers')
  const restaurantPromise = getRestaurantById(restaurantId)
  const actorPromise = getDashboardFeatureContext(restaurantId)
  const loyaltyScopePromise = getLoyaltyScope(restaurantId)
  const featureAllowedPromise = restaurantPromise.then((restaurant) => restaurant
    ? canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'customer_accounts' })
    : false)
  const [restaurant, actor, loyaltyScope, featureAllowed] = await Promise.all([
    restaurantPromise,
    actorPromise,
    loyaltyScopePromise,
    featureAllowedPromise,
  ])
  if (!restaurant || !actor) notFound()
  if (!featureAllowed) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="customer_accounts" isOwner={access.isOwner} />
  }
  const port = createCustomerApplicationPort({ loyaltyScope })
  const requestedState = parseCustomerListState(toUrlSearchParams(rawSearchParams))
  const initialResult = await readCustomers(actor, {
    restaurantId,
    search: requestedState.search,
    segment: requestedState.segment || null,
    customSegmentId: requestedState.customSegmentId,
    sort: requestedState.sort,
    page: requestedState.page,
    pageSize: 25,
  }, port)
  if (!initialResult.ok) throw new Error(initialResult.error)
  const campaignEmailIdentity = readCampaignEmailIdentity(restaurant.name, restaurant.settings)

  return (
    <CustomersClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initial={initialResult.value}
      canManageCampaigns={actor.isOwner === true}
      emailDeliveryEnabled={getCampaignEmailDeliveryAvailability().enabled}
      campaignReplyToEmail={campaignEmailIdentity.replyTo}
      resendWebhookEnabled={Boolean(process.env['RESEND_WEBHOOK_SECRET'])}
      initialState={requestedState}
      referenceNow={new Date().toISOString()}
    />
  )
}
