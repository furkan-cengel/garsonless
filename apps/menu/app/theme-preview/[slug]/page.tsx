import { notFound } from 'next/navigation'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import type { AccountPreviewState, AuthPreviewState, CheckoutPreviewState } from '@garsonless/design-engine'
import { getMenuCategories, getMenuItems, getPreviewRestaurantBySlug } from '../../../lib/queries'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../../lib/featured-products'
import { ExperienceStatePreview } from '../../[slug]/ExperienceStatePreview'
import { HomePagePreviewClient } from '../../[slug]/HomePagePreviewClient'
import { getPreviewTheme } from '../../../lib/published-theme'
import { hasThemePreviewAccess } from '../../../lib/theme-preview-access'
import { getPublicMenuRevision } from '../../../lib/public-menu-revision'
import { createThemeApplicationPort, readTenantOrderIngressStatus } from '@garsonless/db/server'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false, noarchive: true } }

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ThemeExperiencePreview({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const surface = sp['surface'] === 'auth' || sp['surface'] === 'account' || sp['surface'] === 'checkout' ? sp['surface'] : 'home'
  const requestedState = typeof sp['state'] === 'string' ? sp['state'] : null
  const previewTemplate = typeof sp['template'] === 'string' ? sp['template'] : null
  const restaurant = await getPreviewRestaurantBySlug(slug)
  if (!restaurant) notFound()
  if (sp['preview'] !== '1' || !hasThemePreviewAccess({
    token: sp['previewAccess'],
    restaurantId: restaurant.id,
    slug: restaurant.slug,
  })) notFound()

  const revisionSnapshot = await getPublicMenuRevision(restaurant.id)
  const [themeResult, categories, featuredRanking] = await Promise.all([
    getPreviewTheme(restaurant.id, previewTemplate),
    getMenuCategories(restaurant.id, revisionSnapshot.revision),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
  ])
  if (!themeResult.ok) notFound()
  const [guestOrderingAccess, orderIngressStatus] = await Promise.all([
    createThemeApplicationPort().readFeatureAccess({
      restaurantId: restaurant.id,
      plan: themeResult.value.restaurant.plan,
      feature: 'guest_ordering',
    }),
    readTenantOrderIngressStatus(restaurant.id),
  ])
  const guestOrderingEnabled = guestOrderingAccess.ok && guestOrderingAccess.value && orderIngressStatus === 'active'

  if (surface === 'auth' || surface === 'account' || surface === 'checkout') {
    if (surface === 'checkout' && !guestOrderingEnabled) notFound()
    const authStates = new Set<AuthPreviewState>(['join', 'otp', 'profile', 'challenge', 'success', 'error'])
    const accountStates = new Set<AccountPreviewState>(['overview', 'orders', 'favorites', 'profile', 'detail', 'reorder', 'loading', 'error', 'empty'])
    const checkoutStates = new Set<CheckoutPreviewState>(['cart', 'payment', 'success', 'table-payment', 'error'])
    const state = surface === 'auth'
      ? authStates.has(requestedState as AuthPreviewState) ? requestedState as AuthPreviewState : 'join'
      : surface === 'account'
        ? accountStates.has(requestedState as AccountPreviewState) ? requestedState as AccountPreviewState : 'overview'
        : checkoutStates.has(requestedState as CheckoutPreviewState) ? requestedState as CheckoutPreviewState : 'cart'
    const checkoutItems = surface === 'checkout'
      ? await getMenuItems(restaurant.id, revisionSnapshot.revision, categories.map((category) => category.id))
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

  const menuItems = await getMenuItems(restaurant.id, revisionSnapshot.revision, categories.map((category) => category.id))
  const items = applyFeaturedProductRanking(menuItems, featuredRanking)
  return <HomePagePreviewClient
    restaurant={restaurant}
    categories={categories as MenuCategory[]}
    items={items as MenuItem[]}
    theme={themeResult.value.theme}
    previewTemplateId={themeResult.value.templateId}
    previewAccessToken={typeof sp['previewAccess'] === 'string' ? sp['previewAccess'] : null}
    guestOrderingEnabled={guestOrderingEnabled}
  />
}
