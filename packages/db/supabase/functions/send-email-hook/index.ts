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
import { recordDashboardRecoveryEmail } from './recovery-intent.ts'
import { authEmailSubject, renderAuthEmailHtml } from './email-template.ts'

interface EmailHookPayload {
  user: { id: string; email: string; new_email?: string }
  email_data: {
    token: string
    token_hash: string
    token_new?: string
    token_hash_new?: string
    redirect_to: string
    email_action_type: string
    site_url: string
  }
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
  const tokenHash = payload.email_data?.token_hash
  const actionType = payload.email_data?.email_action_type ?? 'otp'
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!email || !token || !tokenHash || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Missing email or token' }), { status: 400 })
  }

  try {
    await recordDashboardRecoveryEmail({ actionType, redirectTo: payload.email_data.redirect_to, userId: payload.user.id, email, token, tokenHash, supabaseUrl, serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' })
  } catch {
    return new Response(JSON.stringify({ error: 'Recovery verification unavailable' }), { status: 500 })
  }

  // 2) Resend ile gönder
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'masabu <noreply@masabu.co>',
      to: [email],
      subject: authEmailSubject(actionType, payload.email_data.redirect_to),
      html: renderAuthEmailHtml({
        actionType,
        token,
        tokenHash,
        redirectTo: payload.email_data.redirect_to,
        supabaseUrl,
      }),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`Resend failed (${res.status}): ${detail.slice(0, 200)}`)
    return new Response(JSON.stringify({ error: 'Email delivery failed' }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
