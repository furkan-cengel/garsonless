// Spinners
export {
  HeroSpinner,
  InlineSpinner,
  DotsSpinner,
  BrewBar,
  SkeletonCard,
  LogomarkSpinner,
  BarSpinner,
  DotPulse,
} from './spinners'

// Menu components
export {
  formatTRY,
  ThemeProvider,
  useTheme,
  CategoryNav,
  CartDrawer,
  Header,
  CartIconSvg,
  MenuFooter,
  normalizeFooterContactLinks,
  normalizeFooterSocialLinks,
  readableFooterForeground,
  OrderConfirmation,
  OrderBubble,
  ServiceRequestFab,
  OrderToastNotification,
  TableBillSheet,
  ProductCard,
  ProductModal,
  DietaryFilterBar,
  itemMatchesDietaryFilters,
  ML_STAMP_POP_KEYFRAME,
} from './menu/index'
export type { DietaryFilter } from './menu/index'

export type {
  CartItem,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  ModifierOption,
  SectionPromotionContext,
  SelectedModifier,
} from './menu/types'

export type { OrderSummaryItem } from './menu/OrderConfirmation'
export type { BillOrder } from './menu/TableBillSheet'

// Theme system
export { THEME_REGISTRY, computeThemeVars, readStoreInfo } from './themes/index'
export { CANONICAL_THEME_ID } from '@garsonless/design-engine'
export type { ComboAddRequest, ThemeMenuPageProps, StoreInfo, SettingField, SettingOption, SettingsGroup, ThemeRegistryEntry } from './themes/index'
export { CustomSectionRenderer, DefaultMenuPage, SETTINGS_SCHEMA, THEME_DEFAULTS } from './themes/default'
export type { CustomSectionRendererProps } from './themes/default'
export { deriveActivePromoSliderCampaigns, selectPromoSliderCampaigns } from './themes/default'
export type { PromoSliderCampaign, PromoSliderCampaignKind } from './themes/default'
export { CHEF_SECTION_ICON_OPTIONS, ChefSectionIcon, isChefSectionIconName } from './themes/default'
export type { ChefSectionIconName } from './themes/default'

// Error boundaries
export { RecoveryScreen } from './errors/RecoveryScreen'
