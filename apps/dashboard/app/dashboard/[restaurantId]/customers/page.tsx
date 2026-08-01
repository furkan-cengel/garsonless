import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { requireSection } from '../../../../lib/auth/access'
import { getDashboardFeatureContext } from '../../../../lib/queries/context'
import { readCampaigns } from '@garsonless/application/campaigns'
import {
  readCustomerSegmentCounts,
  readCustomerSegments,
  readCustomers,
} from '@garsonless/application/customers'
import { createCampaignApplicationPort, createCustomerApplicationPort, getSmsDeliveryAvailability } from '@garsonless/db/server'
import CustomersClient from '../../../../components/customers/CustomersClient'
import {
  parseCustomerListState,
  type CustomerListState,
} from '../../../../components/customers/customer-list-state'

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
  await requireSection(restaurantId, 'customers')
  const [restaurant, actor] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardFeatureContext(restaurantId),
  ])
  if (!restaurant || !actor) notFound()
  const port = createCustomerApplicationPort()
  const requestedState = parseCustomerListState(toUrlSearchParams(rawSearchParams))

  const countsPromise = readCustomerSegmentCounts(actor, restaurantId, port)
  const segmentsPromise = readCustomerSegments(actor, restaurantId, port)
  const campaignsPromise = actor.isOwner
    ? readCampaigns(actor, { restaurantId }, createCampaignApplicationPort())
    : Promise.resolve({ ok: true as const, value: [] })
  const segmentsResult = await segmentsPromise
  if (!segmentsResult.ok) throw new Error(segmentsResult.error)
  const customSegmentId = requestedState.customSegmentId
    && segmentsResult.value.some((segment) => segment.id === requestedState.customSegmentId)
    ? requestedState.customSegmentId
    : null
  const initialState: CustomerListState = {
    ...requestedState,
    customSegmentId,
    segment: customSegmentId ? '' : requestedState.segment,
  }
  const [initialResult, countsResult, campaignsResult] = await Promise.all([
    readCustomers(actor, {
      restaurantId,
      search: initialState.search,
      segment: initialState.segment || null,
      customSegmentId: initialState.customSegmentId,
      sort: initialState.sort,
      page: initialState.page,
      pageSize: 25,
    }, port),
    countsPromise,
    campaignsPromise,
  ])
  if (!initialResult.ok) throw new Error(initialResult.error)
  if (!countsResult.ok) throw new Error(countsResult.error)
  if (!campaignsResult.ok) throw new Error(campaignsResult.error)

  return (
    <CustomersClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initial={initialResult.value}
      initialSegmentCounts={{ all: initialResult.value.total, ...countsResult.value }}
      initialSegments={segmentsResult.value}
      initialCampaigns={campaignsResult.value}
      canManageCampaigns={actor.isOwner === true}
      smsDeliveryEnabled={getSmsDeliveryAvailability().enabled}
      initialState={initialState}
      referenceNow={new Date().toISOString()}
    />
  )
}
