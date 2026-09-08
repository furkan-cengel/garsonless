import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createDashboardMediaStagingPort } from '@garsonless/db/server'
import { cleanupMediaStaging } from '../../../../lib/media-staging-workflow'
import { sanitizeServerDiagnostic } from '../../../../lib/server-log-redaction'

export const runtime = 'nodejs'
export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.MEDIA_STAGING_CLEANUP_SECRET
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const removed = await cleanupMediaStaging(createDashboardMediaStagingPort())
    return NextResponse.json({ removed }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[media-staging-cleanup-failure]', sanitizeServerDiagnostic(error))
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 503 })
  }
}
