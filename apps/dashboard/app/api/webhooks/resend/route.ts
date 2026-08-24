import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { recordResendCampaignEvent } from '@garsonless/db/server'

export const runtime = 'nodejs'

const EVENT_TYPES = new Set([
  'email.sent', 'email.delivered', 'email.delivery_delayed', 'email.opened',
  'email.clicked', 'email.bounced', 'email.complained', 'email.suppressed', 'email.failed',
])

type ResendWebhookEvent = {
  type: string
  created_at: string
  data: { email_id?: string }
}

function isResendWebhookEvent(value: unknown): value is ResendWebhookEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as Record<string, unknown>
  if (typeof event['type'] !== 'string' || typeof event['created_at'] !== 'string') return false
  const data = event['data']
  return Boolean(data && typeof data === 'object' && !Array.isArray(data))
}

export async function POST(request: Request) {
  const webhookSecret = process.env['RESEND_WEBHOOK_SECRET']
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook yapılandırılmadı' }, { status: 503 })
  const webhookId = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signature = request.headers.get('svix-signature')
  if (!webhookId || !timestamp || !signature) return NextResponse.json({ error: 'Geçersiz webhook' }, { status: 400 })

  const payload = await request.text()
  let event: unknown
  try {
    event = new Webhook(webhookSecret).verify(payload, {
      'svix-id': webhookId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    })
  } catch {
    return NextResponse.json({ error: 'Geçersiz webhook imzası' }, { status: 400 })
  }
  if (!isResendWebhookEvent(event)) return NextResponse.json({ error: 'Geçersiz webhook verisi' }, { status: 400 })
  if (!EVENT_TYPES.has(event.type)) return NextResponse.json({ received: true })
  const providerMessageId = event.data.email_id
  if (!providerMessageId) return NextResponse.json({ error: 'E-posta kimliği eksik' }, { status: 400 })

  try {
    await recordResendCampaignEvent({
      webhookId,
      providerMessageId,
      eventType: event.type.slice('email.'.length) as 'sent' | 'delivered' | 'delivery_delayed' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'suppressed' | 'failed',
      occurredAt: event.created_at,
    })
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Webhook işlenemedi' }, { status: 500 })
  }
}
