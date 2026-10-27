import { createHash } from 'node:crypto'
import { z } from 'zod'
import { readBoundedRequestBody } from '@garsonless/application/request-body'
import { INVOICE_IMPORT_MAX_BYTES, INVOICE_IMPORT_MAX_PHOTOS, INVOICE_IMPORT_MAX_UPLOAD_BYTES, invoiceImportMime, parseInvoiceImport } from '@garsonless/application/invoice-import'
import { enqueueInvoiceRead, readInvoiceRead } from '@garsonless/db/server'
import { assertAccess } from '@/lib/auth/access'
import { documentProblem, photosToPdf } from '@/lib/document-upload'

export const runtime = 'nodejs'
const uuid = z.string().uuid()
function reply(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }) }
// Invoice reading uses the menu reader's provider and worker, so the same switch turns both on.
const enabled = () => process.env.MENU_IMPORT_ENABLED === 'true'

async function gate(request: Request, mutate = false) {
  if (mutate && request.headers.get('origin') !== new URL(request.url).origin) return null
  const restaurantId = new URL(request.url).searchParams.get('restaurantId')
  if (!uuid.safeParse(restaurantId).success) return null
  const access = await assertAccess(restaurantId!, 'inventory')
  return 'error' in access ? null : { restaurantId: restaurantId!, actorId: access.userId }
}

/** Without an id: whether reading is available. With an id: that read's state and lines. */
export async function GET(request: Request) {
  const access = await gate(request)
  if (!access) return reply({ error: 'forbidden' }, 403)
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return reply({ enabled: enabled() })
  if (!uuid.safeParse(id).success) return reply({ error: 'invalid_input' }, 400)
  const result = await readInvoiceRead({ ...access, id })
  if (result.error || !result.job) return reply({ error: result.error ?? 'unavailable' }, result.error === 'not_found' ? 404 : 503)
  const job = result.job
  // The worker validated the lines already; validate again before they reach the browser.
  const invoice = job.status === 'done' ? parseInvoiceImport(job.result) : null
  return reply({ job: { ...job, result: invoice, ...(job.status === 'done' && !invoice ? { status: 'failed', error: 'invalid_output' } : {}) } })
}

export async function POST(request: Request) {
  const access = await gate(request, true)
  if (!access) return reply({ error: 'forbidden' }, 403)
  if (!enabled()) return reply({ error: 'not_configured' }, 503)
  const id = request.headers.get('x-request-id')
  if (!uuid.safeParse(id).success) return reply({ error: 'invalid_input' }, 400)
  const isPhotoSet = (request.headers.get('content-type') ?? '').startsWith('multipart/form-data')
  const body = await readBoundedRequestBody(request, isPhotoSet ? INVOICE_IMPORT_MAX_UPLOAD_BYTES : INVOICE_IMPORT_MAX_BYTES)
  if (!body.ok) return reply({ error: 'file_too_large' }, body.status)
  let bytes = body.bytes
  if (isPhotoSet) {
    try {
      const pdf = await photosToPdf(request, body.bytes, { maxPhotos: INVOICE_IMPORT_MAX_PHOTOS, maxBytes: INVOICE_IMPORT_MAX_BYTES }, invoiceImportMime)
      if ('error' in pdf) return reply({ error: pdf.error }, 400)
      bytes = pdf
    } catch { return reply({ error: 'invalid_file' }, 400) }
  }
  const mime = invoiceImportMime(bytes)
  if (!mime || bytes.length < 16) return reply({ error: 'invalid_file' }, 400)
  const problem = await documentProblem(bytes, mime, INVOICE_IMPORT_MAX_PHOTOS)
  if (problem) return reply({ error: problem }, 400)
  try {
    const result = await enqueueInvoiceRead({ ...access, id: id!, mime,
      base64: Buffer.from(bytes).toString('base64'), hash: createHash('sha256').update(bytes).digest('hex') })
    return result.error ? reply({ error: result.error }, result.error === 'quota_exceeded' ? 429 : 409) : reply({ job: result.job }, 202)
  } catch { return reply({ error: 'unavailable' }, 503) }
}
