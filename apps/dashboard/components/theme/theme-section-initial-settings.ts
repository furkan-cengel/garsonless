export const CHEF_PICK_EDITORIAL_VERSION = '2'
export const COMBO_RIBBON_EDITORIAL_VERSION = '2'
export const GALLERY_EDITORIAL_VERSION = '2'
export const VIDEO_HERO_EDITORIAL_VERSION = '2'

const CHEF_PICK_INITIAL_SETTINGS = {
  editorialVersion: CHEF_PICK_EDITORIAL_VERSION,
  selectionMode: 'manual',
  itemCount: '3',
  chefIcon: 'sef-sapkasi',
  showQuote: 'false',
} as const

const COMBO_RIBBON_INITIAL_SETTINGS = {
  editorialVersion: COMBO_RIBBON_EDITORIAL_VERSION,
  selectionMode: 'manual',
  comboCount: '1',
  itemsPerCombo: '2',
  showSavings: 'true',
  imageFit: 'cover',
  imagePosition: 'center',
} as const

export const GALLERY_INITIAL_SETTINGS = {
  editorialVersion: GALLERY_EDITORIAL_VERSION,
  layout: 'mosaic',
  mosaicPattern: 'editorial',
  columns: '2',
  maxItems: '6',
  enableLightbox: 'true',
  rowHeight: '104',
  gap: '8',
  padding: '14',
  radius: '16',
  imageFit: 'cover',
  imagePosition: 'center',
} as const

export const GALLERY_CONTENT_KEYS = [
  'showTitle', 'title', 'showBody', 'body', 'showLabels',
  'tile1Image', 'tile1Label', 'tile2Image', 'tile2Label', 'tile3Image', 'tile3Label',
  'tile4Image', 'tile4Label', 'tile5Image', 'tile5Label', 'tile6Image', 'tile6Label',
  'tileOrder', 'targetType', 'linkText', 'targetUrl',
] as const

export const VIDEO_HERO_INITIAL_SETTINGS = {
  editorialVersion: VIDEO_HERO_EDITORIAL_VERSION,
  showStatus: 'true',
  showEyebrow: 'true',
  showTitle: 'true',
  showBody: 'true',
  showExplore: 'true',
  exploreLabel: 'Keşfet',
  imageFit: 'cover',
  imagePosition: 'center',
  overlay: '42',
  textColor: '#ffffff',
  animateExplore: 'true',
  contentPlacement: 'bottom-left',
  height: '640',
  contentWidth: '620',
} as const

export const VIDEO_HERO_CONTENT_KEYS = [
  'videoUrl', 'posterUrl', 'showStatus', 'showEyebrow', 'eyebrow', 'showTitle', 'title',
  'showBody', 'body', 'showExplore', 'exploreLabel',
] as const

function legacyPlacement(settings: Record<string, string>) {
  const align = settings.align === 'center' || settings.align === 'right' ? settings.align : 'left'
  const fallbackX = align === 'center' ? 50 : align === 'right' ? 100 : 0
  const parsedX = Number(settings.contentPositionX)
  const parsedY = Number(settings.contentPositionY)
  const x = Number.isFinite(parsedX) ? Math.min(100, Math.max(0, parsedX)) : fallbackX
  const y = Number.isFinite(parsedY) ? Math.min(100, Math.max(0, parsedY)) : 100
  const horizontal = x <= 33 ? 'left' : x >= 67 ? 'right' : 'center'
  const vertical = y <= 33 ? 'top' : y >= 67 ? 'bottom' : 'center'
  return vertical === 'center' && horizontal === 'center' ? 'center' : `${vertical}-${horizontal}`
}

export function buildVideoHeroResetSettings(current: Record<string, string>): Record<string, string> {
  const content = Object.fromEntries(VIDEO_HERO_CONTENT_KEYS.flatMap((key) => current[key] === undefined ? [] : [[key, current[key]!]]))
  return { ...VIDEO_HERO_INITIAL_SETTINGS, ...content }
}

export function buildVideoHeroModernSettings(current: Record<string, string>): Record<string, string> {
  const next = {
    ...VIDEO_HERO_INITIAL_SETTINGS,
    ...current,
    editorialVersion: VIDEO_HERO_EDITORIAL_VERSION,
    contentPlacement: current.contentPlacement || legacyPlacement(current),
  }
  delete (next as Record<string, string>).align
  delete (next as Record<string, string>).contentPositionX
  delete (next as Record<string, string>).contentPositionY
  return next
}

export function buildGalleryClearPatch(): Record<string, string> {
  return Object.fromEntries([
    ...Array.from({ length: 6 }, (_, index) => [`tile${index + 1}Image`, ''] as const),
    ...Array.from({ length: 6 }, (_, index) => [`tile${index + 1}Label`, ''] as const),
    ['tileOrder', ''],
  ])
}

/** New instances and explicit resets use modern, manually curated defaults. */
export function createInitialSectionSettings(sectionId: string): Record<string, string> {
  if (sectionId === 'chef-pick') return { ...CHEF_PICK_INITIAL_SETTINGS }
  if (sectionId === 'combo-ribbon') return { ...COMBO_RIBBON_INITIAL_SETTINGS }
  if (sectionId === 'gallery') return { ...GALLERY_INITIAL_SETTINGS }
  if (sectionId === 'storefront-video-hero') return { ...VIDEO_HERO_INITIAL_SETTINGS }
  return {}
}
