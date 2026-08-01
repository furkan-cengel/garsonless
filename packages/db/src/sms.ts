// Campaign SMS provider abstraction. Customer authentication is handled by
// Supabase Auth email/OAuth; this module is not part of the login path.

export type SmsPurpose = 'campaign' | 'test'

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

export type SmsDeliveryReason = 'ready' | 'disabled' | 'provider_missing' | 'credentials_missing'

export interface SmsDeliveryAvailability {
  enabled: boolean
  provider: 'netgsm' | 'twilio' | 'mock' | null
  reason: SmsDeliveryReason
}

export class SmsDeliveryUnavailableError extends Error {
  readonly code = 'SMS_DELIVERY_UNAVAILABLE'

  constructor() {
    super('SMS gönderimi henüz etkin değil')
    this.name = 'SmsDeliveryUnavailableError'
  }
}

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

/** Hermetic fake provider. It never logs recipient PII or message content. */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock'

  async send(_phone: string, _message: string, _options: SmsSendOptions = {}): Promise<SmsSendResult> {
    return { provider: this.name, messageId: 'mock-delivery' }
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
  return (process.env['SMS_PROVIDER'] ?? '').trim().toLowerCase()
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

function credentialKeys(provider: string): readonly string[] {
  if (provider === 'netgsm') return ['NETGSM_USERCODE', 'NETGSM_PASSWORD', 'NETGSM_MSGHEADER']
  if (provider === 'twilio') return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']
  return []
}

export function getSmsDeliveryAvailability(): SmsDeliveryAvailability {
  if (process.env['SMS_DELIVERY_ENABLED'] !== 'true') {
    return { enabled: false, provider: null, reason: 'disabled' }
  }

  const which = resolveProviderName()
  const mockAllowed = !isProd() && process.env['SMS_ALLOW_MOCK'] === 'true'
  if (which !== 'netgsm' && which !== 'twilio' && !(which === 'mock' && mockAllowed)) {
    return { enabled: false, provider: null, reason: 'provider_missing' }
  }
  if (credentialKeys(which).some((key) => !process.env[key])) {
    return { enabled: false, provider: which, reason: 'credentials_missing' }
  }
  return { enabled: true, provider: which, reason: 'ready' }
}

/**
 * Fail-fast configuration guard (P1.1). The hermetic mock never performs a
 * delivery, so production must reject it instead of accepting a false success.
 * Provider adapters therefore fail closed rather than no-op.
 *
 * Checks:
 * Delivery is an explicit two-key activation: SMS_DELIVERY_ENABLED=true plus
 * a configured real provider. The default in every environment is disabled.
 */
export function assertSmsConfig(): void {
  if (process.env['SMS_DELIVERY_ENABLED'] !== 'true') return
  const which = resolveProviderName()
  const availability = getSmsDeliveryAvailability()
  if (availability.reason === 'provider_missing') {
    throw new Error('SMS misconfiguration: delivery is enabled but a real provider is not configured.')
  }
  if (availability.reason === 'credentials_missing') {
    const missing = credentialKeys(which).find((key) => !process.env[key])
    throw new Error(`SMS misconfiguration: SMS_PROVIDER=${which} but ${missing ?? 'provider credentials'} is not set.`)
  }
}

let cached: SmsProvider | null = null

export function getSmsProvider(): SmsProvider {
  const availability = getSmsDeliveryAvailability()
  if (!availability.enabled) throw new SmsDeliveryUnavailableError()
  const which = resolveProviderName()

  if (cached) return cached
  switch (which) {
    case 'twilio':
      cached = new TwilioSmsProvider()
      break
    case 'netgsm':
      cached = new NetgsmSmsProvider()
      break
    case 'mock':
      cached = new MockSmsProvider()
      break
    default:
      throw new SmsDeliveryUnavailableError()
  }
  return cached
}

/** Test-only: clear the memoized provider so a test can re-resolve under a
 *  different SMS_PROVIDER/NODE_ENV. Never call from application code. */
export function __resetSmsProviderCacheForTests(): void {
  cached = null
}
