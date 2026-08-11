import {
  DEFAULT_THEME,
  type AuthErrorStateTheme,
  type AuthHeaderTheme,
  type AuthOtpStateTheme,
  type AuthStateLayoutTheme,
  type AuthSuccessStateTheme,
  type AuthSurfaceStatesTheme,
  type AuthSurfaceTheme,
  type CheckoutErrorStateTheme,
  type CheckoutPaymentLayoutTheme,
  type CheckoutPaymentStateTheme,
  type CheckoutResultLayoutTheme,
  type CheckoutSuccessStateTheme,
  type CheckoutSurfaceStatesTheme,
  type CheckoutSurfaceTheme,
  type CheckoutTablePaymentStateTheme,
  type GarsonlessTheme,
  type HomeSectionDefinitionId,
  type HomeSectionType,
  type HomeSurfaceBlock,
  type HomeSurfaceSection,
  type HomeSurfaceTheme,
  type MenuFilterPresetId,
  type ThemeMenuCustomFilter,
  type ThemePageBlock,
  type ThemeSurfaceOverride,
  type ThemeSurfaces,
} from './schema'
import { TEMPLATES } from './templates'

export const CANONICAL_THEME_ID = 'default' as const

const MAX_THEME_BYTES = 128 * 1024
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FONT_NAME = /^[\p{L}\p{N} .,'_-]{1,80}$/u
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/
const SAFE_FILTER_LABEL = /^[\p{L}\p{N} .,&+'-]{1,40}$/u
const MENU_FILTER_PRESETS = new Set<MenuFilterPresetId>(['vegan', 'vegetarian', 'halal'])
const REMOVED_SECTION_DEFINITION_IDS = new Set(['social-block', 'footer'])
const HOME_SECTION_TYPES = new Set<HomeSectionType>([
  'announcement', 'header', 'hero', 'about', 'featured-categories', 'hours-location',
  'social-links', 'footer', 'hero-video', 'featured-products', 'gallery', 'promo-slider',
])
const HOME_BLOCK_SECTION_IDS = new Set<HomeSectionDefinitionId>([
  'hero-banner', 'storefront-video-hero', 'promo-strip', 'featured-scroll', 'chef-pick',
  'combo-ribbon', 'discount-badge', 'daily-special', 'promo-slider', 'gallery',
])
const HOME_BLOCK_SETTING_KEYS: Record<HomeSectionDefinitionId, ReadonlySet<string>> = {
  'hero-banner': new Set(),
  'storefront-video-hero': new Set([
    'showStatus', 'showEyebrow', 'eyebrow', 'showTitle', 'title', 'showBody', 'body',
    'showCta', 'cta', 'videoUrl', 'posterUrl', 'imageFit', 'imagePosition', 'overlay',
    'textColor', 'align', 'contentPositionX', 'contentPositionY', 'height', 'contentWidth',
  ]),
  'promo-strip': new Set(),
  'featured-scroll': new Set(),
  'chef-pick': new Set(),
  'combo-ribbon': new Set(),
  'discount-badge': new Set(),
  'daily-special': new Set(),
  'promo-slider': new Set(),
  gallery: new Set(),
}
const HOME_ONLY_SECTION_IDS = new Set<HomeSectionDefinitionId>(['storefront-video-hero'])
const HOME_SECTION_TEXT_LIMITS = {
  eyebrow: 80,
  title: 140,
  body: 1_200,
  buttonLabel: 40,
  address: 300,
  phone: 40,
  hours: 500,
} as const

const COLOR_KEYS = new Set([
  'bg', 'accent', 'accentSoft', 'cta', 'cardColor', 'textColor',
  'mutedTextColor', 'ctaTextColor', 'borderColor', 'catnavOverlayTextColor',
  'catnavOverlayColor', 'headerBg',
])

const FONT_KEYS = new Set(['bodyFont', 'displayFont'])

const STRING_OPTIONS: Partial<Record<keyof GarsonlessTheme, readonly string[]>> = {
  shadow: ['none', 'soft', 'hard'],
  border: ['none', 'hair', 'solid'],
  texture: ['solid', 'noise', 'grid'],
  motion: ['full', 'reduced', 'none'],
  headerAlign: ['left', 'center'],
  headerLayout: ['split', 'center', 'stacked', 'compact'],
  headerPreset: ['standard', 'brand', 'compact'],
  memberPlacement: ['header', 'drawer', 'hidden'],
  billPlacement: ['header', 'drawer', 'hidden'],
  cartPlacement: ['header', 'drawer', 'footer', 'hidden'],
  servicePlacement: ['header', 'drawer', 'floating', 'hidden'],
  headerLogoStyle: ['display', 'wordmark', 'image'],
  headerStyle: ['solid', 'blur'],
  catnavStyle: ['pills', 'visual', 'underline', 'segmented', 'dots', 'outlined'],
  catnavVisualStyle: ['compact', 'overlay', 'poster'],
  catnavOverlayTextPosition: ['center', 'bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right'],
  catnavOverlayTextAlign: ['left', 'center', 'right'],
  catnavAlign: ['left', 'center', 'spread'],
  catnavDensity: ['compact', 'normal', 'comfortable'],
  catnavActiveStyle: ['filled', 'soft', 'outline'],
  cardLayout: ['vertical', 'horizontal', 'minimal'],
  cardImageAspect: ['1:1', '4:3', '16:9'],
  cardCtaStyle: ['icon', 'pill', 'full'],
  cardDensity: ['compact', 'normal', 'spacious'],
  cardImageFit: ['cover', 'contain'],
  cardImagePosition: ['top', 'center', 'bottom'],
  cardPriceAlign: ['left', 'right'],
  cardHover: ['none', 'lift', 'glow'],
  cardCtaIcon: ['plus', 'cart', 'bag'],
  cardPlaceholderStyle: ['neutral', 'accent', 'outline'],
  cartStyle: ['pill', 'banner', 'fab'],
  cartHeaderTriggerStyle: ['none', 'icon', 'pill'],
  cartFooterTriggerStyle: ['none', 'bar', 'tabbar', 'fab', 'thumbs', 'pill'],
  cartIcon: ['cart', 'bag', 'basket'],
  cartPillPosition: ['floating', 'edge'],
  cartPillTone: ['dark', 'accent', 'light'],
  cartDrawerTone: ['clean', 'accentHeader'],
  footerTone: ['surface', 'brand', 'dark'],
  logoShape: ['square', 'rounded', 'circle'],
  logoBg: ['none', 'white', 'accent'],
  sectionHeading: ['accent', 'editorial', 'catalog'],
  pageMaxWidth: ['none', '960', '1200'],
  drawerPreset: ['modern', 'minimal', 'editorial'],
  drawerPosition: ['full', 'below-header'],
  drawerSide: ['left', 'right'],
  drawerTone: ['brand', 'surface', 'dark'],
  drawerShadow: ['soft', 'strong', 'none'],
  drawerDensity: ['compact', 'comfortable'],
  drawerIconStyle: ['soft', 'filled', 'outline'],
  drawerActiveStyle: ['soft', 'bar', 'filled'],
  drawerFontRole: ['body', 'display'],
  drawerTextCase: ['default', 'uppercase'],
}

const NUMBER_RANGES: Partial<Record<keyof GarsonlessTheme, readonly [number, number]>> = {
  fs: [10, 32], lh: [100, 220], radius: [0, 80], textureStrength: [0, 100],
  cols: [1, 4], gap: [0, 80], pad: [0, 96], sectionGap: [0, 120],
  catnavVisualCardWidth: [72, 420], catnavVisualCardHeight: [48, 420],
  catnavVisualRadius: [0, 80], catnavOverlayOpacity: [0, 100],
  catnavOverlayBlur: [0, 32], catnavItemGap: [0, 48], catnavFontSize: [10, 28],
  cardTitleLines: [1, 3], cardDescriptionLines: [1, 3],
  cardHorizontalImageWidth: [48, 240],
  headerHeight: [40, 180], headerPadY: [0, 64], headerBottomGap: [0, 96],
  headerNameSize: [12, 80], headerLogoSize: [16, 120], navTopGap: [0, 96],
  navBottomGap: [0, 96], categoryGridTopGap: [0, 120],
  sectionHeadingTopGap: [0, 120], sectionHeadingBottomGap: [0, 120],
  drawerWidth: [260, 440], drawerRadius: [0, 36], drawerOverlayOpacity: [0, 80],
  drawerOverlayBlur: [0, 12], drawerTopFontSize: [12, 20], drawerSubFontSize: [11, 18],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeString(value: unknown, max = 500): string | null {
  return typeof value === 'string' && value.length <= max ? value : null
}

const UNSAFE_AUTH_COPY = /[<>{}]|\b(?:https?:\/\/|www\.|javascript:|data:|url\s*\(|var\s*\(|@import\b)|\b(?:background|color|display|position|font|margin|padding|width|height)\s*:/i

function safeAuthCopy(value: unknown, max: number): string | null {
  const text = safeString(value, max)
  if (text === null || UNSAFE_AUTH_COPY.test(text)) return null
  return text
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2_048) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return value
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return value
  } catch {
    return null
  }
  return null
}

function safeStringArray(value: unknown, maxEntries: number, maxLength = 100): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const entries = value.slice(0, maxEntries).flatMap((candidate) => {
    const text = safeString(candidate, maxLength)
    return text ? [text] : []
  })
  return Array.from(new Set(entries))
}

function safeUrlArray(value: unknown, maxEntries: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const entries = value.slice(0, maxEntries).flatMap((candidate) => {
    const url = safeUrl(candidate)
    return url ? [url] : []
  })
  return Array.from(new Set(entries))
}

function sanitizeMenuFilterPresetIds(value: unknown): MenuFilterPresetId[] | undefined {
  if (!Array.isArray(value)) return undefined
  return Array.from(new Set(value.filter((candidate): candidate is MenuFilterPresetId =>
    typeof candidate === 'string' && MENU_FILTER_PRESETS.has(candidate as MenuFilterPresetId))))
}

function sanitizeMenuCustomFilters(value: unknown): ThemeMenuCustomFilter[] | undefined {
  if (!Array.isArray(value)) return undefined
  const filters = value.slice(0, 12).flatMap((candidate) => {
    if (!isRecord(candidate)) return []
    const id = safeString(candidate['id'], 100)
    const label = safeString(candidate['label'], 40)?.trim()
    const itemIds = safeStringArray(candidate['itemIds'], 200)
    if (
      !id ||
      !SAFE_ID.test(id) ||
      MENU_FILTER_PRESETS.has(id as MenuFilterPresetId) ||
      !label ||
      !SAFE_FILTER_LABEL.test(label) ||
      !itemIds
    ) return []
    return [{ id, label, itemIds }]
  })
  return filters.filter((filter, index) => filters.findIndex((candidate) => candidate.id === filter.id) === index)
}

function sanitizeSurfaceOverride(value: unknown): ThemeSurfaceOverride | undefined {
  if (!isRecord(value)) return undefined
  const result: ThemeSurfaceOverride = {}
  for (const key of ['background', 'surface', 'text', 'mutedText', 'fieldSurface', 'fieldBorder', 'accent', 'accentSoft', 'cta', 'ctaText'] as const) {
    const candidate = value[key]
    if (typeof candidate === 'string' && HEX_COLOR.test(candidate)) result[key] = candidate
  }
  for (const key of ['bodyFont', 'displayFont'] as const) {
    const candidate = value[key]
    if (typeof candidate === 'string' && FONT_NAME.test(candidate)) result[key] = candidate
  }
  if (typeof value['radius'] === 'number' && Number.isFinite(value['radius'])) {
    result.radius = Math.min(80, Math.max(0, value['radius']))
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function sanitizeHomeSection(value: unknown): HomeSurfaceSection | null {
  if (!isRecord(value)) return null
  const id = safeString(value['id'], 100)
  const type = value['type']
  if (!id || !SAFE_ID.test(id) || typeof type !== 'string' || !HOME_SECTION_TYPES.has(type as HomeSectionType)) return null
  const result: HomeSurfaceSection = {
    id,
    type: type as HomeSectionType,
    enabled: value['enabled'] !== false,
  }
  for (const [key, max] of Object.entries(HOME_SECTION_TEXT_LIMITS)) {
    const text = safeString(value[key], max)
    if (text !== null) Object.assign(result, { [key]: text })
  }
  for (const key of ['imageUrl', 'videoUrl', 'posterUrl', 'instagramUrl', 'facebookUrl', 'websiteUrl'] as const) {
    const url = safeUrl(value[key])
    if (url) result[key] = url
  }
  const imageUrls = safeUrlArray(value['imageUrls'], 12)
  if (imageUrls) result.imageUrls = imageUrls
  const categoryIds = safeStringArray(value['categoryIds'], 12)
  if (categoryIds) result.categoryIds = categoryIds
  const menuItemIds = safeStringArray(value['menuItemIds'], 16)
  if (menuItemIds) result.menuItemIds = menuItemIds
  if (typeof value['showMenuCta'] === 'boolean') result.showMenuCta = value['showMenuCta']
  if (value['align'] === 'left' || value['align'] === 'center') result.align = value['align']
  if (value['tone'] === 'surface' || value['tone'] === 'brand' || value['tone'] === 'dark') result.tone = value['tone']
  return result
}

function sanitizeHomeBlock(value: unknown): HomeSurfaceBlock | null {
  if (!isRecord(value)) return null
  const id = safeString(value['id'], 100)
  const sectionId = safeString(value['sectionId'], 100)
  if (!id || !sectionId || !SAFE_ID.test(id) || !HOME_BLOCK_SECTION_IDS.has(sectionId as HomeSectionDefinitionId)) return null
  return {
    id,
    sectionId: sectionId as HomeSectionDefinitionId,
    enabled: value['enabled'] !== false,
  }
}

function sanitizeHomeSurface(value: unknown, fallback: HomeSurfaceTheme): HomeSurfaceTheme {
  if (!isRecord(value)) return fallback
  const rawSections = Array.isArray(value['sections'])
    ? value['sections'].slice(0, 40).flatMap((section) => {
        const sanitized = sanitizeHomeSection(section)
        return sanitized ? [sanitized] : []
      })
    : fallback.sections
  const uniqueSections = rawSections.filter((section, index, sections) =>
    sections.findIndex((candidate) => candidate.id === section.id) === index)
  if (!uniqueSections.some((section) => section.enabled && section.showMenuCta)) {
    const preferred = uniqueSections.find((section) => section.enabled && (section.type === 'hero' || section.type === 'header' || section.type === 'footer'))
    if (preferred) preferred.showMenuCta = true
    else uniqueSections.unshift({ ...fallback.sections[2]!, id: 'home-required-menu-cta', enabled: true, showMenuCta: true })
  }
  const rawSeo = value['seo']
  const seo = isRecord(rawSeo) ? {
    ...(safeString(rawSeo['title'], 70) !== null ? { title: safeString(rawSeo['title'], 70)! } : {}),
    ...(safeString(rawSeo['description'], 180) !== null ? { description: safeString(rawSeo['description'], 180)! } : {}),
  } : undefined
  const override = sanitizeSurfaceOverride(value['override'])
  const compositionVersion = value['compositionVersion'] === 2 ? 2 : undefined
  const rawBlocks = compositionVersion === 2
    ? (Array.isArray(value['blocks']) ? value['blocks'] : fallback.blocks ?? [])
        .slice(0, 40)
        .flatMap((block) => {
          const sanitized = sanitizeHomeBlock(block)
          return sanitized ? [sanitized] : []
        })
    : undefined
  const uniqueBlocks = rawBlocks?.filter((block, index, blocks) =>
    blocks.findIndex((candidate) => candidate.id === block.id) === index)
  return {
    enabled: value['enabled'] === true,
    ...(compositionVersion === 2 ? { compositionVersion: 2 as const, blocks: uniqueBlocks ?? [] } : {}),
    sections: uniqueSections,
    ...(override ? { override } : {}),
    ...(seo && Object.keys(seo).length > 0 ? { seo } : {}),
  }
}

function boundedAuthNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(max, Math.max(min, Math.round(value)))
}

function sanitizeAuthStateLayout(value: unknown, allowIconSize: boolean): AuthStateLayoutTheme | undefined {
  if (!isRecord(value)) return undefined
  const paddingX = boundedAuthNumber(value['paddingX'], 12, 40)
  const paddingY = boundedAuthNumber(value['paddingY'], 12, 56)
  const contentGap = boundedAuthNumber(value['contentGap'], 8, 32)
  const align = value['align'] === 'left' || value['align'] === 'center' ? value['align'] : undefined
  const contentWidth = value['contentWidth'] === 'compact' || value['contentWidth'] === 'standard' || value['contentWidth'] === 'full'
    ? value['contentWidth']
    : undefined
  const iconSize = allowIconSize ? boundedAuthNumber(value['iconSize'], 56, 96) : undefined
  const layout: AuthStateLayoutTheme = {
    ...(paddingX !== undefined ? { paddingX } : {}),
    ...(paddingY !== undefined ? { paddingY } : {}),
    ...(contentGap !== undefined ? { contentGap } : {}),
    ...(align ? { align } : {}),
    ...(contentWidth ? { contentWidth } : {}),
    ...(iconSize !== undefined ? { iconSize } : {}),
  }
  return Object.keys(layout).length > 0 ? layout : undefined
}

function sanitizeAuthOtpState(value: unknown): AuthOtpStateTheme | undefined {
  if (!isRecord(value)) return undefined
  const title = safeAuthCopy(value['title'], 100)
  const description = safeAuthCopy(value['description'], 240)
  const primaryActionLabel = safeAuthCopy(value['primaryActionLabel'], 60)
  const resendLabel = safeAuthCopy(value['resendLabel'], 60)
  const layout = sanitizeAuthStateLayout(value['layout'], false)
  const state: AuthOtpStateTheme = {
    ...(title !== null ? { title } : {}),
    ...(description !== null ? { description } : {}),
    ...(primaryActionLabel !== null ? { primaryActionLabel } : {}),
    ...(resendLabel !== null ? { resendLabel } : {}),
    ...(layout ? { layout } : {}),
  }
  return Object.keys(state).length > 0 ? state : undefined
}

function sanitizeAuthSuccessState(value: unknown): AuthSuccessStateTheme | undefined {
  if (!isRecord(value)) return undefined
  const title = safeAuthCopy(value['title'], 100)
  const description = safeAuthCopy(value['description'], 240)
  const primaryActionLabel = safeAuthCopy(value['primaryActionLabel'], 60)
  const icon = value['icon'] === 'check' || value['icon'] === 'shield' || value['icon'] === 'sparkles' || value['icon'] === 'star'
    ? value['icon']
    : undefined
  const iconColor = typeof value['iconColor'] === 'string' && /^#[0-9a-f]{6}$/i.test(value['iconColor']) ? value['iconColor'] : undefined
  const iconBackground = typeof value['iconBackground'] === 'string' && /^#[0-9a-f]{6}$/i.test(value['iconBackground']) ? value['iconBackground'] : undefined
  const layout = sanitizeAuthStateLayout(value['layout'], true)
  const state: AuthSuccessStateTheme = {
    ...(title !== null ? { title } : {}),
    ...(description !== null ? { description } : {}),
    ...(primaryActionLabel !== null ? { primaryActionLabel } : {}),
    ...(icon ? { icon } : {}),
    ...(iconColor ? { iconColor } : {}),
    ...(iconBackground ? { iconBackground } : {}),
    ...(layout ? { layout } : {}),
  }
  return Object.keys(state).length > 0 ? state : undefined
}

function sanitizeAuthErrorState(value: unknown): AuthErrorStateTheme | undefined {
  if (!isRecord(value)) return undefined
  const title = safeAuthCopy(value['title'], 100)
  const description = safeAuthCopy(value['description'], 240)
  const primaryActionLabel = safeAuthCopy(value['primaryActionLabel'], 60)
  const icon = value['icon'] === 'warn' || value['icon'] === 'close' || value['icon'] === 'refresh' || value['icon'] === 'lock'
    ? value['icon']
    : undefined
  const iconColor = typeof value['iconColor'] === 'string' && /^#[0-9a-f]{6}$/i.test(value['iconColor']) ? value['iconColor'] : undefined
  const iconBackground = typeof value['iconBackground'] === 'string' && /^#[0-9a-f]{6}$/i.test(value['iconBackground']) ? value['iconBackground'] : undefined
  const layout = sanitizeAuthStateLayout(value['layout'], true)
  const state: AuthErrorStateTheme = {
    ...(title !== null ? { title } : {}),
    ...(description !== null ? { description } : {}),
    ...(primaryActionLabel !== null ? { primaryActionLabel } : {}),
    ...(icon ? { icon } : {}),
    ...(iconColor ? { iconColor } : {}),
    ...(iconBackground ? { iconBackground } : {}),
    ...(layout ? { layout } : {}),
  }
  return Object.keys(state).length > 0 ? state : undefined
}

function sanitizeAuthStates(value: unknown): AuthSurfaceStatesTheme | undefined {
  if (!isRecord(value)) return undefined
  const otp = sanitizeAuthOtpState(value['otp'])
  const success = sanitizeAuthSuccessState(value['success'])
  const error = sanitizeAuthErrorState(value['error'])
  const states: AuthSurfaceStatesTheme = {
    ...(otp ? { otp } : {}),
    ...(success ? { success } : {}),
    ...(error ? { error } : {}),
  }
  return Object.keys(states).length > 0 ? states : undefined
}

function sanitizeAuthSurface(value: unknown, fallback: AuthSurfaceTheme): AuthSurfaceTheme {
  if (!isRecord(value)) return fallback
  const preset = value['preset'] === 'minimal' || value['preset'] === 'immersive' || value['preset'] === 'brand-panel'
    ? value['preset']
    : fallback.preset
  const title = safeString(value['title'], 100)
  const subtitle = safeString(value['subtitle'], 240)
  const heroImageUrl = safeUrl(value['heroImageUrl'])
  const header = sanitizeAuthHeader(value['header'], fallback.header, heroImageUrl)
  const states = sanitizeAuthStates(value['states'])
  const override = sanitizeSurfaceOverride(value['override'])
  return {
    preset,
    ...(title !== null ? { title } : {}),
    ...(subtitle !== null ? { subtitle } : {}),
    header,
    ...(states ? { states } : {}),
    ...(heroImageUrl ? { heroImageUrl } : {}),
    ...(override ? { override } : {}),
  }
}

function sanitizeAuthHeader(
  value: unknown,
  fallback: AuthHeaderTheme,
  legacyBackgroundImageUrl: string | null,
): AuthHeaderTheme {
  if (!isRecord(value)) {
    return {
      ...fallback,
      ...(legacyBackgroundImageUrl ? { backgroundImageUrl: legacyBackgroundImageUrl } : {}),
    }
  }
  const logoMode = value['logoMode'] === 'none' || value['logoMode'] === 'custom' || value['logoMode'] === 'restaurant'
    ? value['logoMode']
    : fallback.logoMode
  const backgroundImageUrl = safeUrl(value['backgroundImageUrl']) ?? legacyBackgroundImageUrl
  const logoUrl = safeUrl(value['logoUrl'])
  const title = safeString(value['title'], 100)
  const slogan = safeString(value['slogan'], 180)
  const align = value['align'] === 'left' || value['align'] === 'center' ? value['align'] : fallback.align
  const imageFit = value['imageFit'] === 'contain' || value['imageFit'] === 'cover'
    ? value['imageFit']
    : fallback.imageFit ?? 'cover'
  const imagePositionX = typeof value['imagePositionX'] === 'number' && Number.isFinite(value['imagePositionX'])
    ? Math.min(100, Math.max(0, Math.round(value['imagePositionX'])))
    : fallback.imagePositionX ?? 50
  const imagePositionY = typeof value['imagePositionY'] === 'number' && Number.isFinite(value['imagePositionY'])
    ? Math.min(100, Math.max(0, Math.round(value['imagePositionY'])))
    : fallback.imagePositionY ?? 50
  const height = value['height'] === 'compact' || value['height'] === 'wide' || value['height'] === 'standard'
    ? value['height']
    : fallback.height ?? 'standard'
  const contentTone = value['contentTone'] === 'dark' || value['contentTone'] === 'light'
    ? value['contentTone']
    : fallback.contentTone ?? 'light'
  const backgroundColor = typeof value['backgroundColor'] === 'string' && HEX_COLOR.test(value['backgroundColor'])
    ? value['backgroundColor']
    : fallback.backgroundColor ?? '#12271c'
  const overlay = typeof value['overlay'] === 'number' && Number.isFinite(value['overlay'])
    ? Math.min(85, Math.max(0, Math.round(value['overlay'])))
    : fallback.overlay
  return {
    logoMode,
    align,
    overlay,
    imageFit,
    imagePositionX,
    imagePositionY,
    height,
    contentTone,
    backgroundColor,
    ...(backgroundImageUrl ? { backgroundImageUrl } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    ...(title !== null ? { title } : {}),
    ...(slogan !== null ? { slogan } : {}),
  }
}

function boundedCheckoutNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(max, Math.max(min, Math.round(value)))
}

function sanitizeCheckoutPaymentLayout(value: unknown): CheckoutPaymentLayoutTheme | undefined {
  if (!isRecord(value)) return undefined
  const paddingX = boundedCheckoutNumber(value['paddingX'], 12, 28)
  const sectionGap = boundedCheckoutNumber(value['sectionGap'], 12, 28)
  const density = value['density'] === 'compact' || value['density'] === 'standard' ? value['density'] : undefined
  const contentWidth = value['contentWidth'] === 'standard' || value['contentWidth'] === 'wide' ? value['contentWidth'] : undefined
  const layout: CheckoutPaymentLayoutTheme = {
    ...(paddingX !== undefined ? { paddingX } : {}),
    ...(sectionGap !== undefined ? { sectionGap } : {}),
    ...(density ? { density } : {}),
    ...(contentWidth ? { contentWidth } : {}),
  }
  return Object.keys(layout).length > 0 ? layout : undefined
}

function sanitizeCheckoutResultLayout(value: unknown): CheckoutResultLayoutTheme | undefined {
  if (!isRecord(value)) return undefined
  const paddingX = boundedCheckoutNumber(value['paddingX'], 12, 40)
  const paddingY = boundedCheckoutNumber(value['paddingY'], 12, 56)
  const contentGap = boundedCheckoutNumber(value['contentGap'], 8, 32)
  const align = value['align'] === 'left' || value['align'] === 'center' ? value['align'] : undefined
  const contentWidth = value['contentWidth'] === 'compact' || value['contentWidth'] === 'standard' || value['contentWidth'] === 'full'
    ? value['contentWidth']
    : undefined
  const iconSize = boundedCheckoutNumber(value['iconSize'], 56, 96)
  const layout: CheckoutResultLayoutTheme = {
    ...(paddingX !== undefined ? { paddingX } : {}),
    ...(paddingY !== undefined ? { paddingY } : {}),
    ...(contentGap !== undefined ? { contentGap } : {}),
    ...(align ? { align } : {}),
    ...(contentWidth ? { contentWidth } : {}),
    ...(iconSize !== undefined ? { iconSize } : {}),
  }
  return Object.keys(layout).length > 0 ? layout : undefined
}

function safeCheckoutColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined
}

function sanitizeCheckoutPaymentState(value: unknown): CheckoutPaymentStateTheme | undefined {
  if (!isRecord(value)) return undefined
  const title = safeAuthCopy(value['title'], 100)
  const description = safeAuthCopy(value['description'], 240)
  const amountLabel = safeAuthCopy(value['amountLabel'], 60)
  const methodSectionTitle = safeAuthCopy(value['methodSectionTitle'], 60)
  const buyerSectionTitle = safeAuthCopy(value['buyerSectionTitle'], 60)
  const buyerSectionDescription = safeAuthCopy(value['buyerSectionDescription'], 160)
  const cardActionLabel = safeAuthCopy(value['cardActionLabel'], 60)
  const tableActionLabel = safeAuthCopy(value['tableActionLabel'], 60)
  const layout = sanitizeCheckoutPaymentLayout(value['layout'])
  const state: CheckoutPaymentStateTheme = {
    ...(title !== null ? { title } : {}),
    ...(description !== null ? { description } : {}),
    ...(amountLabel !== null ? { amountLabel } : {}),
    ...(methodSectionTitle !== null ? { methodSectionTitle } : {}),
    ...(buyerSectionTitle !== null ? { buyerSectionTitle } : {}),
    ...(buyerSectionDescription !== null ? { buyerSectionDescription } : {}),
    ...(cardActionLabel !== null ? { cardActionLabel } : {}),
    ...(tableActionLabel !== null ? { tableActionLabel } : {}),
    ...(layout ? { layout } : {}),
  }
  return Object.keys(state).length > 0 ? state : undefined
}

function sanitizeCheckoutSuccessState(value: unknown): CheckoutSuccessStateTheme | undefined {
  if (!isRecord(value)) return undefined
  const title = safeAuthCopy(value['title'], 100)
  const description = safeAuthCopy(value['description'], 240)
  const primaryActionLabel = safeAuthCopy(value['primaryActionLabel'], 60)
  const icon = value['icon'] === 'check' || value['icon'] === 'receipt' || value['icon'] === 'shield' || value['icon'] === 'sparkles'
    ? value['icon']
    : undefined
  const iconColor = safeCheckoutColor(value['iconColor'])
  const iconBackground = safeCheckoutColor(value['iconBackground'])
  const layout = sanitizeCheckoutResultLayout(value['layout'])
  const state: CheckoutSuccessStateTheme = {
    ...(title !== null ? { title } : {}),
    ...(description !== null ? { description } : {}),
    ...(primaryActionLabel !== null ? { primaryActionLabel } : {}),
    ...(icon ? { icon } : {}),
    ...(iconColor ? { iconColor } : {}),
    ...(iconBackground ? { iconBackground } : {}),
    ...(layout ? { layout } : {}),
  }
  return Object.keys(state).length > 0 ? state : undefined
}

function sanitizeCheckoutTablePaymentState(value: unknown): CheckoutTablePaymentStateTheme | undefined {
  if (!isRecord(value)) return undefined
  const title = safeAuthCopy(value['title'], 100)
  const description = safeAuthCopy(value['description'], 240)
  const primaryActionLabel = safeAuthCopy(value['primaryActionLabel'], 60)
  const icon = value['icon'] === 'bell' || value['icon'] === 'receipt' || value['icon'] === 'clock' || value['icon'] === 'card'
    ? value['icon']
    : undefined
  const iconColor = safeCheckoutColor(value['iconColor'])
  const iconBackground = safeCheckoutColor(value['iconBackground'])
  const layout = sanitizeCheckoutResultLayout(value['layout'])
  const state: CheckoutTablePaymentStateTheme = {
    ...(title !== null ? { title } : {}),
    ...(description !== null ? { description } : {}),
    ...(primaryActionLabel !== null ? { primaryActionLabel } : {}),
    ...(icon ? { icon } : {}),
    ...(iconColor ? { iconColor } : {}),
    ...(iconBackground ? { iconBackground } : {}),
    ...(layout ? { layout } : {}),
  }
  return Object.keys(state).length > 0 ? state : undefined
}

function sanitizeCheckoutErrorState(value: unknown): CheckoutErrorStateTheme | undefined {
  if (!isRecord(value)) return undefined
  const title = safeAuthCopy(value['title'], 100)
  const primaryActionLabel = safeAuthCopy(value['primaryActionLabel'], 60)
  const secondaryActionLabel = safeAuthCopy(value['secondaryActionLabel'], 60)
  const icon = value['icon'] === 'warn' || value['icon'] === 'close' || value['icon'] === 'refresh' || value['icon'] === 'lock'
    ? value['icon']
    : undefined
  const iconColor = safeCheckoutColor(value['iconColor'])
  const iconBackground = safeCheckoutColor(value['iconBackground'])
  const layout = sanitizeCheckoutResultLayout(value['layout'])
  const state: CheckoutErrorStateTheme = {
    ...(title !== null ? { title } : {}),
    ...(primaryActionLabel !== null ? { primaryActionLabel } : {}),
    ...(secondaryActionLabel !== null ? { secondaryActionLabel } : {}),
    ...(icon ? { icon } : {}),
    ...(iconColor ? { iconColor } : {}),
    ...(iconBackground ? { iconBackground } : {}),
    ...(layout ? { layout } : {}),
  }
  return Object.keys(state).length > 0 ? state : undefined
}

function sanitizeCheckoutStates(value: unknown): CheckoutSurfaceStatesTheme | undefined {
  if (!isRecord(value)) return undefined
  const payment = sanitizeCheckoutPaymentState(value['payment'])
  const success = sanitizeCheckoutSuccessState(value['success'])
  const tablePayment = sanitizeCheckoutTablePaymentState(value['tablePayment'])
  const error = sanitizeCheckoutErrorState(value['error'])
  const states: CheckoutSurfaceStatesTheme = {
    ...(payment ? { payment } : {}),
    ...(success ? { success } : {}),
    ...(tablePayment ? { tablePayment } : {}),
    ...(error ? { error } : {}),
  }
  return Object.keys(states).length > 0 ? states : undefined
}

function sanitizeCheckoutSurface(value: unknown, fallback: CheckoutSurfaceTheme): CheckoutSurfaceTheme {
  if (!isRecord(value)) return fallback
  const preset = value['preset'] === 'clean' || value['preset'] === 'brand-header' || value['preset'] === 'soft'
    ? value['preset']
    : fallback.preset
  const sheetSize = value['sheetSize'] === 'compact' || value['sheetSize'] === 'standard' || value['sheetSize'] === 'large'
    ? value['sheetSize']
    : fallback.sheetSize
  const title = safeString(value['title'], 100)
  const subtitle = safeString(value['subtitle'], 240)
  const successTitle = safeString(value['successTitle'], 100)
  const states = sanitizeCheckoutStates(value['states'])
  const override = sanitizeSurfaceOverride(value['override'])
  return {
    preset,
    ...(sheetSize ? { sheetSize } : {}),
    ...(title !== null ? { title } : {}),
    ...(subtitle !== null ? { subtitle } : {}),
    ...(successTitle !== null ? { successTitle } : {}),
    ...(states ? { states } : {}),
    ...(override ? { override } : {}),
  }
}

function sanitizeThemeSurfaces(value: unknown, fallback: ThemeSurfaces): ThemeSurfaces {
  if (!isRecord(value)) return fallback
  return {
    home: sanitizeHomeSurface(value['home'], fallback.home),
    auth: sanitizeAuthSurface(value['auth'], fallback.auth),
    checkout: sanitizeCheckoutSurface(value['checkout'], fallback.checkout),
  }
}

function sanitizePageBlocks(value: unknown): ThemePageBlock[] | null {
  if (!Array.isArray(value)) return null
  const blocks: ThemePageBlock[] = []
  for (const entry of value.slice(0, 200)) {
    if (!isRecord(entry)) continue
    const type = entry['type']
    const id = safeString(entry['id'], 100)
    if (!id || (type !== 'section' && type !== 'category' && type !== 'nav')) continue
    if (type !== 'section') {
      blocks.push({ type, id })
      continue
    }

    const sectionId = safeString(entry['sectionId'], 100)
    if (REMOVED_SECTION_DEFINITION_IDS.has(sectionId ?? id)) continue
    const placement = entry['placement'] === 'page' || entry['placement'] === 'drawer'
      ? entry['placement']
      : undefined
    const rawVisibility = entry['visibility']
    let visibility: ThemePageBlock['visibility']
    if (isRecord(rawVisibility)) {
      const mode = rawVisibility['mode']
      if (mode === 'all' || mode === 'home' || mode === 'categories') {
        const categoryIds = Array.isArray(rawVisibility['categoryIds'])
          ? rawVisibility['categoryIds'].slice(0, 100).flatMap((candidate) => {
              const categoryId = safeString(candidate, 100)
              return categoryId ? [categoryId] : []
            })
          : undefined
        visibility = {
          mode,
          ...(categoryIds ? { categoryIds: Array.from(new Set(categoryIds)) } : {}),
          ...(typeof rawVisibility['includeChildren'] === 'boolean'
            ? { includeChildren: rawVisibility['includeChildren'] }
            : {}),
        }
      }
    }
    blocks.push({
      type,
      id,
      ...(sectionId ? { sectionId } : {}),
      ...(visibility ? { visibility } : {}),
      ...(placement ? { placement } : {}),
    })
  }
  return blocks
}

function sanitizeSectionSettings(
  value: unknown,
  removedSectionInstanceIds: ReadonlySet<string>,
  homeBlockDefinitions: ReadonlyMap<string, HomeSectionDefinitionId>,
): Record<string, Record<string, string>> | null {
  if (!isRecord(value)) return null
  const result: Record<string, Record<string, string>> = {}
  for (const [sectionId, rawSettings] of Object.entries(value).slice(0, 100)) {
    if (REMOVED_SECTION_DEFINITION_IDS.has(sectionId) || removedSectionInstanceIds.has(sectionId)) continue
    if (sectionId.length > 100 || !isRecord(rawSettings)) continue
    const settings: Record<string, string> = {}
    const homeDefinition = homeBlockDefinitions.get(sectionId)
    for (const [key, rawValue] of Object.entries(rawSettings).slice(0, 50)) {
      if (homeDefinition && HOME_ONLY_SECTION_IDS.has(homeDefinition) && !HOME_BLOCK_SETTING_KEYS[homeDefinition].has(key)) continue
      const next = homeDefinition && HOME_ONLY_SECTION_IDS.has(homeDefinition)
        ? sanitizeHomeBlockSetting(homeDefinition, key, rawValue)
        : safeString(rawValue)
      if (key.length <= 100 && next !== null) settings[key] = next
    }
    result[sectionId] = settings
  }
  return result
}

function sanitizeHomeBlockSetting(sectionId: HomeSectionDefinitionId, key: string, value: unknown): string | null {
  const text = safeString(value, key === 'body' || key.endsWith('Body') ? 1_200 : 240)
  if (text === null) return null
  if (/^(?:image|video|poster).*Url$/i.test(key)) return text ? safeUrl(text) : ''
  if (UNSAFE_AUTH_COPY.test(text)) return null
  if (key === 'textColor') return HEX_COLOR.test(text) ? text : null
  if (['showStatus', 'showEyebrow', 'showTitle', 'showBody', 'showCta'].includes(key)) {
    return text === 'true' || text === 'false' ? text : null
  }
  if (/^category[1-4]Id$/.test(key)) return !text || SAFE_ID.test(text) ? text : null
  const options: Partial<Record<string, readonly string[]>> = {
    mediaType: ['image', 'video', 'none'], imageFit: ['cover', 'contain'], imagePosition: ['center', 'top', 'bottom', 'left', 'right'],
    align: ['left', 'center', 'right'], layout: ['media-right', 'media-left', 'text-only'], tone: ['brand', 'dark', 'surface'], columns: ['2', '3', '4'],
  }
  if (options[key]) return options[key]!.includes(text) ? text : null
  const numberRange: Partial<Record<string, readonly [number, number]>> = {
    overlay: [0, 80], contentPositionX: [0, 100], contentPositionY: [0, 100],
    height: [420, 820], contentWidth: [320, 760], cardHeight: [140, 300],
  }
  if (numberRange[key]) {
    const parsed = Number(text)
    if (!Number.isFinite(parsed)) return null
    const [min, max] = numberRange[key]!
    return String(Math.round(Math.min(max, Math.max(min, parsed))))
  }
  void sectionId
  return text
}

export function isThemeTemplateId(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(TEMPLATES, value)
}

export function normalizeThemeTemplateId(value: unknown): string {
  // Legacy ids remain readable so existing theme token rows can be migrated
  // without data loss, but every runtime surface now uses one canonical menu.
  void value
  return CANONICAL_THEME_ID
}

/**
 * Theme tokens ultimately become CSS variables. Keep the editor payload inside
 * the canonical theme vocabulary and reject CSS-shaped strings before storage.
 */
export function sanitizeThemeTokens(input: unknown, templateId: string): GarsonlessTheme | null {
  if (!isThemeTemplateId(templateId) || !isRecord(input)) return null
  try {
    if (JSON.stringify(input).length > MAX_THEME_BYTES) return null
  } catch {
    return null
  }

  const base = { ...DEFAULT_THEME, ...TEMPLATES[CANONICAL_THEME_ID] } as GarsonlessTheme
  const result = { ...base } as Record<string, unknown>
  const allowed = new Set(Object.keys(DEFAULT_THEME))
  const removedSectionInstanceIds = new Set<string>()
  const homeBlockDefinitions = new Map<string, HomeSectionDefinitionId>()
  const rawSurfaces = input['surfaces']
  if (isRecord(rawSurfaces) && isRecord(rawSurfaces['home']) && Array.isArray(rawSurfaces['home']['blocks'])) {
    for (const candidate of rawSurfaces['home']['blocks'].slice(0, 40)) {
      const block = sanitizeHomeBlock(candidate)
      if (block) homeBlockDefinitions.set(block.id, block.sectionId)
    }
  }
  if (Array.isArray(input['pageBlocks'])) {
    for (const entry of input['pageBlocks']) {
      if (!isRecord(entry) || entry['type'] !== 'section') continue
      const id = safeString(entry['id'], 100)
      const sectionId = safeString(entry['sectionId'], 100)
      if (id && REMOVED_SECTION_DEFINITION_IDS.has(sectionId ?? id)) removedSectionInstanceIds.add(id)
    }
  }

  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key) || value === undefined) continue
    const typedKey = key as keyof GarsonlessTheme
    const fallback = result[key]

    if (key === 'experienceVersion') {
      result[key] = 2
      continue
    }
    if (key === 'surfaces') {
      result[key] = sanitizeThemeSurfaces(value, DEFAULT_THEME.surfaces!)
      continue
    }

    if (COLOR_KEYS.has(key)) {
      if (typeof value === 'string' && HEX_COLOR.test(value)) result[key] = value
      continue
    }
    if (FONT_KEYS.has(key)) {
      if (typeof value === 'string' && FONT_NAME.test(value)) result[key] = value
      continue
    }
    if (key === 'sections') {
      if (Array.isArray(value)) result[key] = value.slice(0, 100).flatMap((entry) => {
        const id = safeString(entry, 100)
        return id && !REMOVED_SECTION_DEFINITION_IDS.has(id) ? [id] : []
      })
      continue
    }
    if (key === 'pageBlocks') {
      const blocks = sanitizePageBlocks(value)
      if (blocks) result[key] = blocks
      continue
    }
    if (key === 'sectionSettings') {
      const settings = sanitizeSectionSettings(value, removedSectionInstanceIds, homeBlockDefinitions)
      if (settings) result[key] = settings
      continue
    }
    if (key === 'menuFilterPresetIds') {
      const presetIds = sanitizeMenuFilterPresetIds(value)
      if (presetIds) result[key] = presetIds
      continue
    }
    if (key === 'menuCustomFilters') {
      const customFilters = sanitizeMenuCustomFilters(value)
      if (customFilters) result[key] = customFilters
      continue
    }

    const options = STRING_OPTIONS[typedKey]
    if (options) {
      if (typeof value === 'string' && options.includes(value)) result[key] = value
      continue
    }
    if (typeof fallback === 'boolean') {
      if (typeof value === 'boolean') result[key] = value
      continue
    }
    if (typeof fallback === 'number') {
      if (!Number.isFinite(value)) continue
      const range = NUMBER_RANGES[typedKey] ?? [0, 2_000]
      result[key] = Math.min(range[1], Math.max(range[0], value as number))
      continue
    }
    if (typeof fallback === 'string') {
      const text = safeString(value)
      if (text !== null) result[key] = text
    }
  }

  if (!Object.hasOwn(input, 'headerPreset') && typeof input['headerLayout'] === 'string') {
    result['headerPreset'] = input['headerLayout'] === 'compact'
      ? 'compact'
      : input['headerLayout'] === 'center'
        ? 'standard'
        : 'brand'
  }
  if (!Object.hasOwn(input, 'headerShowContextBar') && typeof input['headerTableBadge'] === 'boolean') {
    result['headerShowContextBar'] = input['headerTableBadge']
  }
  if (!Object.hasOwn(input, 'memberPlacement') && Object.hasOwn(input, 'drawerShowMember')) {
    result['memberPlacement'] = input['drawerShowMember'] === false ? 'header' : 'drawer'
  }
  if (!Object.hasOwn(input, 'billPlacement') && (Object.hasOwn(input, 'drawerShowBill') || Object.hasOwn(input, 'headerShowBill'))) {
    result['billPlacement'] = input['drawerShowBill'] === true
      ? 'drawer'
      : input['headerShowBill'] === true ? 'header' : 'hidden'
  }
  if (!Object.hasOwn(input, 'cartPlacement') && (
    Object.hasOwn(input, 'cartHeaderTriggerStyle') || Object.hasOwn(input, 'cartFooterTriggerStyle') || Object.hasOwn(input, 'drawerShowCart')
  )) {
    result['cartPlacement'] = typeof input['cartHeaderTriggerStyle'] === 'string' && input['cartHeaderTriggerStyle'] !== 'none'
      ? 'header'
      : typeof input['cartFooterTriggerStyle'] === 'string' && input['cartFooterTriggerStyle'] !== 'none'
        ? 'footer'
        : input['drawerShowCart'] === true ? 'drawer' : 'hidden'
  }
  if (!Object.hasOwn(input, 'servicePlacement') && Array.isArray(input['pageBlocks'])) {
    const requestBlock = input['pageBlocks'].find((block) => isRecord(block) && block['type'] === 'section' && (block['sectionId'] ?? block['id']) === 'request-buttons')
    if (isRecord(requestBlock)) result['servicePlacement'] = requestBlock['placement'] === 'drawer' ? 'drawer' : 'floating'
  }

  return result as unknown as GarsonlessTheme
}

export function resolveTheme(args: {
  settings: Record<string, unknown> | null
  themeTokens: unknown
  templateOverride?: string | null
}): { theme: GarsonlessTheme; templateId: string } {
  const savedTemplateId = normalizeThemeTemplateId(args.settings?.['active_template_id'])
  const templateId = args.templateOverride == null
    ? savedTemplateId
    : normalizeThemeTemplateId(args.templateOverride)
  const base = { ...DEFAULT_THEME, ...TEMPLATES[CANONICAL_THEME_ID] }
  const raw = args.themeTokens
  // Stored template ids are legacy metadata only. The payload is always
  // sanitized against the canonical vocabulary so tenant colors/fonts survive
  // retirement of an old template without reviving its renderer.
  const theme = sanitizeThemeTokens(raw, CANONICAL_THEME_ID) ?? base
  return { theme, templateId }
}
