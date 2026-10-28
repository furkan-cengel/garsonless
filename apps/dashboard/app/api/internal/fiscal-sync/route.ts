import { NextResponse } from 'next/server'
import { claimFiscalDocuments, finishFiscalDocument } from '@garsonless/db/server'
import { syncFiscalDocument } from '../../../../lib/fiscal/fiscal-sync'
import { bearerMatches } from '../../../../lib/fiscal/fiscal-secret'
import { createTokenxClient, readTokenxConfig } from '../../../../lib/fiscal/tokenx-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Sends pending ÖKC baskets. Called by the database on order changes and once a minute for retries. */
export async function POST(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'), process.env['FISCAL_SYNC_WORKER_SECRET'])) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const config = readTokenxConfig()
  if (!config) return NextResponse.json({ processed: 0, reason: 'provider_not_configured' }, { status: 503 })
  const client = createTokenxClient(config)
  const docs = await claimFiscalDocuments(20)
  const outcomes: Record<string, number> = {}
  for (const doc of docs) {
    const result = await syncFiscalDocument(doc, client)
    await finishFiscalDocument({ id: doc.id, revision: doc.revision, ...result })
    outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1
  }
  return NextResponse.json({ processed: docs.length, outcomes })
}
