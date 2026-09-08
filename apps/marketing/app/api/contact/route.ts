import { brandEmailSender, renderContactEmail } from '@garsonless/domain/email-messages'
import { NextResponse } from 'next/server'
import { consumeDashboardAuthRateLimit } from '@garsonless/db/server'

export const runtime = 'nodejs'

type ContactTopic = 'general' | 'sales' | 'support'
type ContactMessage = {
  name: string
  email: string
  topic: ContactTopic
  businessName: string | null
  phone: string | null
  branchCount: number | null
  message: string
  website: string
  recaptchaToken: string
}

type RecaptchaResponse = { success?: boolean; hostname?: string; 'error-codes'?: string[] }

const RECAPTCHA_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'

function clean(value: unknown, max: number, required = true): string | null {
  if (typeof value !== 'string') return required ? null : ''
  const result = value.trim().replace(/\s+/g, ' ')
  if (!result) return required ? null : ''
  return result.length <= max ? result : null
}

function parseMessage(value: unknown): ContactMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const topic = row.topic === 'general' || row.topic === 'sales' || row.topic === 'support' ? row.topic : null
  const name = clean(row.name, 120)
  const email = clean(row.email, 320)?.toLowerCase() ?? null
  const businessName = clean(row.businessName, 200, false)
  const phone = clean(row.phone, 30, false)
  const message = clean(row.message, 2000)
  const website = typeof row.website === 'string' ? row.website.trim() : ''
  const recaptchaToken = clean(row.recaptchaToken, 4096)
  const branchCount = row.branchCount === '' || row.branchCount === undefined
    ? null
    : Number(row.branchCount)

  if (!topic || !name || !email || !message || !recaptchaToken
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || website.length > 200
    || (phone && !/^\+?[0-9\s()-]{10,30}$/.test(phone))
    || (branchCount !== null && (!Number.isInteger(branchCount) || branchCount < 1 || branchCount > 10_000))) return null

  if (topic === 'sales' && (!businessName || !phone || branchCount === null)) return null
  return { name, email, topic, businessName: businessName || null, phone: phone || null, branchCount, message, website, recaptchaToken }
}

async function verifyRecaptcha(token: string, expectedHostname: string): Promise<boolean> {
  const secret = process.env.NODE_ENV === 'development'
    ? RECAPTCHA_TEST_SECRET_KEY
    : process.env.RECAPTCHA_SECRET_KEY?.trim() || ''
  if (!secret) return false

  const verification = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
  if (!verification?.ok) return false

  const result = await verification.json().catch(() => null) as RecaptchaResponse | null
  if (!result?.success) return false
  if (process.env.NODE_ENV === 'development') return true
  return result.hostname === expectedHostname
}

function recipientFor(topic: ContactTopic): string | null {
  if (topic === 'sales') return process.env.RESEND_SALES_TO_EMAIL?.trim() || null
  if (topic === 'support') return process.env.RESEND_SUPPORT_TO_EMAIL?.trim()
    || process.env.RESEND_CONTACT_TO_EMAIL?.trim() || null
  return process.env.RESEND_CONTACT_TO_EMAIL?.trim() || null
}

function topicLabel(topic: ContactTopic): string {
  if (topic === 'sales') return 'Ürün ve fiyatlandırma'
  if (topic === 'support') return 'Teknik destek'
  return 'Genel bilgi'
}

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    return NextResponse.json({ message: 'Geçersiz istek.' }, { status: 415 })
  }
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const raw = await request.text().catch(() => '')
  if (!raw || raw.length > 20_000) return NextResponse.json({ message: 'Geçersiz form verisi.' }, { status: 400 })
  let input: unknown
  try { input = JSON.parse(raw) } catch { return NextResponse.json({ message: 'Geçersiz form verisi.' }, { status: 400 }) }
  const contact = parseMessage(input)
  if (!contact) return NextResponse.json({ message: 'Lütfen gerekli alanları geçerli biçimde doldurun.' }, { status: 400 })
  if (contact.website) return NextResponse.json({ success: true })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')?.trim() ?? 'unknown'
  const rateLimit = await consumeDashboardAuthRateLimit({
    action: 'marketing-contact',
    subject: `ip:${ip}`,
    limit: 3,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.ok) return NextResponse.json({ message: 'İletişim formu geçici olarak kullanılamıyor.' }, { status: 503 })
  if (!rateLimit.allowed) return NextResponse.json({ message: 'Çok fazla mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin.' }, { status: 429 })

  const verified = await verifyRecaptcha(contact.recaptchaToken, new URL(request.url).hostname)
  if (!verified) return NextResponse.json({ message: 'Güvenlik doğrulaması geçersiz veya süresi dolmuş. Lütfen tekrar deneyin.' }, { status: 400 })

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = brandEmailSender(process.env.RESEND_FROM_EMAIL)
  const to = recipientFor(contact.topic)
  if (!apiKey || !from || !to) {
    return NextResponse.json({ message: 'İletişim formu geçici olarak kullanılamıyor.' }, { status: 503 })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: contact.email,
      ...renderContactEmail({ ...contact, topic: topicLabel(contact.topic) }),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)

  if (!response?.ok) return NextResponse.json({ message: 'Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin.' }, { status: 503 })
  return NextResponse.json({ success: true })
}
