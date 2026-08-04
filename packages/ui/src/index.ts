// Spinners
export {
  InlineSpinner,
  BrewBar,
} from './spinners'

// Menu components
export {
  formatTRY,
  ThemeProvider,
  useTheme,
  CartDrawer,
  CartIconSvg,
  OrderBubble,
  orderStatusPhase,
  ServiceRequestFab,
  OrderToastNotification,
  ProductCard,
  isProductConfigurable,
  AllergenIcon,
  getDefiniteAllergens,
  sortAllergenCodes,
  DietaryFilterBar,
  itemMatchesDietaryFilters,
  ML_STAMP_POP_KEYFRAME,
} from './menu/index'
export type { DietaryFilter } from './menu/index'
export type { ProductModalSubmitOptions } from './menu/index'

export type {
  CartItem,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  SectionPromotionContext,
  SelectedModifier,
} from './menu/types'

export type { OrderSummaryItem } from './menu/OrderConfirmation'
export type { BillOrder } from './menu/TableBillSheet'

// Theme system
export { THEME_REGISTRY, computeThemeVars, readStoreInfo } from './themes/index'
export { CANONICAL_THEME_ID } from '@garsonless/design-engine/theme-policy'
export type { ComboAddRequest, StoreInfo, SettingField, SettingsGroup } from './themes/index'
export { CustomSectionRenderer, THEME_DEFAULTS } from './themes/default'
export { deriveActivePromoSliderCampaigns } from './themes/default'
export type { PromoSliderCampaign } from './themes/default'
export { CHEF_SECTION_ICON_OPTIONS, ChefSectionIcon, isChefSectionIconName } from './themes/default'

// Error boundaries
export { RecoveryScreen } from './errors/RecoveryScreen'
