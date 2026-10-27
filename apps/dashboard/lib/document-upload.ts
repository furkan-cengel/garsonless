import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

type DocumentMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'

/** Several photos become one PDF, one page per photo, in the order chosen. Used by the
 * menu and invoice readers, which both send a document to the same provider. */
export async function photosToPdf(
  request: Request,
  raw: Uint8Array,
  limits: { maxPhotos: number; maxBytes: number },
  mimeOf: (bytes: Uint8Array) => DocumentMime | null,
): Promise<Uint8Array | { error: string }> {
  let form: FormData
  try { form = await new Response(Buffer.from(raw), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData() }
  catch { return { error: 'invalid_file' } }
  const photos = form.getAll('photo').filter((entry): entry is File => entry instanceof File)
  if (photos.length < 1 || photos.length > limits.maxPhotos) return { error: 'photo_limit' }
  const document = await PDFDocument.create()
  // Fixed metadata keeps the PDF byte-identical for the same photos, so a retried upload is recognised.
  document.setCreationDate(new Date(0)); document.setModificationDate(new Date(0)); document.setProducer('Masabu'); document.setCreator('Masabu')
  for (const photo of photos) {
    const bytes = new Uint8Array(await photo.arrayBuffer())
    const mime = mimeOf(bytes)
    if (!mime || mime === 'application/pdf') return { error: 'invalid_file' }
    const jpeg = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()
    const image = await document.embedJpg(jpeg)
    document.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  const pdf = await document.save({ useObjectStreams: true })
  return pdf.length > limits.maxBytes ? { error: 'file_too_large' } : pdf
}

/** Rejects encrypted or oversized PDFs and images that are too large or multi-frame. */
export async function documentProblem(bytes: Uint8Array, mime: DocumentMime, maxPages: number): Promise<string | null> {
  try {
    if (mime === 'application/pdf') {
      const document = await PDFDocument.load(bytes)
      return document.isEncrypted || document.getPageCount() < 1 || document.getPageCount() > maxPages ? 'pdf_page_limit' : null
    }
    const metadata = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata()
    return !metadata.width || !metadata.height || metadata.width * metadata.height > 20_000_000 || (metadata.pages ?? 1) > 1 ? 'invalid_file' : null
  } catch {
    return 'invalid_file'
  }
}
