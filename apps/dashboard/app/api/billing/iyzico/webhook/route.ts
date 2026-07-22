import { processSubscriptionBillingWebhook } from '@garsonless/application/billing'
import {
  createSubscriptionBillingPersistencePort,
  createSubscriptionBillingWebhookInboxPort,
} from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import {
  createIyzicoSubscriptionWebhookVerifier,
  readIyzicoSubscriptionWebhookConfig,
} from '../../../../../lib/billing/iyzico-subscription-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BYTES = 64 * 1024

function failureStatus(error: string): number {
  if (error.includes('signature')) return 401
  if (error.includes('body') || error.includes('payload') || error.includes('Unsupported')) return 400
  return 500
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ ok: false, code: 'BILLING_WEBHOOK_TOO_LARGE' }, { status: 413 })
  }

  let config
  try {
    config = readIyzicoSubscriptionWebhookConfig()
  } catch {
    return NextResponse.json({ ok: false, code: 'BILLING_WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
  }

  const rawBody = new Uint8Array(await request.arrayBuffer())
  if (rawBody.byteLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ ok: false, code: 'BILLING_WEBHOOK_TOO_LARGE' }, { status: 413 })
  }
  const result = await processSubscriptionBillingWebhook(
    {
      rawBody,
      headers: {
        'x-iyz-signature-v3': request.headers.get('x-iyz-signature-v3') ?? undefined,
      },
    },
    createIyzicoSubscriptionWebhookVerifier(config),
    createSubscriptionBillingWebhookInboxPort(),
    createSubscriptionBillingPersistencePort(),
  )

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: 'BILLING_WEBHOOK_REJECTED' },
      { status: failureStatus(result.error) },
    )
  }
  return NextResponse.json({ ok: true, outcome: result.value.outcome })
}
