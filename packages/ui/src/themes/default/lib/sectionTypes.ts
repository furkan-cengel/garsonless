// Shared types for default-theme custom sections.
// Types only — no runtime — so importing these can never create an import cycle.

export interface ConfigReaders {
  text: (key: string, fallback: string) => string
  number: (key: string, fallback: number) => number
  bool: (key: string, fallback?: boolean) => boolean
  targetHref: () => string
}

export interface DailySpecialConfig {
  heroImage: string
  title: string
  body: string
  displayPrice: string
  priceOverride: number | null
  oldPrice: string
  accentColor: string
  chefNote: string
  timerValue: string
  timerBg: string
  timerColor: string
  ctaText: string
  eyebrow: string
  bgStart: string
  bgEnd: string
  bgColor: string
  radius: number
  ribbonCorner: 'tl' | 'tr'
  ribbonSize: 'sm' | 'md' | 'lg'
  ribbonSpeed: number
}

export interface PromoCouponConfig {
  enabled: boolean
  eyebrow: string
  title: string
  subtitle: string
  code: string
  bgStart: string
  bgEnd: string
}

export interface PromoFlashConfig {
  enabled: boolean
  chip: string
  title: string
  accentText: string
  timer: string
}

export interface PromoFreebieConfig {
  enabled: boolean
  label: string
  title: string
  subtitle: string
  emoji: string
  ctaText: string
  categoryId: string
}

export interface PromoLoyaltyConfig {
  enabled: boolean
  title: string
  filled: number
  total: number
}

export interface PromoComboConfig {
  enabled: boolean
  title: string
  subtitle: string
  emoji: string
  imageUrl: string
  price: string
  oldPrice: string
}

export interface PromoSliderConfig {
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
