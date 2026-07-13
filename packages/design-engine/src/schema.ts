// ── Flat theme (canonical) ────────────────────────────────────────────────────

export interface ThemePageBlock {
  type: 'section' | 'category' | 'nav'
  id: string
}

export interface GarsonlessTheme {
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
  cardVariant?: 'default' | 'spain'
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
  announcementEnabled: boolean
  announcementText: string
  announcementBg: string
  announcementColor: string
  announcementStyle: 'static' | 'marquee' | 'fade' | 'slide'
  announcementSpeed: number
  headerHeight: number
  headerPadY?: number
  headerBottomGap?: number
  headerBg: string
  headerBorder: boolean
  headerShowMenu: boolean
  headerNameSize: number
  headerLogoSize?: number
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
  cardVariant: 'default',
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
  cartHeaderTriggerStyle: 'none',
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
  announcementEnabled: false,
  announcementText: 'Hoş geldiniz! 🎉',
  announcementBg: '#1a1a1a',
  announcementColor: '#ffffff',
  announcementStyle: 'marquee',
  announcementSpeed: 3,
  headerHeight: 64,
  headerPadY: 8,
  headerBottomGap: 0,
  headerBg: '#ffffff',
  headerBorder: false,
  headerShowMenu: true,
  headerNameSize: 28,
  headerLogoSize: 40,
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

// ── Legacy nested config (menu app backward compat) ───────────────────────────

export interface PageConfig {
  backgroundColor: string
  fontFamily: string
  fontFamilyDisplay: string
  baseFontSize: number
  globalRadius: number
}

export interface HeaderConfig {
  style: 'minimal' | 'centered' | 'hero'
  backgroundColor: string
  textColor: string
  logoSize: 'small' | 'medium' | 'large'
  useDisplayFont?: boolean
  showTableBadge?: boolean
  showSearch?: boolean
  sticky: boolean
  showRestaurantName: boolean
  borderBottom: boolean
}

export interface CategoryNavConfig {
  style: 'pills' | 'underline' | 'sidebar' | 'bottom-tabs'
  backgroundColor: string
  textColor: string
  activeColor: string
  activeTextColor: string
  fontSize: 'sm' | 'md' | 'lg'
  sticky: boolean
}

export interface ProductCardConfig {
  layout: 'grid' | 'list' | 'compact'
  imageRatio: '1:1' | '4:3' | '16:9' | 'none'
  showDescription: boolean
  descriptionLines: number
  borderRadius: number
  backgroundColor: string
  textColor: string
  priceColor: string
  addButtonStyle: 'icon' | 'text' | 'full-width'
  addButtonColor: string
  addButtonTextColor: string
  showBadge: boolean
  shadow: 'none' | 'sm' | 'md' | 'lg'
}

export interface CartDrawerConfig {
  position: 'bottom' | 'right'
  backgroundColor: string
  textColor: string
  accentColor: string
  orderButtonStyle: 'floating' | 'sticky-bottom' | 'inline'
  orderButtonColor: string
  orderButtonTextColor: string
  orderButtonRadius: number
  floatingStyle?: 'pill' | 'banner' | 'fab'
  cartIcon?: 'cart' | 'bag' | 'basket'
  showCartBadge?: boolean
}

export interface MenuPageConfig {
  page: PageConfig
  header: HeaderConfig
  categoryNav: CategoryNavConfig
  productCard: ProductCardConfig
  cartDrawer: CartDrawerConfig
}

export const DEFAULT_CONFIG: MenuPageConfig = {
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    fontFamilyDisplay: 'Inter',
    baseFontSize: 16,
    globalRadius: 8,
  },
  header: {
    style: 'minimal',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    logoSize: 'medium',
    useDisplayFont: true,
    sticky: false,
    showRestaurantName: true,
    borderBottom: true,
  },
  categoryNav: {
    style: 'underline',
    backgroundColor: '#ffffff',
    textColor: '#64748b',
    activeColor: '#0f172a',
    activeTextColor: '#0f172a',
    fontSize: 'md',
    sticky: true,
  },
  productCard: {
    layout: 'grid',
    imageRatio: '1:1',
    showDescription: true,
    descriptionLines: 2,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
    priceColor: '#6366f1',
    addButtonStyle: 'icon',
    addButtonColor: '#0f172a',
    addButtonTextColor: '#ffffff',
    showBadge: false,
    shadow: 'sm',
  },
  cartDrawer: {
    position: 'right',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    accentColor: '#6366f1',
    orderButtonStyle: 'sticky-bottom',
    orderButtonColor: '#0f172a',
    orderButtonTextColor: '#ffffff',
    orderButtonRadius: 8,
    floatingStyle: 'pill',
    cartIcon: 'cart',
    showCartBadge: true,
  },
}
