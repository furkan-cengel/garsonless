'use client'

import dynamic from 'next/dynamic'
import type { GarsonlessTheme, HomeSurfaceBlock } from '@garsonless/design-engine'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import type { StoreInfo } from '@garsonless/ui/themes'
import {
  StorefrontHeroSection,
  type StorefrontMemberSummary,
} from '@garsonless/ui/themes/default/StorefrontSections'

const SharedHomeSection = dynamic(() => import('./SharedHomeSection'))

export interface HomeV2BlockProps {
  block: HomeSurfaceBlock
  config: Record<string, string>
  theme: GarsonlessTheme
  restaurantName: string
  pageDescription?: string
  categories: MenuCategory[]
  items: MenuItem[]
  menuHref: string
  memberSummary: StorefrontMemberSummary
  storeStatus?: string
  storeInfo: StoreInfo | null
  onOpenMember: () => void
  onOpenProduct: (item: MenuItem) => void
}

export function HomeV2Block(props: HomeV2BlockProps) {
  const common = {
    config: props.config,
    restaurantName: props.restaurantName,
    categories: props.categories,
    menuHref: props.menuHref,
    memberSummary: props.memberSummary,
    onOpenMember: props.onOpenMember,
    ...(props.storeStatus ? { storeStatus: props.storeStatus } : {}),
  }
  if (props.block.sectionId === 'storefront-video-hero') return <StorefrontHeroSection {...common} config={{ ...props.config, mediaType: 'video' }} />
  return <SharedHomeSection {...props} />
}
