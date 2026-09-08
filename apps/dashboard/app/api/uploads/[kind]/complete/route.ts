import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { getDashboardRequestAuth } from '../../../../../lib/auth/current-user'
import { isLargeUploadKind } from '../../../../../lib/media-staging-policy'
import { readMediaMetadataRequest } from '../../../../../lib/media-staging-request'
import { dashboardMediaStagingWorkflow } from '../../../../../lib/media-staging-server'
import { sanitizeServerDiagnostic } from '../../../../../lib/server-log-redaction'

export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isLargeUploadKind(kind)) return NextResponse.json({ error: 'Geçersiz yükleme hedefi.' }, { status: 404 })
  let input: unknown
  try { input = await readMediaMetadataRequest(request) }
  catch { return NextResponse.json({ error: 'Geçersiz yükleme isteği.' }, { status: 400 }) }
  const { user } = await getDashboardRequestAuth()
  try {
    const parsed = z.object({ uploadId: z.string().uuid() }).strict().safeParse(input)
    if (!parsed.success) return NextResponse.json({ error: 'Geçersiz yükleme kaydı.' }, { status: 400 })
    const result = await dashboardMediaStagingWorkflow().complete(kind, parsed.data.uploadId, user.id)
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    unstable_rethrow(error)
    console.error('[media-staging-failure]', sanitizeServerDiagnostic(error))
    return NextResponse.json({ error: 'Dosya yüklenemedi. Lütfen tekrar deneyin.' }, { status: 503 })
  }
}
