// ── Flat theme (canonical) ────────────────────────────────────────────────────

export type ThemeSectionVisibilityMode = 'all' | 'home' | 'categories'

export interface ThemeSectionVisibility {
  mode: ThemeSectionVisibilityMode
  categoryIds?: string[]
  includeChildren?: boolean
}

export interface ThemePageBlock {
  type: 'section' | 'category' | 'nav'
  /** Stable block instance id. Legacy section blocks use the definition id. */
  id: string
  /** Section definition id when the instance id differs from its component type. */
  sectionId?: string
  /** Optional placement scope. Missing metadata preserves the legacy all-menu behavior. */
  visibility?: ThemeSectionVisibility
  /** Missing preserves legacy page rendering; newly added drawer-capable sections set this explicitly. */
  placement?: 'page' | 'drawer'
}

export type MenuFilterPresetId = 'vegan' | 'vegetarian' | 'halal'

export interface ThemeMenuCustomFilter {
  id: string
  label: string
  itemIds: string[]
}

export type ThemeEditorSurface = 'home' | 'menu' | 'auth' | 'checkout'
export type AuthPreviewState = 'join' | 'otp' | 'success' | 'error'
export type CheckoutPreviewState = 'cart' | 'payment' | 'success' | 'table-payment' | 'error'

export type AuthStateContentAlign = 'left' | 'center'
export type AuthStateContentWidth = 'compact' | 'standard' | 'full'
export type AuthSuccessIcon = 'check' | 'shield' | 'sparkles' | 'star'
export type AuthErrorIcon = 'warn' | 'close' | 'refresh' | 'lock'

export interface AuthStateLayoutTheme {
  paddingX?: number
  paddingY?: number
  contentGap?: number
  align?: AuthStateContentAlign
  contentWidth?: AuthStateContentWidth
  /** Status icon container size. OTP ignores this field. */
  iconSize?: number
}

export interface AuthOtpStateTheme {
  title?: string
  description?: string
  primaryActionLabel?: string
  resendLabel?: string
  layout?: AuthStateLayoutTheme
}

export interface AuthSuccessStateTheme {
  title?: string
  description?: string
  primaryActionLabel?: string
  icon?: AuthSuccessIcon
  iconColor?: string
  iconBackground?: string
  layout?: AuthStateLayoutTheme
}

export interface AuthErrorStateTheme {
  title?: string
  description?: string
  primaryActionLabel?: string
  icon?: AuthErrorIcon
  iconColor?: string
  iconBackground?: string
  layout?: AuthStateLayoutTheme
}

export interface AuthSurfaceStatesTheme {
  otp?: AuthOtpStateTheme
  success?: AuthSuccessStateTheme
  error?: AuthErrorStateTheme
}

export type CheckoutPaymentDensity = 'compact' | 'standard'
export type CheckoutPaymentContentWidth = 'standard' | 'wide'
export type CheckoutResultContentAlign = 'left' | 'center'
export type CheckoutResultContentWidth = 'compact' | 'standard' | 'full'
export type CheckoutSuccessIcon = 'check' | 'receipt' | 'shield' | 'sparkles'
export type CheckoutTablePaymentIcon = 'bell' | 'receipt' | 'clock' | 'card'
export type CheckoutErrorIcon = 'warn' | 'close' | 'refresh' | 'lock'

export interface CheckoutPaymentLayoutTheme {
  paddingX?: number
  sectionGap?: number
  density?: CheckoutPaymentDensity
  contentWidth?: CheckoutPaymentContentWidth
}

export interface CheckoutResultLayoutTheme {
  paddingX?: number
  paddingY?: number
  contentGap?: number
  align?: CheckoutResultContentAlign
  contentWidth?: CheckoutResultContentWidth
  iconSize?: number
}

export interface CheckoutPaymentStateTheme {
  title?: string
  description?: string
  amountLabel?: string
  methodSectionTitle?: string
  buyerSectionTitle?: string
  buyerSectionDescription?: string
  cardActionLabel?: string
  tableActionLabel?: string
  layout?: CheckoutPaymentLayoutTheme
}

export interface CheckoutSuccessStateTheme {
  title?: string
  description?: string
  primaryActionLabel?: string
  icon?: CheckoutSuccessIcon
  iconColor?: string
  iconBackground?: string
  layout?: CheckoutResultLayoutTheme
}

export interface CheckoutTablePaymentStateTheme {
  title?: string
  description?: string
  primaryActionLabel?: string
  icon?: CheckoutTablePaymentIcon
  iconColor?: string
  iconBackground?: string
  layout?: CheckoutResultLayoutTheme
}

export interface CheckoutErrorStateTheme {
  title?: string
  primaryActionLabel?: string
  secondaryActionLabel?: string
  icon?: CheckoutErrorIcon
  iconColor?: string
  iconBackground?: string
  layout?: CheckoutResultLayoutTheme
}

export interface CheckoutSurfaceStatesTheme {
  payment?: CheckoutPaymentStateTheme
  success?: CheckoutSuccessStateTheme
  tablePayment?: CheckoutTablePaymentStateTheme
  error?: CheckoutErrorStateTheme
}

export interface ThemeSurfaceOverride {
  background?: string
  surface?: string
  text?: string
  mutedText?: string
  fieldSurface?: string
  fieldBorder?: string
  accent?: string
  accentSoft?: string
  cta?: string
  ctaText?: string
  bodyFont?: string
  displayFont?: string
  radius?: number
}

export type HomeSectionType =
  | 'announcement'
  | 'header'
  | 'hero'
  | 'about'
  | 'featured-categories'
  | 'hours-location'
  | 'social-links'
  | 'footer'
  | 'hero-video'
  | 'featured-products'
  | 'gallery'
  | 'promo-slider'

export interface HomeSurfaceSection {
  id: string
  type: HomeSectionType
  enabled: boolean
  eyebrow?: string
  title?: string
  body?: string
  buttonLabel?: string
  showMenuCta?: boolean
  imageUrl?: string
  videoUrl?: string
  posterUrl?: string
  imageUrls?: string[]
  categoryIds?: string[]
  menuItemIds?: string[]
  address?: string
  phone?: string
  hours?: string
  instagramUrl?: string
  facebookUrl?: string
  websiteUrl?: string
  align?: 'left' | 'center'
  tone?: 'surface' | 'brand' | 'dark'
}

export type HomeSectionDefinitionId =
  | 'hero-banner'
  | 'storefront-video-hero'
  | 'promo-strip'
  | 'featured-scroll'
  | 'chef-pick'
  | 'combo-ribbon'
  | 'discount-badge'
  | 'daily-special'
  | 'promo-slider'
  | 'gallery'

export interface HomeSurfaceBlock {
  /** Stable block instance id; section settings are stored under this id. */
  id: string
  sectionId: HomeSectionDefinitionId
  enabled: boolean
}

export interface HomeSurfaceTheme {
  enabled: boolean
  /** Missing means the published document still uses the legacy sections renderer. */
  compositionVersion?: 2
  /** V2 main-content flow. Header and Footer deliberately stay outside this list. */
  blocks?: HomeSurfaceBlock[]
  sections: HomeSurfaceSection[]
  override?: ThemeSurfaceOverride
  seo?: {
    title?: string
    description?: string
  }
}

export interface AuthHeaderTheme {
  backgroundImageUrl?: string
  imageFit?: 'cover' | 'contain'
  imagePositionX?: number
  imagePositionY?: number
  height?: 'compact' | 'standard' | 'wide'
  contentTone?: 'light' | 'dark'
  backgroundColor?: string
  logoMode: 'none' | 'restaurant' | 'custom'
  logoUrl?: string
  title?: string
  slogan?: string
  align: 'left' | 'center'
  overlay: number
}

export interface AuthSurfaceTheme {
  preset: 'brand-panel' | 'minimal' | 'immersive'
  title?: string
  subtitle?: string
  header: AuthHeaderTheme
  states?: AuthSurfaceStatesTheme
  /** Legacy V2 field. New writes use header.backgroundImageUrl. */
  heroImageUrl?: string
  override?: ThemeSurfaceOverride
}

export const DEFAULT_AUTH_STATES = {
  otp: {
    title: 'Doğrulama',
    description: 'Adresine gönderdiğimiz 6 haneli kodu gir.',
    primaryActionLabel: 'Doğrula ve devam et',
    resendLabel: 'Kodu tekrar gönder',
    layout: {
      paddingX: 22,
      paddingY: 24,
      contentGap: 12,
      align: 'left',
      contentWidth: 'full',
    },
  },
  success: {
    title: 'Tekrar hoş geldin',
    description: 'Hesabın bu cihazda hazır. Menüye kaldığın yerden devam edebilirsin.',
    primaryActionLabel: 'Menüye dön',
    icon: 'check',
    iconColor: '#7fe0ad',
    iconBackground: '#133a2a',
    layout: {
      paddingX: 22,
      paddingY: 24,
      contentGap: 15,
      align: 'center',
      contentWidth: 'compact',
      iconSize: 76,
    },
  },
  error: {
    title: 'Giriş tamamlanamadı',
    description: 'Oturum oluşturulmadı. Menüye dönüp yeniden deneyebilirsin.',
    primaryActionLabel: 'Menüye dön',
    icon: 'warn',
    iconColor: '#ffb0aa',
    iconBackground: '#421c1d',
    layout: {
      paddingX: 22,
      paddingY: 24,
      contentGap: 15,
      align: 'center',
      contentWidth: 'compact',
      iconSize: 76,
    },
  },
} as const satisfies {
  otp: Required<Omit<AuthOtpStateTheme, 'layout'>> & { layout: Required<Omit<AuthStateLayoutTheme, 'iconSize'>> }
  success: Required<Omit<AuthSuccessStateTheme, 'layout'>> & { layout: Required<AuthStateLayoutTheme> }
  error: Required<Omit<AuthErrorStateTheme, 'layout'>> & { layout: Required<AuthStateLayoutTheme> }
}

export interface CheckoutSurfaceTheme {
  preset: 'clean' | 'brand-header' | 'soft'
  sheetSize?: 'compact' | 'standard' | 'large'
  title?: string
  subtitle?: string
  successTitle?: string
  states?: CheckoutSurfaceStatesTheme
  override?: ThemeSurfaceOverride
}

export const DEFAULT_CHECKOUT_STATES = {
  payment: {
    title: 'Siparişini tamamla',
    description: 'Sepetini kontrol et ve ödeme yöntemini seç.',
    amountLabel: 'Ödenecek tutar',
    methodSectionTitle: 'Ödeme yöntemi',
    buyerSectionTitle: 'Ödeyen kişi',
    buyerSectionDescription: 'İyzico işlemi için gerekli bilgiler',
    cardActionLabel: 'öde',
    tableActionLabel: 'Garsonu çağır',
    layout: {
      paddingX: 16,
      sectionGap: 16,
      density: 'standard',
      contentWidth: 'standard',
    },
  },
  success: {
    title: 'Siparişin alındı',
    description: 'Ödemen doğrulandı. Masan açık kalır; dilersen sipariş vermeye devam edebilirsin.',
    primaryActionLabel: 'Siparişimi takip et',
    icon: 'check',
    iconColor: '#15824f',
    iconBackground: '#e4f3ea',
    layout: {
      paddingX: 18,
      paddingY: 18,
      contentGap: 16,
      align: 'center',
      contentWidth: 'standard',
      iconSize: 84,
    },
  },
  tablePayment: {
    title: 'Garson geliyor',
    description: 'Talebin ekibe iletildi. Ödeme masada nakit veya fiziksel POS ile alınacak.',
    primaryActionLabel: 'Siparişimi takip et',
    icon: 'bell',
    iconColor: '#a9802c',
    iconBackground: '#f4ead2',
    layout: {
      paddingX: 18,
      paddingY: 18,
      contentGap: 16,
      align: 'center',
      contentWidth: 'standard',
      iconSize: 84,
    },
  },
  error: {
    title: 'İşlem tamamlanamadı',
    primaryActionLabel: 'Tekrar dene',
    secondaryActionLabel: 'Şimdilik kapat',
    icon: 'warn',
    iconColor: '#b42318',
    iconBackground: '#fde7e5',
    layout: {
      paddingX: 18,
      paddingY: 18,
      contentGap: 16,
      align: 'center',
      contentWidth: 'standard',
      iconSize: 84,
    },
  },
} as const satisfies {
  payment: Required<Omit<CheckoutPaymentStateTheme, 'layout'>> & { layout: Required<CheckoutPaymentLayoutTheme> }
  success: Required<Omit<CheckoutSuccessStateTheme, 'layout'>> & { layout: Required<CheckoutResultLayoutTheme> }
  tablePayment: Required<Omit<CheckoutTablePaymentStateTheme, 'layout'>> & { layout: Required<CheckoutResultLayoutTheme> }
  error: Required<Omit<CheckoutErrorStateTheme, 'layout'>> & { layout: Required<CheckoutResultLayoutTheme> }
}

export interface ThemeSurfaces {
  home: HomeSurfaceTheme
  auth: AuthSurfaceTheme
  checkout: CheckoutSurfaceTheme
}

export interface GarsonlessTheme {
  experienceVersion?: 2
  surfaces?: ThemeSurfaces
  bg: string
  bodyFont: string
  displayFont: string
  fs: number
  lh: number
  radius: number
  shadow: 'none' | 'soft' | 'hard'
  border: 'none' | 'hair' | 'solid'
  accent: string
  accentSoft: string
  cta: string
  cardColor?: string
  textColor?: string
  mutedTextColor?: string
  ctaTextColor?: string
  borderColor?: string
  texture: 'solid' | 'noise' | 'grid'
  textureStrength?: number
  motion: 'full' | 'reduced' | 'none'
  showSelection: boolean
  cols: number
  gap: number
  pad: number
  sectionGap: number
  stickyHeader: boolean
  stickyNav: boolean
  headerAlign: 'left' | 'center'
  headerLayout?: 'split' | 'center' | 'stacked' | 'compact'
  headerPreset?: 'standard' | 'brand' | 'compact'
  headerShowContextBar?: boolean
  memberPlacement?: 'header' | 'drawer' | 'hidden'
  billPlacement?: 'header' | 'drawer' | 'hidden'
  cartPlacement?: 'header' | 'drawer' | 'footer' | 'hidden'
  servicePlacement?: 'header' | 'drawer' | 'floating' | 'hidden'
  headerLogoStyle: 'display' | 'wordmark' | 'image'
  headerShowSearch: boolean
  headerShowLang: boolean
  headerTableBadge: boolean
  headerShowBill: boolean
  headerStyle: 'solid' | 'blur'
  catnavStyle: 'pills' | 'visual' | 'underline' | 'segmented' | 'dots' | 'outlined'
  catnavVisualStyle?: 'compact' | 'overlay' | 'poster'
  catnavVisualCardWidth?: number
  catnavVisualCardHeight?: number
  catnavVisualRadius?: number
  catnavOverlayTextPosition?: 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right'
  catnavOverlayTextAlign?: 'left' | 'center' | 'right'
  catnavOverlayTextColor?: string
  catnavOverlayColor?: string
  catnavOverlayOpacity?: number
  catnavOverlayBlur?: number
  catnavShowIcons: boolean
  catnavShowCount: boolean
  catnavAlign?: 'left' | 'center' | 'spread'
  catnavDensity?: 'compact' | 'normal' | 'comfortable'
  catnavItemGap?: number
  catnavFontSize?: number
  catnavActiveStyle?: 'filled' | 'soft' | 'outline'
  catnavAutoCenter?: boolean
  catnavEdgeFade?: boolean
  menuFilterPresetIds?: MenuFilterPresetId[]
  menuCustomFilters?: ThemeMenuCustomFilter[]
  cardLayout: 'vertical' | 'horizontal' | 'minimal'
  cardImageAspect: '1:1' | '4:3' | '16:9'
  cardShowDesc: boolean
  cardShowTag: boolean
  cardCtaStyle: 'icon' | 'pill' | 'full'
  cardDensity?: 'compact' | 'normal' | 'spacious'
  cardShowImage?: boolean
  cardImageFit?: 'cover' | 'contain'
  cardImagePosition?: 'top' | 'center' | 'bottom'
  cardTitleLines?: 1 | 2 | 3
  cardDescriptionLines?: 1 | 2 | 3
  cardHorizontalImageWidth?: number
  cardPriceAlign?: 'left' | 'right'
  cardHover?: 'none' | 'lift' | 'glow'
  cardCtaIcon?: 'plus' | 'cart' | 'bag'
  cardPlaceholderStyle?: 'neutral' | 'accent' | 'outline'
  cartStyle: 'pill' | 'banner' | 'fab'
  cartHeaderTriggerStyle?: 'none' | 'icon' | 'pill'
  cartFooterTriggerStyle?: 'none' | 'bar' | 'tabbar' | 'fab' | 'thumbs' | 'pill'
  cartIcon: 'cart' | 'bag' | 'basket'
  cartShowBadge: boolean
  cartPillPosition?: 'floating' | 'edge'
  cartPillTone?: 'dark' | 'accent' | 'light'
  cartDrawerTone?: 'clean' | 'accentHeader'
  cartShowSubtotal?: boolean
  cartShowItemCount?: boolean
  cartPrimaryActionText?: string
  headerTagline?: string
  cartButtonText?: string
  cartEmptyText?: string
  pageDescription?: string
  sections?: string[]
  pageBlocks?: ThemePageBlock[]
  sectionSettings?: Record<string, Record<string, string>>
  footerEnabled: boolean
  footerTone: 'surface' | 'brand' | 'dark'
  footerShowLogo: boolean
  footerShowAddress: boolean
  footerShowContact: boolean
  footerShowSocial: boolean
  footerShowCopyright: boolean
  headerHeight: number
  headerPadY?: number
  headerBottomGap?: number
  headerBg: string
  headerBorder: boolean
  headerShowMenu: boolean
  headerNameSize: number
  headerLogoSize?: number
  drawerPreset?: 'modern' | 'minimal' | 'editorial'
  drawerPosition?: 'full' | 'below-header'
  drawerSide?: 'left' | 'right'
  drawerTone?: 'brand' | 'surface' | 'dark'
  drawerWidth?: number
  drawerRadius?: number
  drawerShadow?: 'soft' | 'strong' | 'none'
  drawerOverlayOpacity?: number
  drawerOverlayBlur?: number
  drawerDensity?: 'compact' | 'comfortable'
  drawerIconStyle?: 'soft' | 'filled' | 'outline'
  drawerActiveStyle?: 'soft' | 'bar' | 'filled'
  drawerTopFontSize?: number
  drawerSubFontSize?: number
  drawerFontRole?: 'body' | 'display'
  drawerTextCase?: 'default' | 'uppercase'
  drawerShowSearch?: boolean
  drawerShowBrand?: boolean
  drawerShowStatus?: boolean
  drawerShowTable?: boolean
  drawerShowCounts?: boolean
  drawerShowDescriptions?: boolean
  drawerShowIcons?: boolean
  drawerShowCart?: boolean
  drawerShowMember?: boolean
  drawerShowService?: boolean
  drawerShowBill?: boolean
  logoShape?: 'square' | 'rounded' | 'circle'
  logoShadow?: boolean
  logoBorder?: boolean
  logoBg?: 'none' | 'white' | 'accent'
  navTopGap?: number
  navBottomGap?: number
  categoryGridTopGap?: number
  sectionHeading: 'accent' | 'editorial' | 'catalog'
  sectionHeadingTopGap?: number
  sectionHeadingBottomGap?: number
  pageMaxWidth?: 'none' | '960' | '1200'
}

export const DEFAULT_THEME: GarsonlessTheme = {
  experienceVersion: 2,
  surfaces: {
    home: {
      enabled: false,
      compositionVersion: 2,
      blocks: [],
      sections: [
        { id: 'home-announcement', type: 'announcement', enabled: true, body: 'Bugün açığız', align: 'center', tone: 'brand' },
        { id: 'home-header', type: 'header', enabled: true, showMenuCta: true, buttonLabel: 'Menüyü Gör' },
        { id: 'home-hero', type: 'hero', enabled: true, eyebrow: 'Hoş geldiniz', title: 'Masamız hazır', body: 'Mutfağımızı, hikâyemizi ve öne çıkan lezzetlerimizi keşfedin.', buttonLabel: 'Menüyü Gör', showMenuCta: true, align: 'left', tone: 'dark' },
        { id: 'home-about', type: 'about', enabled: true, title: 'Hikâyemiz', body: 'İyi malzeme, özenli hazırlık ve sıcak bir masa deneyimi için buradayız.', align: 'left', tone: 'surface' },
        { id: 'home-categories', type: 'featured-categories', enabled: true, title: 'Menüden seçtiklerimiz', align: 'left' },
        { id: 'home-hours', type: 'hours-location', enabled: true, title: 'Bizi ziyaret edin', align: 'left' },
        { id: 'home-social', type: 'social-links', enabled: true, title: 'Bizi takip edin', align: 'center' },
        { id: 'home-footer', type: 'footer', enabled: true, showMenuCta: true, buttonLabel: 'Menüyü Gör', tone: 'dark' },
      ],
    },
    auth: {
      preset: 'brand-panel',
      title: 'Masabu hesabınla devam et',
      subtitle: 'Siparişlerini, favorilerini ve sadakat avantajlarını tek yerde tut.',
      header: {
        imageFit: 'cover',
        imagePositionX: 50,
        imagePositionY: 50,
        height: 'standard',
        contentTone: 'light',
        backgroundColor: '#12271c',
        logoMode: 'restaurant',
        title: '',
        slogan: '',
        align: 'center',
        overlay: 48,
      },
    },
    checkout: {
      preset: 'clean',
      sheetSize: 'standard',
      title: 'Siparişini tamamla',
      subtitle: 'Sepetini kontrol et ve ödeme yöntemini seç.',
      successTitle: 'Siparişin alındı',
    },
  },
  bg: '#f8f9fa',
  bodyFont: 'Nunito',
  displayFont: 'Pacifico',
  fs: 15,
  lh: 145,
  radius: 11,
  shadow: 'soft',
  border: 'hair',
  accent: '#a13b7a',
  accentSoft: '#f5e8f0',
  cta: '#7eb928',
  cardColor: '#ffffff',
  textColor: '#1c1d20',
  mutedTextColor: '#6c6f76',
  ctaTextColor: '#ffffff',
  borderColor: '#e3e4e7',
  texture: 'solid',
  textureStrength: 4,
  motion: 'full',
  showSelection: false,
  cols: 2,
  gap: 12,
  pad: 16,
  sectionGap: 18,
  stickyHeader: true,
  stickyNav: true,
  headerAlign: 'left',
  headerLayout: 'split',
  headerPreset: 'standard',
  headerShowContextBar: true,
  memberPlacement: 'drawer',
  billPlacement: 'drawer',
  cartPlacement: 'footer',
  servicePlacement: 'drawer',
  headerLogoStyle: 'display',
  headerShowSearch: true,
  headerShowLang: false,
  headerTableBadge: true,
  headerShowBill: true,
  headerStyle: 'solid',
  catnavStyle: 'pills',
  catnavVisualStyle: 'compact',
  catnavVisualCardWidth: 150,
  catnavVisualCardHeight: 104,
  catnavVisualRadius: 22,
  catnavOverlayTextPosition: 'center',
  catnavOverlayTextAlign: 'center',
  catnavOverlayTextColor: '#ffffff',
  catnavOverlayColor: '#000000',
  catnavOverlayOpacity: 45,
  catnavOverlayBlur: 0,
  catnavShowIcons: false,
  catnavShowCount: false,
  catnavAlign: 'left',
  catnavDensity: 'normal',
  catnavItemGap: 8,
  catnavFontSize: 12,
  catnavActiveStyle: 'filled',
  catnavAutoCenter: true,
  catnavEdgeFade: true,
  menuFilterPresetIds: ['vegan', 'vegetarian', 'halal'],
  menuCustomFilters: [],
  cardLayout: 'vertical',
  cardImageAspect: '4:3',
  cardShowDesc: true,
  cardShowTag: true,
  cardCtaStyle: 'icon',
  cardDensity: 'normal',
  cardShowImage: true,
  cardImageFit: 'cover',
  cardImagePosition: 'center',
  cardTitleLines: 2,
  cardDescriptionLines: 2,
  cardHorizontalImageWidth: 92,
  cardPriceAlign: 'left',
  cardHover: 'none',
  cardCtaIcon: 'plus',
  cardPlaceholderStyle: 'neutral',
  cartStyle: 'pill',
  cartHeaderTriggerStyle: 'icon',
  cartFooterTriggerStyle: 'pill',
  cartIcon: 'cart',
  cartShowBadge: true,
  cartPillPosition: 'floating',
  cartPillTone: 'dark',
  cartDrawerTone: 'clean',
  cartShowSubtotal: true,
  cartShowItemCount: true,
  cartPrimaryActionText: 'Sipariş ver',
  headerTagline: '',
  cartButtonText: 'Sepeti gör',
  cartEmptyText: 'Sepetiniz boş',
  pageDescription: '',
  sections: [],
  pageBlocks: [],
  sectionSettings: {},
  footerEnabled: true,
  footerTone: 'surface',
  footerShowLogo: true,
  footerShowAddress: true,
  footerShowContact: true,
  footerShowSocial: true,
  footerShowCopyright: true,
  headerHeight: 64,
  headerPadY: 8,
  headerBottomGap: 0,
  headerBg: '#ffffff',
  headerBorder: false,
  headerShowMenu: true,
  headerNameSize: 28,
  headerLogoSize: 40,
  drawerPreset: 'modern',
  drawerPosition: 'full',
  drawerSide: 'left',
  drawerTone: 'brand',
  drawerWidth: 370,
  drawerRadius: 22,
  drawerShadow: 'strong',
  drawerOverlayOpacity: 48,
  drawerOverlayBlur: 2,
  drawerDensity: 'comfortable',
  drawerIconStyle: 'soft',
  drawerActiveStyle: 'bar',
  drawerTopFontSize: 14,
  drawerSubFontSize: 13,
  drawerFontRole: 'body',
  drawerTextCase: 'default',
  drawerShowSearch: true,
  drawerShowBrand: true,
  drawerShowStatus: true,
  drawerShowTable: true,
  drawerShowCounts: true,
  drawerShowDescriptions: true,
  drawerShowIcons: true,
  drawerShowCart: true,
  drawerShowMember: true,
  drawerShowService: true,
  drawerShowBill: true,
  logoShape: 'rounded',
  logoShadow: false,
  logoBorder: false,
  logoBg: 'none',
  navTopGap: 10,
  navBottomGap: 14,
  categoryGridTopGap: 18,
  sectionHeading: 'accent',
  sectionHeadingTopGap: 24,
  sectionHeadingBottomGap: 12,
  pageMaxWidth: 'none',
}
