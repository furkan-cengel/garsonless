// SMS provider abstraction. Mock remains the default/test provider; production
// deployments can select Netgsm or Twilio via SMS_PROVIDER without changing
// OTP or campaign call sites.

export type SmsPurpose = 'otp' | 'campaign' | 'test'

export interface SmsSendOptions {
  purpose?: SmsPurpose
  restaurantId?: string
  campaignId?: string
}

export interface SmsSendResult {
  provider: string
  messageId?: string
}

export interface SmsProvider {
  readonly name: string
  send(phone: string, message: string, options?: SmsSendOptions): Promise<SmsSendResult>
}

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

function truncateForLog(message: string): string {
  return message.length > 160 ? `${message.slice(0, 157)}...` : message
}

/** Logs the SMS server-side. Dev OTP echo is handled by the route and gated by
 *  NODE_ENV !== 'production'. */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock'

  async send(phone: string, message: string, options: SmsSendOptions = {}): Promise<SmsSendResult> {
    console.log(`[MockSmsProvider] ${options.purpose ?? 'sms'} to ${phone}: ${truncateForLog(message)}`)
    return { provider: this.name, messageId: `mock_${Date.now()}` }
  }
}

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio'

  async send(phone: string, message: string): Promise<SmsSendResult> {
    const sid = requireEnv('TWILIO_ACCOUNT_SID')
    const token = requireEnv('TWILIO_AUTH_TOKEN')
    const from = requireEnv('TWILIO_FROM')
    const body = new URLSearchParams({ To: phone, From: from, Body: message })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const json = await res.json().catch(() => null) as { sid?: string; message?: string; error_message?: string } | null
    if (!res.ok) {
      throw new Error(json?.message ?? json?.error_message ?? `Twilio SMS failed (${res.status})`)
    }
    return { provider: this.name, ...(json?.sid ? { messageId: json.sid } : {}) }
  }
}

export class NetgsmSmsProvider implements SmsProvider {
  readonly name = 'netgsm'

  async send(phone: string, message: string): Promise<SmsSendResult> {
    const usercode = requireEnv('NETGSM_USERCODE')
    const password = requireEnv('NETGSM_PASSWORD')
    const msgheader = requireEnv('NETGSM_MSGHEADER')
    const endpoint = process.env['NETGSM_API_URL'] ?? 'https://api.netgsm.com.tr/sms/rest/v2/send'
    const digits = phone.replace(/\D/g, '')
    const target = digits.startsWith('90') ? digits : phone

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${usercode}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgheader,
        messages: [{ msg: message, no: target }],
        encoding: 'TR',
      }),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Netgsm SMS failed (${res.status}): ${text.slice(0, 120)}`)
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = text }
    const messageId = readNetgsmMessageId(parsed)
    return { provider: this.name, ...(messageId ? { messageId } : {}) }
  }
}

function readNetgsmMessageId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const candidates = [record['jobid'], record['job_id'], record['id']]
  const found = candidates.find((v) => typeof v === 'string' || typeof v === 'number')
  return found == null ? undefined : String(found)
}

function resolveProviderName(): string {
  return (process.env['SMS_PROVIDER'] ?? 'mock').toLowerCase()
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Fail-fast configuration guard (P1.1). The mock provider only console.logs —
 * if it were the resolved provider in production, every customer OTP would
 * silently vanish and auth would appear "up" while being completely broken.
 * That silent-outage mode is the single worst failure for a launch, so this
 * MUST throw rather than no-op.
 *
 * Called at boot from apps/menu instrumentation (crashes a misconfigured prod
 * deploy before it serves a single request) AND, as defense-in-depth, inside
 * getSmsProvider (covers any path that bypasses instrumentation).
 *
 * Checks:
 *  - CUSTOMER_SESSION_SECRET must be present (session signing dies without it).
 *  - In production, SMS_PROVIDER must not be mock/unset.
 *  - When a real provider is selected, its credentials must be present (so the
 *    misconfiguration surfaces at boot, not on the first customer's send).
 */
export function assertSmsConfig(): void {
  if (!process.env['CUSTOMER_SESSION_SECRET']) {
    throw new Error('Auth misconfiguration: CUSTOMER_SESSION_SECRET is not set.')
  }

  const which = resolveProviderName()

  if (isProd() && (which === 'mock' || which === '' || !process.env['SMS_PROVIDER'])) {
    throw new Error(
      `SMS misconfiguration: SMS_PROVIDER=${process.env['SMS_PROVIDER'] ? `'${which}'` : '(unset)'} ` +
        `resolves to the mock provider under NODE_ENV=production. Real customer OTP delivery would ` +
        `silently no-op. Set SMS_PROVIDER=netgsm (or twilio) with credentials.`,
    )
  }

  if (which === 'netgsm') {
    for (const key of ['NETGSM_USERCODE', 'NETGSM_PASSWORD', 'NETGSM_MSGHEADER']) {
      if (!process.env[key]) throw new Error(`SMS misconfiguration: SMS_PROVIDER=netgsm but ${key} is not set.`)
    }
  }

  if (which === 'twilio') {
    for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']) {
      if (!process.env[key]) throw new Error(`SMS misconfiguration: SMS_PROVIDER=twilio but ${key} is not set.`)
    }
  }
}

let cached: SmsProvider | null = null

export function getSmsProvider(): SmsProvider {
  const which = resolveProviderName()

  // Defense-in-depth (runs BEFORE the cache): the mock only logs and must never
  // be the resolved provider in production — mirrors the boot-time
  // assertSmsConfig guard so no bypass path can silently drop OTPs.
  if (isProd() && (which === 'mock' || which === '' || !process.env['SMS_PROVIDER'])) {
    throw new Error(
      `SMS misconfiguration: SMS_PROVIDER=${process.env['SMS_PROVIDER'] ? `'${which}'` : '(unset)'} ` +
        `resolves to the mock provider under NODE_ENV=production.`,
    )
  }

  if (cached) return cached
  switch (which) {
    case 'twilio':
      cached = new TwilioSmsProvider()
      break
    case 'netgsm':
      cached = new NetgsmSmsProvider()
      break
    case 'mock':
    default:
      cached = new MockSmsProvider()
  }
  return cached
}

/** Test-only: clear the memoized provider so a test can re-resolve under a
 *  different SMS_PROVIDER/NODE_ENV. Never call from application code. */
export function __resetSmsProviderCacheForTests(): void {
  cached = null
}
