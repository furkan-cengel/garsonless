import { readBoundedRequestBody } from '@garsonless/application/request-body'
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
import {
  declaredBillingBodyTooLarge,
  isBillingWebhookMediaType,
} from '../../../../../lib/billing/subscription-billing-http-boundary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BYTES = 64 * 1024

function json(body: Record<string, unknown>, status = 200): NextResponse {
  const response = NextResponse.json(body, { status })
  response.headers.set('cache-control', 'no-store')
  return response
}

function failureStatus(error: string): number {
  if (error.includes('signature')) return 401
  if (error.includes('body') || error.includes('payload') || error.includes('Unsupported')) return 400
  return 500
}

export async function POST(request: Request) {
  if (!isBillingWebhookMediaType(request.headers.get('content-type'))) {
    return json({ ok: false, code: 'BILLING_WEBHOOK_UNSUPPORTED_MEDIA_TYPE' }, 415)
  }
  if (declaredBillingBodyTooLarge(request.headers.get('content-length'), MAX_WEBHOOK_BYTES)) {
    return json({ ok: false, code: 'BILLING_WEBHOOK_TOO_LARGE' }, 413)
  }

  let config
  try {
    config = readIyzicoSubscriptionWebhookConfig()
  } catch {
    return json({ ok: false, code: 'BILLING_WEBHOOK_NOT_CONFIGURED' }, 503)
  }

  const body = await readBoundedRequestBody(request, MAX_WEBHOOK_BYTES)
  if (!body.ok) {
    return json({ ok: false, code: body.status === 413 ? 'BILLING_WEBHOOK_TOO_LARGE' : 'BILLING_WEBHOOK_INVALID_BODY' }, body.status)
  }
  const rawBody = body.bytes
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
    return json({ ok: false, code: 'BILLING_WEBHOOK_REJECTED' }, failureStatus(result.error))
  }
  return json({ ok: true, outcome: result.value.outcome })
}
