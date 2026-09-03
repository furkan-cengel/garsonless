export const MAX_PAYMENT_CALLBACK_BODY_BYTES = 8 * 1024

type CallbackRequestFailure = {
  ok: false
  status: 400 | 413 | 415
  error: string
}

type CallbackRequestSuccess = {
  ok: true
  token: string
}

function failure(status: CallbackRequestFailure['status'], error: string): CallbackRequestFailure {
  return { ok: false, status, error }
}

function validToken(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1024) return null
  if (value.trim() !== value) return null
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 31 || code === 127) return null
  }
  return value
}

async function readBoundedText(request: Request): Promise<CallbackRequestFailure | { ok: true; text: string }> {
  const declaredRaw = request.headers.get('content-length')?.trim()
  if (declaredRaw !== undefined) {
    if (!/^\d+$/.test(declaredRaw)) return failure(400, 'Ödeme callback isteği geçersiz.')
    if (Number(declaredRaw) > MAX_PAYMENT_CALLBACK_BODY_BYTES) {
      return failure(413, 'Ödeme callback isteği çok büyük.')
    }
  }
  if (!request.body) return failure(400, 'Ödeme callback tokenı eksik.')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > MAX_PAYMENT_CALLBACK_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return failure(413, 'Ödeme callback isteği çok büyük.')
      }
      chunks.push(value)
    }

    const bytes = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return failure(400, 'Ödeme callback isteği geçersiz.')
  }
}

/** Reads only the provider token through a strict media-type and byte boundary.
 * Callback requests are internet-facing and may use chunked transfer encoding,
 * so Content-Length alone is not an allocation limit. */
export async function readBoundedPaymentCallbackToken(
  request: Request,
): Promise<CallbackRequestFailure | CallbackRequestSuccess> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/x-www-form-urlencoded' && contentType !== 'application/json') {
    return failure(415, 'Ödeme callback formatı desteklenmiyor.')
  }

  const body = await readBoundedText(request)
  if (!body.ok) return body

  let candidate: unknown
  if (contentType === 'application/x-www-form-urlencoded') {
    const tokens = new URLSearchParams(body.text).getAll('token')
    if (tokens.length !== 1) return failure(400, 'Ödeme callback tokenı eksik veya belirsiz.')
    candidate = tokens[0]
  } else {
    try {
      const parsed = JSON.parse(body.text) as unknown
      candidate = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)['token']
        : undefined
    } catch {
      return failure(400, 'Ödeme callback isteği geçersiz.')
    }
  }

  const token = validToken(candidate)
  return token
    ? { ok: true, token }
    : failure(400, 'Ödeme callback tokenı eksik veya geçersiz.')
}
