import type { createDashboardMediaStagingPort, StagedMediaResult } from '@garsonless/db/server'
import { mediaPrepareSchema, validateStagingMetadata, type LargeUploadKind, type MediaPrepareInput } from './media-staging-policy'

type Port = ReturnType<typeof createDashboardMediaStagingPort>
type Reply = { status: number; body: Record<string, unknown> }
const failure = (status: number, error: string): Reply => ({ status, body: { error } })
export function createMediaStagingWorkflow(deps: {
  port: Port
  authorize: (kind: LargeUploadKind, input: MediaPrepareInput) => Promise<boolean>
  publish: (kind: LargeUploadKind, formData: FormData) => Promise<StagedMediaResult>
  now?: () => number
}) {
  const now = deps.now ?? Date.now
  return {
    async prepare(kind: LargeUploadKind, value: unknown, userId: string): Promise<Reply> {
      const parsed = mediaPrepareSchema.safeParse(value)
      if (!parsed.success) return failure(400, 'Dosya türünü, boyutunu ve yükleme hedefini kontrol edin.')
      const input = parsed.data
      const error = validateStagingMetadata(kind, input)
      if (error) return failure(400, error)
      if (!await deps.authorize(kind, input)) return failure(403, 'Bu işletmeye dosya yüklemek için yetkiniz yok.')
      const id = crypto.randomUUID()
      const path = `${userId}/${id}/source`
      try {
        await deps.port.create({ id, userId, restaurantId: input.restaurantId, kind, metadata: input, path })
      } catch (error) {
        if (error instanceof Error && error.message.includes('MEDIA_UPLOAD_RATE_LIMIT')) return failure(429, 'Çok fazla yükleme denemesi yapıldı. Biraz bekleyip tekrar deneyin.')
        throw error
      }
      const signedUrl = await deps.port.sign(path)
      return { status: 200, body: { uploadId: id, signedUrl } }
    },
    async complete(kind: LargeUploadKind, id: string, userId: string): Promise<Reply> {
      const row = await deps.port.read(id, userId)
      if (!row || row.kind !== kind) return failure(404, 'Yükleme kaydı bulunamadı. Dosyayı tekrar seçin.')
      const input = { ...row.metadata, restaurantId: row.restaurant_id }
      if (!await deps.authorize(kind, input)) return failure(403, 'Bu işletmeye dosya yüklemek için yetkiniz yok.')
      if (row.status === 'finished' && row.result) return { status: 'error' in row.result ? 400 : 200, body: row.result }
      if (Date.parse(row.expires_at) <= now()) return failure(410, 'Yükleme süresi doldu. Dosyayı tekrar seçin.')
      if (row.status === 'processing' || !await deps.port.claim(id, userId)) return { status: 202, body: { pending: true } }
      let file: Blob
      try {
        file = await deps.port.download(row.path)
      } catch {
        // No publish has started: it is safe to retry this same upload ID.
        await deps.port.release(id, userId)
        return failure(503, 'Dosyaya ulaşılamadı. Lütfen tekrar deneyin.')
      }
      let result: StagedMediaResult
      if (file.size !== row.metadata.size || file.type.split(';')[0] !== row.metadata.type) {
        result = { error: 'Yüklenen dosyanın türü veya boyutu seçilen dosyayla eşleşmiyor.' }
      } else {
        const data = new FormData()
        data.set('restaurantId', row.restaurant_id)
        if (input.entityId) data.set('entityId', input.entityId)
        if (input.kind) data.set('kind', input.kind)
        if (input.purpose) data.set('purpose', input.purpose)
        data.set('file', new File([file], 'upload', { type: row.metadata.type }))
        // The existing actions re-check current tenant/plan access and actual bytes.
        // Do not release the claim if publish throws: its write outcome may be unknown.
        result = await deps.publish(kind, data)
      }
      const saved = await deps.port.finish(id, userId, result)
      if (!saved) throw new Error('Media completion was not persisted')
      return { status: 'error' in result ? 400 : 200, body: result }
    },
  }
}

export async function cleanupMediaStaging(port: Port): Promise<number> {
  let count = 0
  const started = Date.now()
  while (Date.now() - started < 40_000) {
    const rows = await port.expired()
    if (!rows.length) break
    await port.removeObjects(rows.map((row) => row.path))
    await port.removeRecords(rows.map((row) => row.id))
    count += rows.length
    if (rows.length < 100) break
  }
  return count
}
