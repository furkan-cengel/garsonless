'use client'

import { buildUrl, qrContrast } from './tables-builder-model'
import type { QRConfig, QRHealth, TableItem } from './tables-builder-types'

type QRCodeStylingCtor = typeof import('qr-code-styling').default
type QRCodeStylingOptions = NonNullable<ConstructorParameters<QRCodeStylingCtor>[0]>
type DotType = NonNullable<NonNullable<QRCodeStylingOptions['dotsOptions']>['type']>
type CornerSquareType = NonNullable<NonNullable<QRCodeStylingOptions['cornersSquareOptions']>['type']>
type CornerDotType = NonNullable<NonNullable<QRCodeStylingOptions['cornersDotOptions']>['type']>
type ErrorCorrectionLevel = NonNullable<NonNullable<QRCodeStylingOptions['qrOptions']>['errorCorrectionLevel']>

const DOT_TYPES = new Set<DotType>(['dots', 'rounded', 'classy', 'classy-rounded', 'square', 'extra-rounded'])
const CORNER_SQUARE_TYPES = new Set<CornerSquareType>(['dot', 'square', 'extra-rounded', 'dots', 'rounded', 'classy', 'classy-rounded'])
const CORNER_DOT_TYPES = new Set<CornerDotType>(['dot', 'square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'])
const ERROR_CORRECTION_LEVELS = new Set<ErrorCorrectionLevel>(['L', 'M', 'Q', 'H'])

let qrCodeStylingCtorPromise: Promise<QRCodeStylingCtor> | null = null

export function loadQRCodeStyling(): Promise<QRCodeStylingCtor> {
  qrCodeStylingCtorPromise ??= import('qr-code-styling').then(mod => mod.default)
  return qrCodeStylingCtorPromise
}
export function colorOpts(qr: QRConfig): NonNullable<QRCodeStylingOptions['dotsOptions']> {
  if (qr.colorType === 'single') return { color: qr.fg }
  if (qr.gradType === 'linear') {
    return {
      gradient: {
        type: 'linear',
        rotation: (qr.gradAngle * Math.PI) / 180,
        colorStops: [{ offset: 0, color: qr.fg }, { offset: 1, color: qr.fg2 }],
      },
    }
  }
  return {
    gradient: {
      type: 'radial',
      colorStops: [{ offset: 0, color: qr.fg }, { offset: 1, color: qr.fg2 }],
    },
  }
}

function enumValue<T extends string>(values: ReadonlySet<T>, value: string, fallback: T): T {
  return values.has(value as T) ? value as T : fallback
}

export function buildQRCodeStylingOptions(
  qr: QRConfig,
  input: {
    width: number
    height: number
    data: string
    margin: number
    logoMargin: number
    type?: 'canvas' | 'svg'
  },
): QRCodeStylingOptions {
  return {
    width: input.width,
    height: input.height,
    type: input.type ?? 'svg',
    data: input.data,
    margin: input.margin,
    qrOptions: { errorCorrectionLevel: enumValue(ERROR_CORRECTION_LEVELS, qr.ecl, 'M') },
    image: qr.logo ?? undefined,
    imageOptions: {
      hideBackgroundDots: qr.logoHideBg,
      imageSize: qr.logoSize,
      margin: input.logoMargin,
      crossOrigin: 'anonymous',
    },
    dotsOptions: {
      type: enumValue(DOT_TYPES, qr.dotsType, 'rounded'),
      ...colorOpts(qr),
    },
    cornersSquareOptions: {
      type: enumValue(CORNER_SQUARE_TYPES, qr.eyeFrame, 'extra-rounded'),
      color: qr.fg,
    },
    cornersDotOptions: {
      type: enumValue(CORNER_DOT_TYPES, qr.eyeBall, 'dot'),
      color: qr.fg,
    },
    backgroundOptions: { color: qr.bgTransparent ? 'transparent' : qr.bg },
  }
}

export function escapeXML(value: string): string {
  return value.replace(/[<>&"']/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character] ?? character)
}

export function safeFilePart(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'masa'
}

export async function renderQRMarkup(qr: QRConfig, table?: TableItem): Promise<string> {
  const QRCodeStyling = await loadQRCodeStyling()
  const instance = new QRCodeStyling(buildQRCodeStylingOptions(qr, {
    width: qr.size,
    height: qr.size,
    data: buildUrl(qr, table),
    margin: qr.margin,
    logoMargin: qr.logoMargin,
  }))
  const blob = await instance.getRawData('svg')
  if (!blob) throw new Error('QR SVG oluşturulamadı')
  const markup = blob instanceof Blob
    ? await blob.text()
    : new TextDecoder().decode(blob)
  return markup
    .replace(/^<\?xml[^>]*>\s*/i, '')
    .replace(/<svg\b[^>]*>/i, `<svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" width="${qr.size}" height="${qr.size}" viewBox="0 0 ${qr.size} ${qr.size}">`)
}

export async function validateRenderedQR(qr: QRConfig, table?: TableItem): Promise<QRHealth> {
  const contrast = qrContrast(qr)
  if (contrast < 2.5) {
    return { state: 'invalid', message: `Kontrast çok düşük (${contrast.toFixed(1)}:1)`, contrast }
  }

  const markup = await renderQRMarkup(qr, table)
  const source = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('QR doğrulama görseli yüklenemedi'))
      image.src = source
    })
    const canvas = document.createElement('canvas')
    // Decode on a camera-like raster size. Very large export dimensions (for
    // example 1100px) are useful for print, but feeding that full bitmap to
    // jsQR can produce a false negative that looks like a save failure.
    const validationSize = Math.min(qr.size, 420)
    canvas.width = validationSize
    canvas.height = validationSize
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('QR doğrulama yüzeyi oluşturulamadı')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const { default: jsQR } = await import('jsqr')
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    const decoded = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })
    const expected = buildUrl(qr, table)
    if (!decoded || decoded.data !== expected) {
      return { state: 'invalid', message: 'QR okunabilirlik testi başarısız', contrast }
    }
    if (contrast < 4 || qr.logoSize > .42) {
      return { state: 'warning', message: `QR okunuyor · baskı payı düşük (${contrast.toFixed(1)}:1)`, contrast }
    }
    return { state: 'valid', message: `QR okunuyor · ${contrast.toFixed(1)}:1`, contrast }
  } finally {
    URL.revokeObjectURL(source)
  }
}
