'use client'

import React from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { AppIcons as I } from '../../../icons'
import { resolveServiceRequestFabConfig } from '../../../menu/serviceRequestFabConfig'
import type { MenuCategory, MenuItem, SectionPromotionContext } from '../../../menu/types'
import type { ComboAddRequest, StoreInfo } from '../../types'
import { HeroSection } from './HeroSection'
import { PromoStripSection } from './PromoStripSection'
import { ChefPickSection } from './ChefPickSection'
import { FeaturedScrollSection } from './FeaturedScrollSection'
import { ComboRibbonSection } from './ComboRibbonSection'
import { DiscountBadgeSection } from './DiscountBadgeSection'
import { GallerySection } from './GallerySection'
import { PromoSliderBlock } from './PromoSliderSection'
import { DailySpecialBlock } from './DailySpecialSection'
import type { PromoSliderCampaign } from './promoSliderCampaignModel'
import {
  AddressBarSection,
  HoursInfoSection,
  InfoBlockSection,
  InfoCardSection,
  ModeTabsSection,
  QuickLinksSection,
  WifiInfoSection,
} from './MiscSections'
import {
  StorefrontCategoriesSection,
  StorefrontHeroSection,
  StorefrontLoyaltySection,
  StorefrontMenuCtaSection,
  StorefrontStorySection,
  type StorefrontMemberSummary,
} from './StorefrontSections'

export interface CustomSectionRendererProps {
  sectionId: string
  sectionInstanceId?: string
  config?: Record<string, string>
  categories?: MenuCategory[]
  restaurantName: string
  pageDescription?: string
  memberLoyalty?: { filled: number; total: number } | null
  activeCampaigns?: PromoSliderCampaign[]
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => void
  onAddCombo?: (combo: ComboAddRequest) => void
  onOpenCart?: () => void
  storeInfo?: StoreInfo | null
  theme?: Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor'>
  renderContext?: 'menu' | 'catalog' | 'home'
  menuHref?: string
  onOpenMember?: () => void
  memberSummary?: StorefrontMemberSummary | null
  storeStatus?: string
}

/**
 * Canonical renderer for editor previews and the public menu.
 * Keeping this decision tree in one place prevents catalogue mockups from
 * promising a component that looks different after it is added.
 */
export function CustomSectionRenderer({
  sectionId,
  sectionInstanceId,
  config = {},
  categories = [],
  restaurantName,
  pageDescription,
  memberLoyalty,
  activeCampaigns,
  items,
  onQuickAdd,
  onAddCombo,
  onOpenCart,
  storeInfo,
  theme,
  renderContext = 'menu',
  menuHref = '/menu',
  onOpenMember,
  memberSummary,
  storeStatus,
}: CustomSectionRendererProps) {
  const storefrontProps = {
    config,
    restaurantName,
    categories,
    menuHref,
    ...(memberSummary !== undefined ? { memberSummary } : {}),
    ...(storeStatus ? { storeStatus } : {}),
    ...(onOpenMember ? { onOpenMember } : {}),
  }
  if (sectionId === 'storefront-hero') return <StorefrontHeroSection {...storefrontProps} config={{ ...config, mediaType: 'image' }} />
  if (sectionId === 'storefront-video-hero') return <StorefrontHeroSection {...storefrontProps} config={{ ...config, mediaType: 'video' }} />
  if (sectionId === 'story') return <StorefrontStorySection {...storefrontProps} />
  if (sectionId === 'featured-categories') return <StorefrontCategoriesSection {...storefrontProps} />
  if (sectionId === 'loyalty-teaser') return <StorefrontLoyaltySection {...storefrontProps} />
  if (sectionId === 'menu-cta') return <StorefrontMenuCtaSection {...storefrontProps} />
  if (sectionId === 'request-buttons') {
    if (renderContext === 'menu') return null
    const requestConfig = resolveServiceRequestFabConfig(config)
    const previewRequests = requestConfig.requests.slice(0, 3)
    return (
      <div style={{
        position: 'relative', width: '100%', minHeight: 174, padding: '14px 14px 66px',
        borderRadius: 16, border: '1px solid var(--p-border, #e3e4e7)',
        background: 'var(--p-card, #fff)', color: 'var(--p-text, #1c1d20)',
        fontFamily: 'var(--p-body, inherit)', overflow: 'hidden', boxSizing: 'border-box',
      }}>
        <strong style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{requestConfig.title}</strong>
        <span style={{ display: 'block', marginTop: 3, color: 'var(--p-text-2, #6b6d75)', fontSize: 10.5 }}>
          Masa 7 · {requestConfig.subtitle}
        </span>
        <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          {previewRequests.map((request, index) => (
            <div key={request.type} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 31 }}>
              <span style={{
                width: 27, height: 27, borderRadius: 8, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', background: 'var(--p-accent-soft, #e8f5ee)', color: 'var(--p-accent, #2f8f5b)',
              }}>
                {index === 0 ? <I.bell size={14} /> : index === 1 ? <I.spray size={14} /> : <I.receipt size={14} />}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>{request.label}</span>
            </div>
          ))}
        </div>
        <span style={{
          position: 'absolute', bottom: 12, [requestConfig.position]: 12,
          width: requestConfig.size === 'compact' ? 38 : requestConfig.size === 'large' ? 50 : 44,
          height: requestConfig.size === 'compact' ? 38 : requestConfig.size === 'large' ? 50 : 44,
          borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--p-accent, #2f8f5b)', color: '#fff', boxShadow: '0 10px 22px -10px rgba(24,107,67,.7)',
        }}>
          <I.bell size={19} />
        </span>
      </div>
    )
  }
  if (sectionId === 'hero-note' || sectionId === 'hero-banner') {
    return (
      <HeroSection
        sectionId={sectionId}
        config={config}
        restaurantName={restaurantName}
        pageDescription={pageDescription}
        {...(onOpenCart ? { onOpenCart } : {})}
        {...(renderContext === 'home' ? { forcedHref: menuHref } : {})}
      />
    )
  }
  if (sectionId === 'mode-tabs') return <ModeTabsSection config={config} />
  if (sectionId === 'address-bar' || sectionId === 'search') {
    return <AddressBarSection sectionId={sectionId} config={config} />
  }
  if (sectionId === 'promo-strip') {
    const resolvedConfig = renderContext === 'home' && !Object.prototype.hasOwnProperty.call(config, 'repeatText')
      ? { ...config, repeatText: '' }
      : config
    return <PromoStripSection config={resolvedConfig} {...(renderContext === 'home' ? { forcedHref: menuHref } : {})} />
  }
  if (sectionId === 'quick-links' || sectionId === 'cat-pills' || sectionId === 'cat-underline' || sectionId === 'cat-images') {
    return <QuickLinksSection categories={categories} />
  }
  if (sectionId === 'chef-pick') {
    return <ChefPickSection config={config} actionMode={renderContext === 'home' ? 'discover' : 'order'} {...(items ? { items } : {})} {...(onQuickAdd ? { onQuickAdd } : {})} {...(theme ? { theme } : {})} />
  }
  if (sectionId === 'featured-scroll') {
    return <FeaturedScrollSection config={config} actionMode={renderContext === 'home' ? 'discover' : 'order'} {...(items ? { items } : {})} {...(onQuickAdd ? { onQuickAdd } : {})} {...(theme ? { theme } : {})} />
  }
  if (sectionId === 'chef-picks' || sectionId === 'minimal-list') {
    return <InfoCardSection sectionId={sectionId} />
  }
  if (sectionId === 'combo-ribbon') {
    return <ComboRibbonSection sectionInstanceId={sectionInstanceId ?? sectionId} config={config} {...(items ? { items } : {})} {...(onAddCombo ? { onAddCombo } : {})} {...(theme ? { theme } : {})} />
  }
  if (sectionId === 'discount-badge') {
    return (
      <DiscountBadgeSection
        sectionInstanceId={sectionInstanceId ?? sectionId}
        config={config}
        {...(items ? { items } : {})}
        {...(onQuickAdd ? { onQuickAdd } : {})}
        {...(theme ? { theme } : {})}
      />
    )
  }
  if (sectionId === 'promo-slider') {
    return (
      <PromoSliderBlock
        config={config}
        memberLoyalty={memberLoyalty ?? null}
        sectionInstanceId={sectionInstanceId ?? sectionId}
        activeCampaigns={activeCampaigns ?? []}
      />
    )
  }
  if (sectionId === 'daily-special') {
    return (
      <DailySpecialBlock
        sectionInstanceId={sectionInstanceId ?? sectionId}
        config={config}
        actionMode={renderContext === 'home' ? 'discover' : 'order'}
        {...(items ? { items } : {})}
        {...(onQuickAdd ? { onQuickAdd } : {})}
        {...(theme ? { theme } : {})}
      />
    )
  }
  if (sectionId === 'gallery') return <GallerySection config={config} />
  if (sectionId === 'hours') return <HoursInfoSection storeInfo={storeInfo ?? null} />
  if (sectionId === 'wifi-info') return <WifiInfoSection config={config} catalogMock={renderContext === 'catalog'} />
  if (
    sectionId === 'reviews' ||
    sectionId === 'allergens' ||
    sectionId === 'service-info' ||
    sectionId === 'waiter-call' ||
    sectionId === 'bill-summary'
  ) {
    return <InfoBlockSection sectionId={sectionId} config={config} storeInfo={storeInfo ?? null} />
  }

  return null
}
