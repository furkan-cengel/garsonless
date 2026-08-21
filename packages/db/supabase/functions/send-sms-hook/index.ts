import { Webhook } from 'standardwebhooks'

interface SmsHookPayload {
  user: { phone?: string | null }
  sms: { otp?: string | null }
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

Deno.serve(async (request) => {
  const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRETS')
  const usercode = Deno.env.get('NETGSM_USERCODE')
  const password = Deno.env.get('NETGSM_PASSWORD')
  const msgheader = Deno.env.get('NETGSM_MSGHEADER')
  if (!hookSecret || !usercode || !password || !msgheader) {
    console.error(JSON.stringify({ event: 'customer_auth.sms.configuration_missing' }))
    return json({ error: 'Hook not configured' }, 500)
  }

  const rawBody = await request.text()
  let payload: SmsHookPayload
  try {
    const activeSecret = hookSecret.split('|', 1)[0]!.replace('v1,whsec_', '')
    payload = new Webhook(activeSecret).verify(rawBody, {
      'webhook-id': request.headers.get('webhook-id') ?? '',
      'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': request.headers.get('webhook-signature') ?? '',
    }) as SmsHookPayload
  } catch {
    return json({ error: 'Invalid signature' }, 401)
  }

  const phone = payload.user?.phone ?? ''
  const otp = payload.sms?.otp ?? ''
  if (!/^\+905\d{9}$/.test(phone) || !/^\d{6}$/.test(otp)) {
    return json({ error: 'Invalid SMS payload' }, 400)
  }

  const response = await fetch('https://api.netgsm.com.tr/sms/rest/v2/otp', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${usercode}:${password}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      msgheader,
      msg: `Masabu kodunuz: ${otp}. Kimseyle paylasmayin.`,
      no: phone.slice(3),
      appname: 'Masabu',
    }),
  })

  const result = await response.json().catch(() => null) as {
    code?: unknown
    jobid?: unknown
  } | null
  if (!response.ok || result?.code !== '00') {
    console.error(JSON.stringify({
      event: 'customer_auth.sms.delivery_failed',
      provider: 'netgsm',
      status: response.status,
      providerCode: typeof result?.code === 'string' ? result.code : 'invalid_response',
    }))
    return json({ error: 'SMS delivery failed' }, 502)
  }

  console.info(JSON.stringify({
    event: 'customer_auth.sms.sent',
    provider: 'netgsm',
    providerMessageIdPresent: Boolean(result.jobid),
  }))
  return new Response(null, { status: 200 })
})
