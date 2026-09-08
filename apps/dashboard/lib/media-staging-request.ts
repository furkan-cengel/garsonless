/** Metadata requests are bounded even when Content-Length is absent or dishonest. */
export async function readMediaMetadataRequest(request: Request): Promise<unknown> {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('INVALID_MEDIA_ORIGIN')
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new Error('INVALID_MEDIA_CONTENT')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('INVALID_MEDIA_BODY')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 4096) { await reader.cancel(); throw new Error('INVALID_MEDIA_BODY') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder().decode(bytes))
  } finally { reader.releaseLock() }
}
