import type { AddOnPrice } from '@garsonless/domain/add-on-purchases'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { PublicCouponChoice } from '@garsonless/domain/coupons'
import type { ThemeEditorPreviewCategory, ThemeEditorPreviewItem } from './CanonicalSectionPreview'

interface ThemeEditorInitialPersistence {
  initialTheme: GarsonlessTheme
  initialPublishedRevision: number
  initialDraftRevision: number
  initialDraftSavedAt: string | null
  initialPublishedAt: string | null
  initialHasUnpublishedChanges: boolean
}

export interface ThemeEditorClientProps {
  userId: string
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  canAddAdvancedSections: boolean
  /** Video Hero is billed on its own so it can be sold below Pro as an add-on. */
  canUseVideoHero: boolean
  videoHeroOffer?: { price: AddOnPrice | null; owned: boolean; included: boolean; purchasable: boolean; ownerRequired?: boolean }
  canUseGuestOrdering: boolean
  experienceV2Enabled: boolean
  previewAccessToken: string
  templateId: string
  initialPersistence: ThemeEditorInitialPersistence
  restaurantSettings: Record<string, unknown> | null
  initialCouponOptions: PublicCouponChoice[]
  menuCategories: ThemeEditorPreviewCategory[]
  menuItems: ThemeEditorPreviewItem[]
}
