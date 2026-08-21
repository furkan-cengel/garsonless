'use client'

import dynamic from 'next/dynamic'
import { resolveHomeSectionColorConfig, type GarsonlessTheme, type HomeSurfaceBlock } from '@garsonless/design-engine'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import type { SectionPromotionContext } from '@garsonless/ui/menu'
import type { ComboAddRequest, FreebieAddRequest, MemberOpenTarget, StoreInfo } from '@garsonless/ui/themes'
import type { PromoSliderCampaign } from '@garsonless/ui/themes/default/promoSliderCampaignModel'
import {
  StorefrontHeroSection,
  type StorefrontMemberSummary,
  type StoreStatusPresentation,
} from '@garsonless/ui/themes/default/StorefrontSections'

const SharedHomeSection = dynamic(() => import('./SharedHomeSection'))

export interface HomeV2BlockProps {
  block: HomeSurfaceBlock
  config: Record<string, string>
  theme: GarsonlessTheme
  restaurantName: string
  restaurantLogoUrl?: string | null
  pageDescription?: string
  categories: MenuCategory[]
  items: MenuItem[]
  menuHref: string
  memberSummary: StorefrontMemberSummary
  memberLoyalty?: {
    filled: number
    total: number
    points?: number
    pointsEnabled?: boolean
    stampsEnabled?: boolean
    tierName?: string
  } | null
  storeStatus?: StoreStatusPresentation
  storeInfo: StoreInfo | null
  onOpenMember?: (target?: MemberOpenTarget) => void
  onOpenProduct: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => void
  onAddCombo?: (combo: ComboAddRequest, config: Record<string, string>) => void
  onAddFreebie?: (campaign: FreebieAddRequest) => void
  onSelectCategory?: (categoryId: string) => void
  activeCampaigns: PromoSliderCampaign[]
  editorPreview?: boolean
}

export function HomeV2Block(props: HomeV2BlockProps) {
  const config = resolveHomeSectionColorConfig(
    props.block.sectionId,
    props.config,
    props.theme.surfaces?.home.colorInheritanceVersion,
  )
  const common = {
    config,
    restaurantName: props.restaurantName,
    categories: props.categories,
    menuHref: props.menuHref,
    memberSummary: props.memberSummary,
    ...(props.onOpenMember ? { onOpenMember: props.onOpenMember } : {}),
    ...(props.storeStatus ? { storeStatus: props.storeStatus } : {}),
  }
  if (props.block.sectionId === 'storefront-video-hero') return <StorefrontHeroSection {...common} config={{ ...config, mediaType: 'video' }} previewMode={props.editorPreview ? 'editor' : 'public'} />
  return <SharedHomeSection {...props} config={config} />
}
