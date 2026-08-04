import { notFound } from 'next/navigation'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import type { AuthPreviewState, CheckoutPreviewState } from '@garsonless/design-engine'
import { getMenuCategories, getMenuItems, getRestaurantBySlug } from '../../../lib/queries'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../../lib/featured-products'
import { ExperienceStatePreview } from '../../[slug]/ExperienceStatePreview'
import { HomePagePreviewClient } from '../../[slug]/HomePagePreviewClient'
import { getPreviewTheme } from '../../../lib/published-theme'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ThemeExperiencePreview({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const surface = sp['surface'] === 'auth' || sp['surface'] === 'checkout' ? sp['surface'] : 'home'
  const requestedState = typeof sp['state'] === 'string' ? sp['state'] : null
  const previewTemplate = typeof sp['template'] === 'string' ? sp['template'] : null
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const [themeResult, categories, featuredRanking] = await Promise.all([
    getPreviewTheme(restaurant.id, previewTemplate),
    getMenuCategories(restaurant.id),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
  ])
  if (!themeResult.ok) notFound()

  if (surface === 'auth' || surface === 'checkout') {
    const authStates = new Set<AuthPreviewState>(['join', 'otp', 'success', 'error'])
    const checkoutStates = new Set<CheckoutPreviewState>(['cart', 'payment', 'success', 'table-payment', 'error'])
    const state = surface === 'auth'
      ? authStates.has(requestedState as AuthPreviewState) ? requestedState as AuthPreviewState : 'join'
      : checkoutStates.has(requestedState as CheckoutPreviewState) ? requestedState as CheckoutPreviewState : 'cart'
    const checkoutItems = surface === 'checkout'
      ? await getMenuItems(restaurant.id, categories.map((category) => category.id))
      : []
    return <ExperienceStatePreview
      restaurantName={restaurant.name}
      logoUrl={restaurant.logo_url}
      theme={themeResult.value.theme}
      surface={surface}
      state={state}
      menuItems={checkoutItems as MenuItem[]}
    />
  }

  const menuItems = await getMenuItems(restaurant.id, categories.map((category) => category.id))
  const items = applyFeaturedProductRanking(menuItems, featuredRanking)
  return <HomePagePreviewClient restaurant={restaurant} categories={categories as MenuCategory[]} items={items as MenuItem[]} theme={themeResult.value.theme} />
}
