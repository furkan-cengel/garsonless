import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Lead = {
  name: string
  email: string
  phone: string
  businessName: string
  branchCount: number
  message: string
  website: string
}

type RateEntry = { count: number; resetAt: number }
const rateStore = globalThis as typeof globalThis & { __masabuBusinessLeadRate?: Map<string, RateEntry> }
const leadsByIp = rateStore.__masabuBusinessLeadRate ?? new Map<string, RateEntry>()
rateStore.__masabuBusinessLeadRate = leadsByIp

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.trim().replace(/\s+/g, ' ')
  return result.length > 0 && result.length <= max ? result : null
}

function parseLead(value: unknown): Lead | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const name = clean(row.name, 120)
  const email = clean(row.email, 320)?.toLowerCase() ?? null
  const phone = clean(row.phone, 30)
  const businessName = clean(row.businessName, 200)
  const message = clean(row.message, 2000)
  const branchCount = typeof row.branchCount === 'string' || typeof row.branchCount === 'number'
    ? Number(row.branchCount)
    : Number.NaN
  const website = typeof row.website === 'string' ? row.website.trim() : ''
  if (!name || !email || !phone || !businessName || !message
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !/^\+?[0-9\s()-]{10,30}$/.test(phone)
    || !Number.isInteger(branchCount) || branchCount < 1 || branchCount > 10_000
    || website.length > 200) return null
  return { name, email, phone, businessName, branchCount, message, website }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!)
}

function rateLimited(key: string, now = Date.now()): boolean {
  if (leadsByIp.size > 2_000) {
    for (const [entryKey, entry] of leadsByIp) if (entry.resetAt <= now) leadsByIp.delete(entryKey)
  }
  const current = leadsByIp.get(key)
  if (!current || current.resetAt <= now) {
    leadsByIp.set(key, { count: 1, resetAt: now + 10 * 60_000 })
    return false
  }
  current.count += 1
  return current.count > 3
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
  const lead = parseLead(input)
  if (!lead) return NextResponse.json({ message: 'Lütfen tüm alanları geçerli biçimde doldurun.' }, { status: 400 })
  if (lead.website) return NextResponse.json({ success: true })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')?.trim() ?? 'unknown'
  if (rateLimited(ip)) return NextResponse.json({ message: 'Çok fazla talep gönderdiniz. Lütfen daha sonra tekrar deneyin.' }, { status: 429 })

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  const to = process.env.RESEND_SALES_TO_EMAIL?.trim()
  if (!apiKey || !from || !to) {
    return NextResponse.json({ message: 'Satış formu geçici olarak kullanılamıyor.' }, { status: 503 })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: lead.email,
      subject: `Business talebi · ${lead.businessName} · ${lead.branchCount} şube`,
      html: `<h2>Yeni Business satış talebi</h2>
        <p><strong>Ad soyad:</strong> ${escapeHtml(lead.name)}</p>
        <p><strong>E-posta:</strong> ${escapeHtml(lead.email)}</p>
        <p><strong>Telefon:</strong> ${escapeHtml(lead.phone)}</p>
        <p><strong>İşletme:</strong> ${escapeHtml(lead.businessName)}</p>
        <p><strong>Şube sayısı:</strong> ${lead.branchCount}</p>
        <p><strong>Mesaj:</strong><br>${escapeHtml(lead.message)}</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  if (!response?.ok) return NextResponse.json({ message: 'Talebiniz gönderilemedi. Lütfen daha sonra tekrar deneyin.' }, { status: 503 })
  return NextResponse.json({ success: true })
}
