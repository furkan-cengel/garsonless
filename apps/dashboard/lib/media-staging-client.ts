'use client'

type Ticket = { uploadId: string; signedUrl: string; uploaded: boolean }
const tickets = new WeakMap<File, Map<string, Ticket>>()
const running = new WeakMap<File, Map<string, Promise<Response>>>()
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 750))

export function isMediaSignedUploadUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
    return url.origin === origin && !url.username && !url.password
      && url.pathname.startsWith('/storage/v1/object/upload/sign/restaurant-media-staging/')
  } catch { return false }
}

/** File bytes only go to private Storage; the application receives small JSON requests. */
export async function uploadLargeMedia(kind: string, form: FormData, file: File): Promise<Response> {
  const metadata: Record<string, string | number> = { size: file.size, type: file.type }
  for (const field of ['restaurantId', 'entityId', 'kind', 'purpose']) {
    const value = form.get(field)
    if (typeof value === 'string' && value) metadata[field] = value
  }
  const key = JSON.stringify([kind, metadata])
  let tasks = running.get(file)
  if (!tasks) { tasks = new Map(); running.set(file, tasks) }
  const pending = tasks.get(key)
  if (pending) return (await pending).clone()
  const task = transfer()
  tasks.set(key, task)
  try { return (await task).clone() }
  finally { tasks.delete(key) }

  async function transfer(): Promise<Response> {
    let fileTickets = tickets.get(file)
    if (!fileTickets) { fileTickets = new Map(); tickets.set(file, fileTickets) }
    let ticket = fileTickets.get(key)
    if (!ticket) {
      const response = await fetch(`/api/uploads/${kind}/prepare`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata),
      })
      if (!response.ok || response.redirected) return response
      const payload: unknown = await response.clone().json().catch(() => null)
      if (!payload || typeof payload !== 'object' || !('uploadId' in payload) || typeof payload.uploadId !== 'string'
        || !('signedUrl' in payload) || typeof payload.signedUrl !== 'string' || !isMediaSignedUploadUrl(payload.signedUrl)) {
        return Response.json({ error: 'Yükleme başlatılamadı. Lütfen tekrar deneyin.' }, { status: 400 })
      }
      ticket = { uploadId: payload.uploadId, signedUrl: payload.signedUrl, uploaded: false }
      fileTickets.set(key, ticket)
    }
    if (!ticket.uploaded) {
      const response = await fetch(ticket.signedUrl, {
        method: 'PUT', credentials: 'omit', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file,
      })
      // A lost response can leave the immutable object already stored. Finalize
      // still validates its size, MIME and contents before it can become public.
      const body: unknown = response.ok ? null : await response.clone().json().catch(() => null)
      const duplicate = response.status === 409 || (body && typeof body === 'object'
        && 'error' in body && body.error === 'Duplicate')
      if (!response.ok && !duplicate) {
        if (response.status === 413) return response
        fileTickets.delete(key)
        return Response.json({ error: 'Dosya aktarılamadı. Lütfen tekrar deneyin.' }, { status: 400 })
      }
      ticket.uploaded = true
    }
    for (let attempt = 0; attempt < 40; attempt += 1) {
      let response: Response
      try {
        response = await fetch(`/api/uploads/${kind}/complete`, {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: ticket.uploadId }),
        })
      } catch (error) {
        if (attempt >= 2) throw error
        await pause(); continue
      }
      if (response.status === 410) fileTickets.delete(key)
      if (response.status !== 202 && response.status !== 503) return response
      if (response.status === 503 && attempt >= 2) return response
      await pause()
    }
    return Response.json({ error: 'Dosya hâlâ işleniyor. Biraz bekleyip aynı dosyayla tekrar deneyin.' }, { status: 400 })
  }
}
