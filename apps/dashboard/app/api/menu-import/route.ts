import { createHash } from 'node:crypto'
import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { readBoundedRequestBody } from '@garsonless/application/request-body'
import { MENU_IMPORT_MAX_BYTES, MENU_IMPORT_MAX_PHOTOS, MENU_IMPORT_MAX_UPLOAD_BYTES, menuImportMime, parseMenuImportRows } from '@garsonless/application/menu-import'
import { enqueueMenuImport } from '@garsonless/db/server'
import { assertAccess } from '@/lib/auth/access'
import { createDashboardServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
const uuid = z.string().uuid()
function reply(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }) }
async function gate(request: Request, mutate = false) {
  if (mutate && request.headers.get('origin') !== new URL(request.url).origin) return null
  const restaurantId = new URL(request.url).searchParams.get('restaurantId')
  if (!uuid.safeParse(restaurantId).success) return null
  const access = await assertAccess(restaurantId!, 'menu')
  return 'error' in access ? null : { restaurantId: restaurantId!, actorId: access.userId }
}
async function rpc(name: string, args: Record<string, unknown>) {
  const db = await createDashboardServerClient()
  const call = db.rpc.bind(db) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  return call(name, args)
}

export async function GET(request: Request) {
  const access = await gate(request)
  if (!access) return reply({ error: 'forbidden' }, 403)
  const { data, error } = await rpc('read_menu_imports', { p_restaurant: access.restaurantId })
  if (error) return reply({ error: 'not_initialized' }, 503)
  return reply({ ...(data as object), enabled: process.env.MENU_IMPORT_ENABLED === 'true' })
}

/** Several photos of a printed menu become one PDF, one page per photo, in the order chosen. */
async function photosToPdf(request: Request, raw: Uint8Array): Promise<Uint8Array | { error: string }> {
  let form: FormData
  try { form = await new Response(Buffer.from(raw), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData() }
  catch { return { error: 'invalid_file' } }
  const photos = form.getAll('photo').filter((entry): entry is File => entry instanceof File)
  if (photos.length < 1 || photos.length > MENU_IMPORT_MAX_PHOTOS) return { error: 'photo_limit' }
  const document = await PDFDocument.create()
  // Fixed metadata keeps the PDF byte-identical for the same photos, so a retried upload is recognised.
  document.setCreationDate(new Date(0)); document.setModificationDate(new Date(0)); document.setProducer('Masabu'); document.setCreator('Masabu')
  for (const photo of photos) {
    const bytes = new Uint8Array(await photo.arrayBuffer())
    const mime = menuImportMime(bytes)
    if (!mime || mime === 'application/pdf') return { error: 'invalid_file' }
    const jpeg = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()
    const image = await document.embedJpg(jpeg)
    document.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  const pdf = await document.save({ useObjectStreams: true })
  return pdf.length > MENU_IMPORT_MAX_BYTES ? { error: 'file_too_large' } : pdf
}

export async function POST(request: Request) {
  const access = await gate(request, true)
  if (!access) return reply({ error: 'forbidden' }, 403)
  if (process.env.MENU_IMPORT_ENABLED !== 'true') return reply({ error: 'not_configured' }, 503)
  const id = request.headers.get('x-request-id')
  const filename = new URL(request.url).searchParams.get('filename')?.split('').filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127 && character !== '/' && character !== String.fromCharCode(92)).join('').slice(0, 180)
  if (!uuid.safeParse(id).success || !filename) return reply({ error: 'invalid_input' }, 400)
  const isPhotoSet = (request.headers.get('content-type') ?? '').startsWith('multipart/form-data')
  const body = await readBoundedRequestBody(request, isPhotoSet ? MENU_IMPORT_MAX_UPLOAD_BYTES : MENU_IMPORT_MAX_BYTES)
  if (!body.ok) return reply({ error: 'file_too_large' }, body.status)
  let bytes = body.bytes
  if (isPhotoSet) {
    try {
      const pdf = await photosToPdf(request, body.bytes)
      if ('error' in pdf) return reply({ error: pdf.error }, 400)
      bytes = pdf
    } catch { return reply({ error: 'invalid_file' }, 400) }
  }
  const mime = menuImportMime(bytes)
  if (!mime || bytes.length < 16) return reply({ error: 'invalid_file' }, 400)
  try {
    if (mime === 'application/pdf') {
      const document = await PDFDocument.load(bytes)
      if (document.isEncrypted || document.getPageCount() < 1 || document.getPageCount() > 10) return reply({ error: 'pdf_page_limit' }, 400)
    } else {
      const metadata = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata()
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 20_000_000 || (metadata.pages ?? 1) > 1) return reply({ error: 'invalid_file' }, 400)
    }
  } catch { return reply({ error: 'invalid_file' }, 400) }
  try {
    const result = await enqueueMenuImport({ ...access, id: id!, filename, mime,
      base64: Buffer.from(bytes).toString('base64'), hash: createHash('sha256').update(bytes).digest('hex') })
    return result.error ? reply({ error: result.error }, result.error === 'quota_exceeded' ? 429 : 409) : reply({ job: result.job }, 202)
  } catch { return reply({ error: 'unavailable' }, 503) }
}

export async function PATCH(request: Request) {
  const access = await gate(request, true)
  if (!access) return reply({ error: 'forbidden' }, 403)
  const body = await readBoundedRequestBody(request, 300_000)
  if (!body.ok) return reply({ error: 'invalid_input' }, body.status)
  let input: unknown
  try { input = JSON.parse(new TextDecoder().decode(body.bytes)) } catch { return reply({ error: 'invalid_input' }, 400) }
  const parsed = z.object({ id: uuid, revision: z.number().int().nonnegative(), mode: z.enum(['save', 'apply', 'dismiss']), rows: z.unknown().optional() }).strict().safeParse(input)
  if (!parsed.success) return reply({ error: 'invalid_input' }, 400)
  const { id, revision, mode } = parsed.data
  const rows = mode === 'dismiss' ? null : parseMenuImportRows(parsed.data.rows, mode === 'apply')
  if (mode !== 'dismiss' && !rows) return reply({ error: 'invalid_rows' }, 400)
  const { data, error } = await rpc('review_menu_import', { p_restaurant: access.restaurantId, p_job: id, p_revision: revision, p_mode: mode, p_rows: rows })
  if (error) return reply({ error: ['revision_conflict', 'menu_conflict', 'not_found', 'invalid_state'].includes(error.message) ? error.message : 'unavailable' }, 409)
  if (mode === 'apply') {
    revalidatePath(`/dashboard/${access.restaurantId}/menu`)
    revalidateTag(`menu:${access.restaurantId}`)
  }
  return reply({ job: data })
}
