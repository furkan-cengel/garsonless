'use client'

import type { MenuCategory, MenuItem } from '@garsonless/ui'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { PublicRestaurant } from '../../lib/queries'
import { HomePageRenderer } from './HomePageClient'

export function HomePagePreviewClient({ restaurant, categories, items, theme }: { restaurant: PublicRestaurant; categories: MenuCategory[]; items: MenuItem[]; theme: GarsonlessTheme }) {
  return <HomePageRenderer restaurant={restaurant} categories={categories} items={items} theme={theme} isPreview />
}
