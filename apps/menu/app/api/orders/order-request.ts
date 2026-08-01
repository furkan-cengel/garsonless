import { z } from 'zod'

export const MAX_ORDER_BODY_BYTES = 128 * 1024
export const MAX_ORDER_ITEMS = 50
export const MAX_LINE_MODIFIERS = 40
export const MAX_LINE_REMOVALS = 40

const orderItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
  selectedModifiers: z.array(z.object({
    group_id: z.string().min(1).max(128),
    option_id: z.string().min(1).max(128),
    quantity: z.number().int().positive().max(99).optional(),
  })).max(MAX_LINE_MODIFIERS).optional(),
  removedIngredientIds: z.array(z.string().min(1).max(128)).max(MAX_LINE_REMOVALS).optional(),
  productNote: z.string().trim().max(500).optional(),
  recommendationSourceItemId: z.string().uuid().optional(),
  combo: z.object({
    instanceId: z.string().uuid(),
    sectionInstanceId: z.string().min(1).max(128),
    comboIndex: z.number().int().min(1).max(3),
  }).optional(),
  promotion: z.object({
    sectionInstanceId: z.string().min(1).max(128),
    kind: z.enum(['discount-badge', 'daily-special']),
  }).optional(),
  // Persisted pre-migration carts may still send these; the DB resolver ignores them.
  modifiers: z.array(z.record(z.unknown())).max(MAX_LINE_MODIFIERS).optional(),
  name: z.string().max(200).optional(),
  price: z.number().optional(),
  modifiersPriceDelta: z.number().optional(),
})

export const createOrderSchema = z.object({
  slug: z.string().min(1).max(128),
  tableToken: z.string().uuid(),
  sessionId: z.string().uuid(),
  requestId: z.string().uuid(),
  items: z.array(orderItemSchema).min(1).max(MAX_ORDER_ITEMS),
  // total is IGNORED — the server recomputes from DB prices. Kept for back-compat.
  total: z.number().nonnegative().optional(),
  redeemPoints: z.number().int().nonnegative().optional(),
  redeemStampClaim: z.boolean().optional(),
  catalogItemId: z.string().uuid().nullable().optional(),
})

type ValidationFailure = { ok: false; status: 400 | 413 | 415; error: string }
type ValidationSuccess = { ok: true; data: z.infer<typeof createOrderSchema> }

export function validateOrderRequestHeaders(headers: Headers): ValidationFailure | null {
  const contentType = headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) {
    return { ok: false, status: 415, error: 'İstek JSON formatında olmalıdır.' }
  }
  const declaredLength = Number(headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ORDER_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Sipariş isteği çok büyük.' }
  }
  return null
}

export function parseOrderRequestBody(rawBody: string): ValidationFailure | ValidationSuccess {
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_ORDER_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Sipariş isteği çok büyük.' }
  }
  let body: unknown
  try {
    body = JSON.parse(rawBody) as unknown
  } catch {
    return { ok: false, status: 400, error: 'Geçersiz JSON.' }
  }
  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message ?? 'Geçersiz sipariş isteği.',
    }
  }
  return { ok: true, data: parsed.data }
}
