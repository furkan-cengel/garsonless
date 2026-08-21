'use client'

import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { PublicRestaurant } from '../../lib/queries'
import { HomePageRenderer } from './HomePageClient'

export function HomePagePreviewClient({ restaurant, categories, items, theme, previewTemplateId, previewAccessToken }: { restaurant: PublicRestaurant; categories: MenuCategory[]; items: MenuItem[]; theme: GarsonlessTheme; previewTemplateId: string; previewAccessToken: string | null }) {
  return <HomePageRenderer restaurant={restaurant} categories={categories} items={items} theme={theme} isPreview previewTemplateId={previewTemplateId} previewAccessToken={previewAccessToken} />
}
