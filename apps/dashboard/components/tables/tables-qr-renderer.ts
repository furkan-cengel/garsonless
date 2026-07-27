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
  input: { width: number; height: number; data: string; margin: number; logoMargin: number },
): QRCodeStylingOptions {
  return {
    width: input.width,
    height: input.height,
    type: 'svg',
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

async function renderQRMarkup(qr: QRConfig, table?: TableItem): Promise<string> {
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

export async function renderTableCardSVG(qr: QRConfig, table?: TableItem): Promise<string> {
  const qrMarkup = await renderQRMarkup(qr, table)
  const label = escapeXML(table?.label ?? 'Masa')
  const title = escapeXML(qr.frameTitle)
  const subtitle = escapeXML(qr.frameSubtitle)
  const frameColor = escapeXML(qr.frameColor)
  const textMuted = '#66666d'
  const qrSize = qr.size
  if (qr.frame === 'none') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qrSize} ${qrSize}">${qrMarkup}</svg>`
  }
  const horizontalPadding = qr.frame === 'phone' ? 44 : 28
  const topContent = 82
  const bottomContent = 104
  const width = qrSize + horizontalPadding * 2
  const height = qrSize + topContent + bottomContent
  const qrX = horizontalPadding
  const qrY = topContent
  const radius = qr.frame === 'phone' ? 42 : qr.frame === 'speech' ? 18 : 16
  const outerFill = qr.frame === 'banner' ? frameColor : qr.frame === 'phone' ? '#0b0b0d' : '#ffffff'
  const innerBackground = qr.frame === 'banner' || qr.frame === 'phone'
    ? `<rect x="${qrX - 12}" y="${qrY - 12}" width="${qrSize + 24}" height="${qrSize + 24}" rx="12" fill="#ffffff"/>`
    : ''
  const border = qr.frame === 'card' || qr.frame === 'speech'
    ? `stroke="${frameColor}" stroke-width="2"`
    : ''
  const headingColor = qr.frame === 'banner' ? '#ffffff' : frameColor
  const subtitleColor = qr.frame === 'banner' ? '#ffffff' : textMuted
  const phoneInner = qr.frame === 'phone'
    ? `<rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="30" fill="#ffffff"/>
       <rect x="${width / 2 - 40}" y="30" width="80" height="5" rx="3" fill="#e7e7ea"/>`
    : ''
  const speechTail = qr.frame === 'speech'
    ? `<path d="M${width / 2 - 20} ${height - 2} H${width / 2 + 20} L${width / 2 + 2} ${height + 18} Q${width / 2} ${height + 20} ${width / 2 - 2} ${height + 18} Z" fill="#fff" stroke="${frameColor}" stroke-width="2"/>`
    : ''
  const documentHeight = height + (qr.frame === 'speech' ? 22 : 0)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${documentHeight}" viewBox="0 0 ${width} ${documentHeight}">
    <rect width="${width}" height="${height}" rx="${radius}" fill="${outerFill}" ${border}/>
    ${phoneInner}
    <text x="${width / 2}" y="${qr.frame === 'phone' ? 65 : 44}" text-anchor="middle" fill="${headingColor}" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1.2">${label.toLocaleUpperCase('tr-TR')}</text>
    ${innerBackground}
    <g transform="translate(${qrX} ${qrY})">${qrMarkup}</g>
    <text x="${width / 2}" y="${qrY + qrSize + 48}" text-anchor="middle" fill="${headingColor}" font-family="Arial, sans-serif" font-size="28" font-weight="700">${title}</text>
    <text x="${width / 2}" y="${qrY + qrSize + 78}" text-anchor="middle" fill="${subtitleColor}" opacity="${qr.frame === 'banner' ? '.78' : '1'}" font-family="Arial, sans-serif" font-size="18">${subtitle}</text>
    ${speechTail}
  </svg>`
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
    const validationSize = Math.min(qr.size, 720)
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
      return { state: 'invalid', message: 'Stil kaydedildi · okunabilirlik testi başarısız', contrast }
    }
    if (contrast < 4 || qr.logoSize > .42) {
      return { state: 'warning', message: `Stil kaydedildi · baskı payı düşük (${contrast.toFixed(1)}:1)`, contrast }
    }
    return { state: 'valid', message: `Stil kaydedildi · QR okunuyor · ${contrast.toFixed(1)}:1`, contrast }
  } finally {
    URL.revokeObjectURL(source)
  }
}

function downloadBlob(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}

export async function downloadTableCard(qr: QRConfig, table: TableItem, extension: string): Promise<void> {
  const svg = await renderTableCardSVG(qr, table)
  const filename = `masabu-${safeFilePart(table.label)}-${table.id.slice(0, 8)}`
  if (extension === 'svg') {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
    return
  }

  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('QR görseli dönüştürülemedi'))
      image.src = source
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas oluşturulamadı')
    if (extension === 'jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0)
    const mime = extension === 'jpeg' ? 'image/jpeg' : 'image/png'
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, .94))
    if (!blob) throw new Error('QR dosyası oluşturulamadı')
    downloadBlob(blob, `${filename}.${extension === 'jpeg' ? 'jpg' : 'png'}`)
  } finally {
    URL.revokeObjectURL(source)
  }
}

export async function printTableCards(qr: QRConfig, tables: TableItem[]): Promise<void> {
  const cards = await Promise.all(tables.map(table => renderTableCardSVG(qr, table)))
  const frame = document.createElement('iframe')
  frame.setAttribute('title', 'Masa QR baskı görünümü')
  frame.style.position = 'fixed'
  frame.style.width = '1px'
  frame.style.height = '1px'
  frame.style.opacity = '0'
  frame.style.pointerEvents = 'none'
  frame.srcdoc = `<!doctype html><html><head><title>Masa QR Kodları</title><style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10mm; }
    .card { display: flex; align-items: center; justify-content: center; break-inside: avoid; page-break-inside: avoid; }
    .card svg { width: 100%; height: auto; max-height: 126mm; }
    @media print { .grid { gap: 8mm; } }
  </style></head><body><main class="grid">${cards.map(card => `<section class="card">${card}</section>`).join('')}</main></body></html>`
  document.body.appendChild(frame)
  frame.onload = () => {
    window.setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      window.setTimeout(() => frame.remove(), 1000)
    }, 100)
  }
}
