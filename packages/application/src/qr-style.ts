export const QR_DOT_TYPES = ['dots', 'rounded', 'classy', 'classy-rounded', 'square', 'extra-rounded'] as const
export const QR_EYE_FRAME_TYPES = ['dot', 'square', 'extra-rounded', 'dots', 'rounded', 'classy', 'classy-rounded'] as const
export const QR_EYE_BALL_TYPES = ['dot', 'square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'] as const
export const QR_ERROR_CORRECTION_LEVELS = ['L', 'M', 'Q', 'H'] as const
export const QR_COLOR_TYPES = ['single', 'gradient'] as const
export const QR_GRADIENT_TYPES = ['linear', 'radial'] as const
export const QR_FRAME_TYPES = ['none', 'card', 'banner', 'speech', 'phone'] as const

export interface PersistedQRStyle {
  dotsType: typeof QR_DOT_TYPES[number]
  eyeFrame: typeof QR_EYE_FRAME_TYPES[number]
  eyeBall: typeof QR_EYE_BALL_TYPES[number]
  size: number
  margin: number
  ecl: typeof QR_ERROR_CORRECTION_LEVELS[number]
  colorType: typeof QR_COLOR_TYPES[number]
  fg: string
  fg2: string
  gradType: typeof QR_GRADIENT_TYPES[number]
  gradAngle: number
  bg: string
  bgTransparent: boolean
  logo: string | null
  logoSize: number
  logoMargin: number
  logoHideBg: boolean
  frame: typeof QR_FRAME_TYPES[number]
  frameTitle: string
  frameSubtitle: string
  frameColor: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  autoLang: boolean
  countdown: boolean
  _presetId?: string
}

export interface QRStyleSafetyResult {
  safe: boolean
  issues: string[]
  contrast: number
  style: PersistedQRStyle | null
  legacyLogo: boolean
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/
const PERSISTED_KEYS = new Set([
  'dotsType', 'eyeFrame', 'eyeBall', 'size', 'margin', 'ecl', 'colorType',
  'fg', 'fg2', 'gradType', 'gradAngle', 'bg', 'bgTransparent', 'logo',
  'logoSize', 'logoMargin', 'logoHideBg', 'frame', 'frameTitle',
  'frameSubtitle', 'frameColor', 'utmSource', 'utmMedium', 'utmCampaign',
  'autoLang', 'countdown', '_presetId',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isEnum<const Values extends readonly string[]>(values: Values, value: unknown): value is Values[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) return 0
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return .2126 * (channels[0] ?? 0) + .7152 * (channels[1] ?? 0) + .0722 * (channels[2] ?? 0)
}

function contrastRatio(foreground: string, background: string): number {
  if (!HEX_COLOR.test(foreground) || !HEX_COLOR.test(background)) return 0
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05)
}

function pngDecodedBytesAndDimensions(dataUrl: string): { bytes: number; width: number; height: number } | null {
  const match = PNG_DATA_URL.exec(dataUrl)
  if (!match?.[1] || match[1].length % 4 !== 0) return null
  const base64 = match[1]
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const bytes = (base64.length / 4) * 3 - padding
  if (bytes < 24 || bytes > 196_608) return null

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const header = new Uint8Array(24)
  let outputIndex = 0
  for (let index = 0; index < base64.length && outputIndex < header.length; index += 4) {
    const a = alphabet.indexOf(base64[index] ?? '')
    const b = alphabet.indexOf(base64[index + 1] ?? '')
    const c = base64[index + 2] === '=' ? 0 : alphabet.indexOf(base64[index + 2] ?? '')
    const d = base64[index + 3] === '=' ? 0 : alphabet.indexOf(base64[index + 3] ?? '')
    if (a < 0 || b < 0 || c < 0 || d < 0) return null
    const packed = (a << 18) | (b << 12) | (c << 6) | d
    if (outputIndex < header.length) header[outputIndex++] = (packed >> 16) & 255
    if (outputIndex < header.length && base64[index + 2] !== '=') header[outputIndex++] = (packed >> 8) & 255
    if (outputIndex < header.length && base64[index + 3] !== '=') header[outputIndex++] = packed & 255
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!signature.every((byte, index) => header[index] === byte)) return null
  if (String.fromCharCode(...header.slice(12, 16)) !== 'IHDR') return null
  const width = ((header[16]! << 24) | (header[17]! << 16) | (header[18]! << 8) | header[19]!) >>> 0
  const height = ((header[20]! << 24) | (header[21]! << 16) | (header[22]! << 8) | header[23]!) >>> 0
  return { bytes, width, height }
}

export function inspectQRStyleSafety(input: unknown): QRStyleSafetyResult {
  const issues: string[] = []
  if (!isRecord(input)) return { safe: false, issues: ['QR stili nesne olmalıdır.'], contrast: 0, style: null, legacyLogo: false }
  for (const key of Object.keys(input)) {
    if (!PERSISTED_KEYS.has(key)) issues.push(`Desteklenmeyen QR alanı: ${key}`)
  }

  const enumFields = [
    ['dotsType', QR_DOT_TYPES], ['eyeFrame', QR_EYE_FRAME_TYPES], ['eyeBall', QR_EYE_BALL_TYPES],
    ['ecl', QR_ERROR_CORRECTION_LEVELS], ['colorType', QR_COLOR_TYPES],
    ['gradType', QR_GRADIENT_TYPES], ['frame', QR_FRAME_TYPES],
  ] as const
  for (const [key, values] of enumFields) if (!isEnum(values, input[key])) issues.push(`${key} değeri geçersiz.`)

  const integerRanges = [
    ['size', 200, 1200], ['margin', 0, 80], ['gradAngle', 0, 360], ['logoMargin', 0, 80],
  ] as const
  for (const [key, min, max] of integerRanges) {
    const value = input[key]
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) issues.push(`${key} sınır dışında.`)
  }
  if (typeof input.logoSize !== 'number' || !Number.isFinite(input.logoSize) || input.logoSize < .1 || input.logoSize > .5) issues.push('logoSize sınır dışında.')

  for (const key of ['fg', 'fg2', 'bg', 'frameColor'] as const) {
    if (typeof input[key] !== 'string' || !HEX_COLOR.test(input[key])) issues.push(`${key} geçerli bir hex renk olmalıdır.`)
  }
  for (const key of ['bgTransparent', 'logoHideBg', 'autoLang', 'countdown'] as const) {
    if (typeof input[key] !== 'boolean') issues.push(`${key} boolean olmalıdır.`)
  }
  const textLimits = [['frameTitle', 80], ['frameSubtitle', 140], ['utmSource', 80], ['utmMedium', 80], ['utmCampaign', 120]] as const
  for (const [key, max] of textLimits) {
    if (typeof input[key] !== 'string' || input[key].length > max) issues.push(`${key} geçersiz veya çok uzun.`)
  }
  if (input._presetId !== undefined && (typeof input._presetId !== 'string' || input._presetId.length > 60)) issues.push('_presetId geçersiz.')

  let legacyLogo = false
  if (input.logo !== null) {
    if (typeof input.logo !== 'string' || !input.logo.startsWith('data:image/png;base64,')) {
      legacyLogo = typeof input.logo === 'string'
      issues.push('Logo yalnız güvenli PNG biçiminde olabilir.')
    } else {
      const png = pngDecodedBytesAndDimensions(input.logo)
      if (!png) issues.push('PNG logo imzası veya verisi geçersiz.')
      else if (png.width < 1 || png.height < 1 || png.width > 256 || png.height > 256) issues.push('PNG logo en fazla 256×256 piksel olabilir.')
    }
  }

  const background = input.bgTransparent === true ? '#ffffff' : typeof input.bg === 'string' ? input.bg : ''
  const primary = typeof input.fg === 'string' ? contrastRatio(input.fg, background) : 0
  const contrast = input.colorType === 'gradient' && typeof input.fg2 === 'string'
    ? Math.min(primary, contrastRatio(input.fg2, background))
    : primary
  if (contrast < 2.5) issues.push(`QR kontrastı en az 2.5:1 olmalıdır (mevcut ${contrast.toFixed(1)}:1).`)

  if (issues.length > 0) return { safe: false, issues, contrast, style: null, legacyLogo }
  return { safe: true, issues: [], contrast, style: input as unknown as PersistedQRStyle, legacyLogo: false }
}
