import { NextResponse } from 'next/server'
import { parseTokenxEvent } from '@garsonless/application/fiscal'
import { applyFiscalPayment, readFiscalPaymentScope, recordFiscalEvent } from '@garsonless/db/server'
import { planFiscalEvent } from '../../../../../lib/fiscal/fiscal-sync'
import { bearerMatches } from '../../../../../lib/fiscal/fiscal-secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024

/**
 * TokenX posts payment, lock and void results here with the auth header we
 * registered. A payment settles exactly the orders the device was sent.
 */
export async function POST(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'), process.env['TOKENX_CALLBACK_SECRET'])) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const event = parseTokenxEvent(body)
  if (!event) return NextResponse.json({ ignored: true })
  try {
    const scope = event.kind === 'completed' ? await readFiscalPaymentScope(event.basketId) : null
    const plan = planFiscalEvent(event, scope)
    if (plan.kind === 'record') await recordFiscalEvent(event.basketId, plan.event, 'terminalId' in event ? event.terminalId : null)
    if (plan.kind === 'settle' && event.kind === 'completed') {
      const outcome = await applyFiscalPayment({
        basketId: event.basketId,
        terminalId: event.terminalId,
        receiptNo: event.receiptNo,
        zNo: event.zNo,
        payments: event.payments,
        allocations: plan.allocations,
      })
      return NextResponse.json({ outcome })
    }
    return NextResponse.json({ outcome: plan.kind })
  } catch {
    // TokenX retries a failed delivery; the database makes a repeat a no-op.
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
