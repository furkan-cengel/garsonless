import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries'
import { assertAccess, requireSection } from '../../../../lib/auth/access'
import { readCampaigns } from '@garsonless/application/campaigns'
import {
  readCustomerSegmentCounts,
  readCustomerSegments,
  readCustomers,
} from '@garsonless/application/customers'
import { createCampaignApplicationPort, createCustomerApplicationPort } from '@garsonless/db/server'
import CustomersClient from '../../../../components/customers/CustomersClient'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function CustomersPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'customers')
  const gate = await assertAccess(restaurantId, 'customers')
  if ('error' in gate) throw new Error(gate.error)
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()

  const actor = {
    actor: 'dashboard-member' as const,
    restaurantId,
    userId: gate.userId,
    permissions: ['customers'],
  }
  const port = createCustomerApplicationPort()

  const [initialResult, countsResult, segmentsResult, campaignsResult] = await Promise.all([
    readCustomers(actor, { restaurantId, sort: 'last_seen', page: 1, pageSize: 25 }, port),
    readCustomerSegmentCounts(actor, restaurantId, port),
    readCustomerSegments(actor, restaurantId, port),
    readCampaigns(actor, { restaurantId }, createCampaignApplicationPort()),
  ])
  if (!initialResult.ok) throw new Error(initialResult.error)
  if (!countsResult.ok) throw new Error(countsResult.error)
  if (!segmentsResult.ok) throw new Error(segmentsResult.error)
  if (!campaignsResult.ok) throw new Error(campaignsResult.error)

  return (
    <CustomersClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initial={initialResult.value}
      initialSegmentCounts={{ all: initialResult.value.total, ...countsResult.value }}
      initialSegments={segmentsResult.value}
      initialCampaigns={campaignsResult.value}
    />
  )
}
