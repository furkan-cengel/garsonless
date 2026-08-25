export interface AuthEmailTemplateInput {
  actionType: string
  token: string
  tokenHash: string
  redirectTo: string
  supabaseUrl: string
}

const LINK_ACTION_TYPES = new Set([
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
])

const HEADINGS: Record<string, string> = {
  signup: 'E-posta adresini doğrula',
  magiclink: 'Giriş bağlantın hazır',
  recovery: 'Şifreni sıfırla',
  email_change: 'E-posta değişikliğini onayla',
  otp: 'Doğrulama kodun',
  invite: 'Davet edildin',
  reauthentication: 'İşlemi doğrula',
}

const BUTTON_LABELS: Record<string, string> = {
  signup: 'E-postamı doğrula',
  magiclink: 'Güvenli giriş yap',
  recovery: 'Şifremi sıfırla',
  email_change: 'E-posta değişikliğini onayla',
  invite: 'Daveti kabul et',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!)
}

export function buildVerificationUrl(input: AuthEmailTemplateInput): string | null {
  if (!LINK_ACTION_TYPES.has(input.actionType) || !input.tokenHash) return null

  try {
    const base = new URL(input.supabaseUrl)
    if (base.protocol !== 'https:') return null

    const url = new URL('/auth/v1/verify', base)
    url.searchParams.set('token', input.tokenHash)
    url.searchParams.set('type', input.actionType)
    if (input.redirectTo) url.searchParams.set('redirect_to', input.redirectTo)
    return url.toString()
  } catch {
    return null
  }
}

export function renderAuthEmailHtml(input: AuthEmailTemplateInput): string {
  const heading = HEADINGS[input.actionType] ?? 'Doğrulama kodun'
  const verificationUrl = buildVerificationUrl(input)
  const buttonLabel = BUTTON_LABELS[input.actionType] ?? 'Devam et'
  const button = verificationUrl
    ? `<a href="${escapeHtml(verificationUrl)}" style="display:inline-block;background:#1f7a50;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 24px;font-size:14px;font-weight:700;">${escapeHtml(buttonLabel)}</a>
        <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:14px 0 20px;">Düğme çalışmazsa aşağıdaki tek kullanımlık kodu kullanabilirsin.</p>`
    : '<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 20px;">Aşağıdaki tek kullanımlık kodu uygulamadaki doğrulama alanına gir.</p>'

  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:440px;margin:0 auto;padding:40px 20px;">
      <div style="background:#ffffff;border-radius:12px;border:1px solid #e8e8e4;padding:36px 32px;text-align:center;">
        <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#1a1a1a;margin-bottom:6px;">
          masa<span style="color:#2e7d52;">bu.</span>
        </div>
        <h1 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:22px 0 18px;">${escapeHtml(heading)}</h1>
        ${button}
        <div style="display:inline-block;background:#f0f7f3;border:1px solid #cde5d7;border-radius:10px;padding:16px 28px;">
          <span style="font-size:34px;font-weight:700;letter-spacing:0.28em;color:#1a1a1a;font-family:ui-monospace,'SF Mono',Menlo,monospace;">${escapeHtml(input.token)}</span>
        </div>
        <p style="font-size:12.5px;color:#9ca3af;line-height:1.6;margin:24px 0 0;">
          Bu bağlantı ve kod kısa süre boyunca geçerlidir.<br />
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
