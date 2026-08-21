// Shared types for default-theme custom sections.
// Types only — no runtime — so importing these can never create an import cycle.

export interface ConfigReaders {
  text: (key: string, fallback: string) => string
  number: (key: string, fallback: number) => number
  bool: (key: string, fallback?: boolean) => boolean
  targetHref: () => string
}

export interface PromoCouponConfig {
  enabled: boolean
  eyebrow: string
  title: string
  subtitle: string
  code: string
  bgStart: string
  bgEnd: string
  textColor: string
  accentColor: string
  buttonBgColor: string
  buttonTextColor: string
}

export type PromoSliderActionType = 'none' | 'category' | 'product' | 'cart' | 'member'

export interface PromoSliderActionConfig {
  type: PromoSliderActionType
  ctaText: string
  categoryId: string
  productId: string
}

export interface PromoFlashConfig {
  enabled: boolean
  chip: string
  title: string
  accentText: string
  countdownEnabled: boolean
  expiresAtMs?: number
  countdownLabel: string
  bgStart: string
  bgEnd: string
  textColor: string
  accentColor: string
  offerType: 'none' | 'buy-2-pay-1'
  itemIds: string[]
  discountPolicy: 'combine-loyalty' | 'promotion-only'
  action: PromoSliderActionConfig
}

export interface PromoFreebieConfig {
  enabled: boolean
  label: string
  title: string
  subtitle: string
  emoji: string
  ctaText: string
  categoryId: string
  offerType: 'promo-only' | 'gift-with-purchase'
  qualifierMode: 'category' | 'products'
  qualifierCategoryId: string
  qualifierItemIds: string[]
  rewardItemIds: string[]
  timingEnabled: boolean
  startsAtMs?: number
  endsAtMs?: number
  imageSource: 'custom' | 'qualifier' | 'reward' | 'emoji' | 'none'
  imageUrl: string
  layout: 'media-right' | 'split' | 'cover'
  imageFit: 'cover' | 'contain'
  imagePosition: 'top' | 'center' | 'bottom'
  bgStart: string
  bgEnd: string
  textColor: string
  accentColor: string
  buttonBgColor: string
  buttonTextColor: string
  action: PromoSliderActionConfig
}

export interface PromoLoyaltyConfig {
  enabled: boolean
  eyebrow: string
  title: string
  filled: number
  total: number
  points: number
  pointsEnabled: boolean
  stampsEnabled: boolean
  tierName: string
  restaurantName: string
  logoUrl: string
  authenticated: boolean
  bgStart: string
  bgEnd: string
  textColor: string
  accentColor: string
  action: PromoSliderActionConfig
}

export interface PromoSliderConfig {
  sourceMode: 'active' | 'mixed' | 'manual'
  autoplay: boolean
  interval: number
  indicator: 'dots' | 'bars'
  radius: number
  coupon: PromoCouponConfig
  flash: PromoFlashConfig
  freebie: PromoFreebieConfig
  loyalty: PromoLoyaltyConfig
}
