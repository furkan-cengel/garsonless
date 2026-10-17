import { createHash } from 'node:crypto'
import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { readBoundedRequestBody } from '@garsonless/application/request-body'
import { MENU_IMPORT_MAX_BYTES, menuImportMime, parseMenuImportRows } from '@garsonless/application/menu-import'
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

export async function POST(request: Request) {
  const access = await gate(request, true)
  if (!access) return reply({ error: 'forbidden' }, 403)
  if (process.env.MENU_IMPORT_ENABLED !== 'true') return reply({ error: 'not_configured' }, 503)
  const id = request.headers.get('x-request-id')
  const filename = new URL(request.url).searchParams.get('filename')?.split('').filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127 && character !== '/' && character !== String.fromCharCode(92)).join('').slice(0, 180)
  if (!uuid.safeParse(id).success || !filename) return reply({ error: 'invalid_input' }, 400)
  const body = await readBoundedRequestBody(request, MENU_IMPORT_MAX_BYTES)
  if (!body.ok) return reply({ error: 'file_too_large' }, body.status)
  const mime = menuImportMime(body.bytes)
  if (!mime || body.bytes.length < 16) return reply({ error: 'invalid_file' }, 400)
  try {
    if (mime === 'application/pdf') {
      const document = await PDFDocument.load(body.bytes)
      if (document.isEncrypted || document.getPageCount() < 1 || document.getPageCount() > 10) return reply({ error: 'pdf_page_limit' }, 400)
    } else {
      const metadata = await sharp(body.bytes, { limitInputPixels: 20_000_000 }).metadata()
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 20_000_000 || (metadata.pages ?? 1) > 1) return reply({ error: 'invalid_file' }, 400)
    }
  } catch { return reply({ error: 'invalid_file' }, 400) }
  try {
    const result = await enqueueMenuImport({ ...access, id: id!, filename, mime,
      base64: Buffer.from(body.bytes).toString('base64'), hash: createHash('sha256').update(body.bytes).digest('hex') })
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
