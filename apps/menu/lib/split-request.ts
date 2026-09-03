import { createHash } from 'node:crypto'
import { z } from 'zod'

export const MAX_SPLIT_BODY_BYTES = 64 * 1024
export const MAX_SPLIT_ASSIGNED_ITEMS = 50

const splitAssignedItemsSchema = z.array(z.object({
  orderId: z.string().uuid(),
  itemId: z.string().trim().min(1).max(128),
}).strict()).max(MAX_SPLIT_ASSIGNED_ITEMS)

export function isValidCheckoutIdentityNumber(value: string): boolean {
  const normalized = value.trim()
  if (!/^[A-Za-z0-9]{5,32}$/.test(normalized)) return false
  if (/^(.)\1+$/.test(normalized)) return false
  if (!/^\d{11}$/.test(normalized)) return true

  const digits = [...normalized].map(Number)
  if (digits[0] === 0) return false
  const odd = (digits[0] ?? 0) + (digits[2] ?? 0) + (digits[4] ?? 0)
    + (digits[6] ?? 0) + (digits[8] ?? 0)
  const even = (digits[1] ?? 0) + (digits[3] ?? 0) + (digits[5] ?? 0) + (digits[7] ?? 0)
  const tenth = (((odd * 7) - even) % 10 + 10) % 10
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10
  return digits[9] === tenth && digits[10] === eleventh
}

export const checkoutBuyerFields = {
  buyerName: z.string().trim().min(1).max(50),
  buyerSurname: z.string().trim().min(1).max(50),
  buyerEmail: z.string().trim().max(254).email(),
  buyerPhone: z.string().trim().min(7).max(20).regex(/^\+?[0-9 ()-]+$/)
    .refine((value) => {
      const digits = value.replace(/\D/g, '').length
      return digits >= 7 && digits <= 15
    }, { message: 'Geçerli bir telefon numarası girin.' }),
  // Iyzico requires a real TCKN for Turkish buyers or a passport identifier
  // for foreign buyers. The value is forwarded to Iyzico and never persisted.
  buyerIdentityNumber: z.string().trim().refine(
    isValidCheckoutIdentityNumber,
    { message: 'Geçerli bir T.C. kimlik veya pasaport numarası girin.' },
  ),
  deviceId: z.string().trim().min(1).max(128),
} as const

export const splitCreateSchema = z.object({
  slug: z.string().trim().min(1).max(128),
  tableToken: z.string().uuid(),
  tableSessionId: z.string().uuid(),
  requestId: z.string().uuid(),
  method: z.enum(['iyzico', 'cash']),
  label: z.string().trim().min(1).max(40).optional(),
  amount: z.number().finite().positive().max(1_000_000).optional(),
  assignedItems: splitAssignedItemsSchema.optional(),
}).strict().superRefine((value, context) => {
  const hasAmount = typeof value.amount === 'number'
  const hasItems = Boolean(value.assignedItems?.length)
  if (hasAmount === hasItems) {
    context.addIssue({ code: 'custom', message: 'Yalnız pay tutarı veya kalemleri gönderilmelidir.' })
  }
})

export const splitPaySchema = z.object({
  shareId: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(128).optional(),
  tableSessionId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40).optional(),
  amount: z.number().finite().positive().max(1_000_000).optional(),
  assignedItems: splitAssignedItemsSchema.optional(),
  tableToken: z.string().uuid(),
  ...checkoutBuyerFields,
}).strict().superRefine((value, context) => {
  if (value.shareId) {
    if (value.slug || value.tableSessionId || value.requestId || value.label
      || value.amount !== undefined || value.assignedItems !== undefined) {
      context.addIssue({ code: 'custom', message: 'Mevcut pay ile yeni pay bilgileri birlikte gönderilemez.' })
    }
    return
  }
  const hasAmount = typeof value.amount === 'number'
  const hasItems = Boolean(value.assignedItems?.length)
  if (!value.slug || !value.tableSessionId || !value.requestId || hasAmount === hasItems) {
    context.addIssue({ code: 'custom', message: 'Kart payı bilgileri eksik veya belirsiz.' })
  }
})

type SplitRequestFailure = { ok: false; status: 400 | 413 | 415; error: string }
type SplitRequestSuccess = { ok: true; data: unknown }

export function validateSplitRequestHeaders(headers: Headers): SplitRequestFailure | null {
  const contentType = headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) {
    return { ok: false, status: 415, error: 'İstek JSON formatında olmalıdır.' }
  }
  const declaredLength = Number(headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SPLIT_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Paylaşım isteği çok büyük.' }
  }
  return null
}

export function parseSplitRequestBody(rawBody: string): SplitRequestFailure | SplitRequestSuccess {
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_SPLIT_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Paylaşım isteği çok büyük.' }
  }
  try {
    return { ok: true, data: JSON.parse(rawBody) as unknown }
  } catch {
    return { ok: false, status: 400, error: 'Geçersiz JSON.' }
  }
}

/** Reads the request stream with a hard in-process ceiling. Checking only
 * Content-Length or measuring after `request.text()` still lets a chunked body
 * consume unbounded memory before rejection. */
export async function readBoundedPaymentJson(request: Request): Promise<SplitRequestFailure | SplitRequestSuccess> {
  const headerError = validateSplitRequestHeaders(request.headers)
  if (headerError) return headerError
  if (!request.body) return parseSplitRequestBody('')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > MAX_SPLIT_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, status: 413, error: 'Ödeme isteği çok büyük.' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400, error: 'Geçersiz JSON.' }
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return parseSplitRequestBody(new TextDecoder().decode(bytes))
}

/** Hashes network context with the revocable table credential; raw IP and user
 * agent values never leave the request process or enter the rate journal. */
export function createSplitRateLimitKey(request: Request, tableToken: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')?.trim()
    ?? 'unknown'
  return createHash('sha256')
    .update(`${tableToken}:${ip}:${request.headers.get('user-agent') ?? ''}`)
    .digest('hex')
}

export function createSplitRequestFingerprint(input: {
  tableSessionId: string
  method: 'iyzico' | 'cash'
  label?: string
  amount?: number
  assignedItems?: Array<{ orderId: string; itemId: string }>
}): string {
  const assignedItems = input.assignedItems
    ? [...input.assignedItems]
      .map(({ orderId, itemId }) => ({ orderId, itemId }))
      .sort((left, right) => `${left.orderId}:${left.itemId}`.localeCompare(`${right.orderId}:${right.itemId}`))
    : null
  return createHash('sha256').update(JSON.stringify({
    tableSessionId: input.tableSessionId,
    method: input.method,
    label: input.label?.trim() || null,
    amount: input.amount ?? null,
    assignedItems,
  })).digest('hex')
}

export function splitErrorStatus(error: string): 400 | 404 | 409 | 429 | 503 {
  if (error === 'Pay güvenlik kontrolü kullanılamıyor') return 503
  if (error.startsWith('Çok fazla pay denemesi')) return 429
  if (error.includes('çok fazla bekleyen pay') || error.includes('farklı pay bilgileri')) return 409
  if (error.includes('bulunamadı') || error.includes('kapanmış')) return 404
  return 400
}
