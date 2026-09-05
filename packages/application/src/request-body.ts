export type BoundedRequestBody =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 413 }

/** Enforce the actual byte limit while reading, including chunked requests. */
export async function readBoundedRequestBody(
  request: Pick<Request, 'headers' | 'body'>,
  maxBytes: number,
): Promise<BoundedRequestBody> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('Invalid body limit')
  const declared = request.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) {
    return { ok: false, status: 400 }
  }
  if (declared !== null && Number(declared) > maxBytes) {
    await request.body?.cancel().catch(() => undefined)
    return { ok: false, status: 413 }
  }
  if (!request.body) return { ok: true, bytes: new Uint8Array() }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, status: 413 }
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, bytes }
  } catch {
    return { ok: false, status: 400 }
  } finally {
    reader.releaseLock()
  }
}
