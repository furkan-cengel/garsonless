import type { TableItem } from './tables-builder-types'
import { safeFilePart } from './tables-qr-renderer'

export const A4_PDF_SIZE = { width: 595.28, height: 841.89 } as const
const PDF_MARGIN = 36
const FIXED_METADATA_DATE = new Date('2000-01-01T00:00:00.000Z')

export function tableExportBaseName(table: Pick<TableItem, 'id' | 'label'>): string {
  return `masabu-${safeFilePart(table.label)}-${table.id.slice(0, 8)}`
}

export function fitInsideA4(width: number, height: number): { width: number; height: number; x: number; y: number } {
  const availableWidth = A4_PDF_SIZE.width - PDF_MARGIN * 2
  const availableHeight = A4_PDF_SIZE.height - PDF_MARGIN * 2
  const scale = Math.min(availableWidth / width, availableHeight / height, 1)
  const fittedWidth = width * scale
  const fittedHeight = height * scale
  return {
    width: fittedWidth,
    height: fittedHeight,
    x: (A4_PDF_SIZE.width - fittedWidth) / 2,
    y: (A4_PDF_SIZE.height - fittedHeight) / 2,
  }
}

export async function createA4TableCardPDF(
  pngBytes: Uint8Array,
  table: Pick<TableItem, 'id' | 'label'>,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.create()
  document.setTitle(`Masabu · ${table.label} QR`)
  document.setAuthor('Masabu')
  document.setSubject(`${table.label} için masa QR kartı`)
  document.setKeywords(['Masabu', 'QR', 'masa', table.id])
  document.setCreator('Masabu QR Studio')
  document.setProducer('Masabu QR Studio')
  document.setCreationDate(FIXED_METADATA_DATE)
  document.setModificationDate(FIXED_METADATA_DATE)

  const image = await document.embedPng(pngBytes)
  const page = document.addPage([A4_PDF_SIZE.width, A4_PDF_SIZE.height])
  page.drawImage(image, fitInsideA4(image.width, image.height))
  return document.save({ useObjectStreams: false })
}
