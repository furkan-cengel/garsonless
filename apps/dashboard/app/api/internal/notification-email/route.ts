import { consumeNotificationEmail } from '@garsonless/application/notification-emails'
import { createNotificationEmailPort } from '@garsonless/db/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createNotificationEmailProvider } from '../../../../lib/notification-email-provider'
import { billingDashboardUrl } from '../../../../lib/billing/subscription-billing-request'
import { isAuthorizedWorkerRequest } from '@garsonless/application/worker-secret'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ eventId: z.string().uuid() })

export async function POST(request: Request) {
  if (!isAuthorizedWorkerRequest(request.headers, process.env['OUTBOX_WORKER_SECRET'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })

  try {
    const result = await consumeNotificationEmail(
      parsed.data.eventId,
      createNotificationEmailPort(),
      createNotificationEmailProvider(),
      { dashboardBaseUrl: billingDashboardUrl('/', process.env['NEXT_PUBLIC_APP_URL']).origin },
    )
    if (result.ok) return NextResponse.json(result.value)
    console.error('[notification-email-consumer]', { eventId: parsed.data.eventId, error: result.error })
    return NextResponse.json({ error: 'Notification email delivery failed' }, { status: 503 })
  } catch (cause) {
    console.error('[notification-email-consumer]', { eventId: parsed.data.eventId }, cause)
    return NextResponse.json({ error: 'Notification email delivery unavailable' }, { status: 503 })
  }
}
