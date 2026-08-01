'use client'

import type { QRConfig, QRHealth, TableItem } from './tables-builder-types'
import { createA4TableCardPDF, tableExportBaseName } from './tables-qr-pdf'
import { escapeXML, renderQRMarkup, validateRenderedQR } from './tables-qr-renderer'

export type TableCardExportFormat = 'png' | 'svg' | 'jpeg' | 'pdf'
export const MAX_QR_EXPORT_CONCURRENCY = 4

export async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  task: (value: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Eşzamanlı iş sınırı geçersiz')
  const output = new Array<Output>(values.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor++
      const value = values[index] as Input
      output[index] = await task(value, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return output
}

async function assertReadable(qr: QRConfig, table: TableItem): Promise<QRHealth> {
  const health = await validateRenderedQR(qr, table)
  if (health.state === 'invalid' || health.state === 'checking') {
    throw new Error(`QR export edilmedi: ${health.message}`)
  }
  return health
}

export async function renderTableCardSVG(qr: QRConfig, table: TableItem): Promise<string> {
  const qrMarkup = await renderQRMarkup(qr, table)
  const label = escapeXML(table.label)
  const title = escapeXML(qr.frameTitle)
  const subtitle = escapeXML(qr.frameSubtitle)
  const frameColor = escapeXML(qr.frameColor)
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
  const border = qr.frame === 'card' || qr.frame === 'speech' ? `stroke="${frameColor}" stroke-width="2"` : ''
  const headingColor = qr.frame === 'banner' ? '#ffffff' : frameColor
  const subtitleColor = qr.frame === 'banner' ? '#ffffff' : '#66666d'
  const phoneInner = qr.frame === 'phone'
    ? `<rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="30" fill="#ffffff"/><rect x="${width / 2 - 40}" y="30" width="80" height="5" rx="3" fill="#e7e7ea"/>`
    : ''
  const speechTail = qr.frame === 'speech'
    ? `<path d="M${width / 2 - 20} ${height - 2} H${width / 2 + 20} L${width / 2 + 2} ${height + 18} Q${width / 2} ${height + 20} ${width / 2 - 2} ${height + 18} Z" fill="#fff" stroke="${frameColor}" stroke-width="2"/>`
    : ''
  const documentHeight = height + (qr.frame === 'speech' ? 22 : 0)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${documentHeight}" viewBox="0 0 ${width} ${documentHeight}"><rect width="${width}" height="${height}" rx="${radius}" fill="${outerFill}" ${border}/>${phoneInner}<text x="${width / 2}" y="${qr.frame === 'phone' ? 65 : 44}" text-anchor="middle" fill="${headingColor}" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1.2">${label.toLocaleUpperCase('tr-TR')}</text>${innerBackground}<g transform="translate(${qrX} ${qrY})">${qrMarkup}</g><text x="${width / 2}" y="${qrY + qrSize + 48}" text-anchor="middle" fill="${headingColor}" font-family="Arial, sans-serif" font-size="28" font-weight="700">${title}</text><text x="${width / 2}" y="${qrY + qrSize + 78}" text-anchor="middle" fill="${subtitleColor}" opacity="${qr.frame === 'banner' ? '.78' : '1'}" font-family="Arial, sans-serif" font-size="18">${subtitle}</text>${speechTail}</svg>`
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

async function rasterizeSVG(svg: string, mime: 'image/png' | 'image/jpeg', scale = 1): Promise<Blob> {
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
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas oluşturulamadı')
    if (mime === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, .94))
    if (!blob) throw new Error('QR dosyası oluşturulamadı')
    return blob
  } finally {
    URL.revokeObjectURL(source)
  }
}

export async function downloadTableCard(qr: QRConfig, table: TableItem, format: TableCardExportFormat): Promise<void> {
  await assertReadable(qr, table)
  const svg = await renderTableCardSVG(qr, table)
  const filename = tableExportBaseName(table)
  if (format === 'svg') {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
    return
  }
  const raster = await rasterizeSVG(svg, format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'pdf' ? 2 : 1)
  if (format === 'pdf') {
    const bytes = await createA4TableCardPDF(new Uint8Array(await raster.arrayBuffer()), table)
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${filename}.pdf`)
    return
  }
  downloadBlob(raster, `${filename}.${format === 'jpeg' ? 'jpg' : 'png'}`)
}

export async function printTableCards(qr: QRConfig, tables: TableItem[]): Promise<void> {
  const cards = await mapWithConcurrency(tables, MAX_QR_EXPORT_CONCURRENCY, async table => {
    await assertReadable(qr, table)
    return renderTableCardSVG(qr, table)
  })
  const frame = document.createElement('iframe')
  frame.setAttribute('title', 'Masa QR baskı görünümü')
  Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' })
  frame.srcdoc = `<!doctype html><html><head><title>Masa QR Kodları</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10mm}.card{display:flex;align-items:center;justify-content:center;break-inside:avoid;page-break-inside:avoid}.card svg{width:100%;height:auto;max-height:126mm}@media print{.grid{gap:8mm}}</style></head><body><main class="grid">${cards.map(card => `<section class="card">${card}</section>`).join('')}</main></body></html>`
  document.body.appendChild(frame)
  frame.onload = () => window.setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => frame.remove(), 1000)
  }, 100)
}
