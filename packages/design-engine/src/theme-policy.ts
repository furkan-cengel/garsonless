import { DEFAULT_THEME, type GarsonlessTheme, type ThemePageBlock } from './schema'
import { TEMPLATES } from './templates'

export const CANONICAL_THEME_ID = 'default' as const

const MAX_THEME_BYTES = 128 * 1024
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FONT_NAME = /^[\p{L}\p{N} .,'_-]{1,80}$/u
const REMOVED_SECTION_DEFINITION_IDS = new Set(['social-block', 'footer'])

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
): Record<string, Record<string, string>> | null {
  if (!isRecord(value)) return null
  const result: Record<string, Record<string, string>> = {}
  for (const [sectionId, rawSettings] of Object.entries(value).slice(0, 100)) {
    if (REMOVED_SECTION_DEFINITION_IDS.has(sectionId) || removedSectionInstanceIds.has(sectionId)) continue
    if (sectionId.length > 100 || !isRecord(rawSettings)) continue
    const settings: Record<string, string> = {}
    for (const [key, rawValue] of Object.entries(rawSettings).slice(0, 50)) {
      const next = safeString(rawValue)
      if (key.length <= 100 && next !== null) settings[key] = next
    }
    result[sectionId] = settings
  }
  return result
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
      const settings = sanitizeSectionSettings(value, removedSectionInstanceIds)
      if (settings) result[key] = settings
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
