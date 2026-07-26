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
}

export interface PromoFreebieConfig {
  enabled: boolean
  label: string
  title: string
  subtitle: string
  emoji: string
  ctaText: string
  categoryId: string
  bgStart: string
  bgEnd: string
  textColor: string
  accentColor: string
  buttonBgColor: string
  buttonTextColor: string
}

export interface PromoLoyaltyConfig {
  enabled: boolean
  title: string
  filled: number
  total: number
  bgStart: string
  bgEnd: string
  textColor: string
  accentColor: string
}

export interface PromoComboConfig {
  enabled: boolean
  title: string
  subtitle: string
  emoji: string
  imageUrl: string
  price: string
  oldPrice: string
  bgStart: string
  bgEnd: string
  textColor: string
  accentColor: string
  imageFit: 'cover' | 'contain'
  imagePosition: 'top' | 'center' | 'bottom'
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
  combo: PromoComboConfig
}
