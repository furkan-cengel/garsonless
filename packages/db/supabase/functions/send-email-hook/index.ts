// Supabase Auth "Send Email" hook → Resend köprüsü (Masabu markalı Türkçe
// auth e-postaları). Auth, her giden e-postayı standardwebhooks imzasıyla bu
// fonksiyona POST'lar; imza doğrulanır, action-type'a göre Türkçe şablon
// üretilir ve Resend API'siyle noreply@masabu.co'dan gönderilir.
//
// Gerekli secret'lar (supabase secrets set ile):
//   SEND_EMAIL_HOOK_SECRET — dashboard'da hook kaydedilince verilen secret
//                            ("v1,whsec_..." biçimi; prefix burada soyulur)
//   RESEND_API_KEY         — Resend API anahtarı (masabu.co domain'i doğrulanmış olmalı)

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

interface EmailHookPayload {
  user: { email: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
  }
}

const SUBJECTS: Record<string, string> = {
  signup: 'Masabu — e-posta adresini doğrula',
  magiclink: 'Masabu — giriş kodun',
  recovery: 'Masabu — şifre sıfırlama kodun',
  email_change: 'Masabu — e-posta değişikliği doğrulaması',
  otp: 'Masabu — doğrulama kodun',
  invite: 'Masabu — davetin hazır',
}

const HEADINGS: Record<string, string> = {
  signup: 'E-posta adresini doğrula',
  magiclink: 'Giriş kodun hazır',
  recovery: 'Şifreni sıfırla',
  email_change: 'E-posta değişikliğini onayla',
  otp: 'Doğrulama kodun',
  invite: 'Davet edildin',
}

function renderHtml(actionType: string, token: string): string {
  const heading = HEADINGS[actionType] ?? HEADINGS['otp']
  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:440px;margin:0 auto;padding:40px 20px;">
      <div style="background:#ffffff;border-radius:12px;border:1px solid #e8e8e4;padding:36px 32px;text-align:center;">
        <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#1a1a1a;margin-bottom:6px;">
          masa<span style="color:#2e7d52;">bu.</span>
        </div>
        <h1 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:22px 0 8px;">${heading}</h1>
        <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
          Aşağıdaki kodu uygulamadaki doğrulama alanına gir.
        </p>
        <div style="display:inline-block;background:#f0f7f3;border:1px solid #cde5d7;border-radius:10px;padding:16px 28px;">
          <span style="font-size:34px;font-weight:700;letter-spacing:0.28em;color:#1a1a1a;font-family:ui-monospace,'SF Mono',Menlo,monospace;">${token}</span>
        </div>
        <p style="font-size:12.5px;color:#9ca3af;line-height:1.6;margin:24px 0 0;">
          Bu kod <strong>10 dakika</strong> boyunca geçerlidir.<br />
          Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.
        </p>
      </div>
      <p style="text-align:center;font-size:11.5px;color:#9ca3af;margin:18px 0 0;">
        Masabu · QR menü &amp; dijital sipariş · masabu.co
      </p>
    </div>
  </body>
</html>`
}

Deno.serve(async (req) => {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!hookSecret || !resendKey) {
    console.error('Missing SEND_EMAIL_HOOK_SECRET or RESEND_API_KEY')
    return new Response(JSON.stringify({ error: 'Hook not configured' }), { status: 500 })
  }

  // 1) İmza doğrulaması (standardwebhooks). Supabase secret'ı "v1,whsec_<b64>"
  //    biçiminde verir — kütüphane çıplak base64 bekler, prefix soyulur.
  const rawBody = await req.text()
  let payload: EmailHookPayload
  try {
    const wh = new Webhook(hookSecret.replace('v1,whsec_', ''))
    payload = wh.verify(rawBody, {
      'webhook-id': req.headers.get('webhook-id') ?? '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': req.headers.get('webhook-signature') ?? '',
    }) as EmailHookPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
  }

  const email = payload.user?.email
  const token = payload.email_data?.token
  const actionType = payload.email_data?.email_action_type ?? 'otp'
  if (!email || !token) {
    return new Response(JSON.stringify({ error: 'Missing email or token' }), { status: 400 })
  }

  // 2) Resend ile gönder
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Masabu <noreply@masabu.co>',
      to: [email],
      subject: SUBJECTS[actionType] ?? SUBJECTS['otp'],
      html: renderHtml(actionType, token),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`Resend failed (${res.status}): ${detail.slice(0, 200)}`)
    return new Response(JSON.stringify({ error: 'Email delivery failed' }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
