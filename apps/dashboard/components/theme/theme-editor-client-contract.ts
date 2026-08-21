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
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  canAddAdvancedSections: boolean
  experienceV2Enabled: boolean
  previewAccessToken: string
  templateId: string
  initialPersistence: ThemeEditorInitialPersistence
  restaurantSettings: Record<string, unknown> | null
  initialCouponOptions: PublicCouponChoice[]
  menuCategories: ThemeEditorPreviewCategory[]
  menuItems: ThemeEditorPreviewItem[]
}
