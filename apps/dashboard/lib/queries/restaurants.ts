import { cache } from 'react'
import type { Tables } from '@garsonless/db/types'
import {
  listDashboardRestaurants,
  readDashboardRestaurant,
} from '@garsonless/application/restaurants'
import { createDashboardRestaurantReadModelPort } from '@garsonless/db/server'
import {
  getDashboardFeatureContext,
  getDashboardUserContext,
} from './context'

const restaurantReadModel = createDashboardRestaurantReadModelPort()

export const getRestaurantsForUser = cache(async function getRestaurantsForUser(): Promise<Tables<'restaurants'>[]> {
  const context = await getDashboardUserContext()
  if (!context) return []
  const result = await listDashboardRestaurants(context, restaurantReadModel)
  return result.ok ? result.value : []
})

export const getRestaurantById = cache(async function getRestaurantById(
  id: string,
): Promise<Tables<'restaurants'> | null> {
  const context = await getDashboardFeatureContext(id)
  if (!context) return null
  const result = await readDashboardRestaurant(context, id, restaurantReadModel)
  return result.ok ? result.value : null
})
