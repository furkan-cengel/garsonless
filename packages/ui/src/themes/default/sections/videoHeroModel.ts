export const VIDEO_HERO_EDITORIAL_VERSION = '2'

export const VIDEO_HERO_PLACEMENTS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
] as const

export type VideoHeroPlacement = typeof VIDEO_HERO_PLACEMENTS[number]
export type VideoHeroPreviewMode = 'public' | 'editor' | 'catalog'
export type VideoHeroMediaState = 'empty' | 'video-missing' | 'poster-missing' | 'ready' | 'catalog'

export interface ResolvedVideoHero {
  isModern: boolean
  previewMode: VideoHeroPreviewMode
  mediaState: VideoHeroMediaState
  videoUrl: string
  posterUrl: string
  placement: VideoHeroPlacement
  imageFit: 'cover' | 'contain'
  imagePosition: 'top' | 'center' | 'bottom' | 'left' | 'right'
  overlay: number
  height: number
  contentWidth: number
  textColor: string
  scrimColor: string
  showStatus: boolean
  showEyebrow: boolean
  showTitle: boolean
  showBody: boolean
  showExplore: boolean
  animateExplore: boolean
  showCta: boolean
  eyebrow: string
  title: string
  body: string
  exploreLabel: string
  cta: string
}

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback
}

function visible(value: string | undefined, fallback = true) {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function boundedText(value: string | undefined, fallback: string, max: number) {
  const text = value?.trim()
  return text ? text.slice(0, max) : fallback
}

function placement(value: string | undefined): VideoHeroPlacement {
  return VIDEO_HERO_PLACEMENTS.includes(value as VideoHeroPlacement)
    ? value as VideoHeroPlacement
    : 'bottom-left'
}

function imagePosition(value: string | undefined): ResolvedVideoHero['imagePosition'] {
  return value === 'top' || value === 'bottom' || value === 'left' || value === 'right' ? value : 'center'
}

function usesLightText(value: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) return true
  const hex = match[1]!
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
  const linear = channels.map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
  return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722 > .42
}

export function legacyVideoHeroPlacement(config: Record<string, string>): VideoHeroPlacement {
  const align = config.align === 'center' || config.align === 'right' ? config.align : 'left'
  const defaultX = align === 'center' ? 50 : align === 'right' ? 100 : 0
  const x = boundedNumber(config.contentPositionX, defaultX, 0, 100)
  const y = boundedNumber(config.contentPositionY, 100, 0, 100)
  const horizontal = x <= 33 ? 'left' : x >= 67 ? 'right' : 'center'
  const vertical = y <= 33 ? 'top' : y >= 67 ? 'bottom' : 'center'
  return vertical === 'center' && horizontal === 'center' ? 'center' : `${vertical}-${horizontal}` as VideoHeroPlacement
}

export function resolveVideoHero(
  config: Record<string, string>,
  options: { previewMode?: VideoHeroPreviewMode; restaurantName?: string } = {},
): ResolvedVideoHero {
  const previewMode = options.previewMode ?? 'public'
  const isModern = config.editorialVersion === VIDEO_HERO_EDITORIAL_VERSION || previewMode === 'catalog'
  const videoUrl = config.videoUrl?.trim() ?? ''
  const posterUrl = config.posterUrl?.trim() ?? ''
  const mediaState: VideoHeroMediaState = previewMode === 'catalog' && !videoUrl && !posterUrl
    ? 'catalog'
    : videoUrl && posterUrl
      ? 'ready'
      : videoUrl
        ? 'poster-missing'
        : posterUrl
          ? 'video-missing'
          : 'empty'
  const textColor = /^#[0-9a-f]{6}$/i.test(config.textColor ?? '') ? config.textColor! : '#ffffff'

  return {
    isModern,
    previewMode,
    mediaState,
    videoUrl,
    posterUrl,
    placement: isModern ? placement(config.contentPlacement) : legacyVideoHeroPlacement(config),
    imageFit: config.imageFit === 'contain' ? 'contain' : 'cover',
    imagePosition: imagePosition(config.imagePosition),
    overlay: boundedNumber(config.overlay, 42, 0, 80),
    height: boundedNumber(config.height, 640, 420, 820),
    contentWidth: boundedNumber(config.contentWidth, 620, 320, 760),
    textColor,
    scrimColor: usesLightText(textColor) ? 'rgba(7,10,13,.72)' : 'rgba(255,255,255,.78)',
    showStatus: visible(config.showStatus),
    showEyebrow: visible(config.showEyebrow),
    showTitle: visible(config.showTitle),
    showBody: visible(config.showBody),
    showExplore: visible(config.showExplore),
    animateExplore: visible(config.animateExplore),
    showCta: visible(config.showCta),
    eyebrow: boundedText(config.eyebrow, 'HOŞ GELDİNİZ', 80),
    title: boundedText(config.title, options.restaurantName ?? '', 140),
    body: boundedText(config.body, 'Mutfağımızı, hikâyemizi ve öne çıkan lezzetlerimizi keşfedin.', 1_200),
    exploreLabel: boundedText(config.exploreLabel, 'Keşfet', 40),
    cta: boundedText(config.cta, 'Menüyü Gör', 40),
  }
}
