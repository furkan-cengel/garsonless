// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Node rejects .ts imports; Deno requires them, so expect-error is not portable.
// @ts-ignore Deno requires explicit .ts extensions; this pure module is also used by Node.
import { renderBrandEmail, emailParagraph, emailCode, emailAction, emailDetails, emailHtmlToText } from '../_shared/email-brand.ts'

export interface AuthEmailTemplateInput {
  actionType: string
  email?: string
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
  signup: 'E-posta adresinizi doğrulayın',
  magiclink: 'Giriş bağlantınız hazır',
  recovery: 'Yeni şifrenizi belirleyin',
  email_change: 'E-posta değişikliğini onaylayın',
  otp: 'Girişinizi tamamlayın',
  invite: 'Davetiniz hazır',
  reauthentication: 'İşlemi doğrulayın',
}

const BUTTON_LABELS: Record<string, string> = {
  signup: 'E-postamı doğrula',
  magiclink: 'Güvenli giriş yap',
  recovery: 'Şifremi sıfırla',
  email_change: 'Değişikliği onayla',
  invite: 'Daveti kabul et',
}

export function buildVerificationUrl(input: AuthEmailTemplateInput): string | null {
  if (!LINK_ACTION_TYPES.has(input.actionType) || !input.tokenHash) return null

  try {
    const base = new URL(input.supabaseUrl)

    // Only dashboard's explicit confirmation route uses the interactive flow.
    // Other products, invitations and email changes retain their existing links.
    const redirect = input.redirectTo ? new URL(input.redirectTo) : null
    const dashboardOrigins = ['https://app.masabu.co', 'https://sandbox.masabu.co', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3002', 'http://127.0.0.1:3002']
    if (redirect && dashboardOrigins.includes(redirect.origin) && redirect.pathname === '/auth/confirm'
      && ['signup', 'magiclink', 'recovery'].includes(input.actionType)) {
      redirect.searchParams.set('token_hash', input.tokenHash)
      redirect.searchParams.set('flow', input.actionType)
      return redirect.toString()
    }
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

function isDashboardLinkFlow(redirectTo: string): boolean {
  try {
    const target = new URL(redirectTo)
    return ['https://app.masabu.co', 'https://sandbox.masabu.co', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3002', 'http://127.0.0.1:3002'].includes(target.origin)
      && ['/auth/confirm', '/auth/callback'].includes(target.pathname)
  } catch { return false }
}

const DESCRIPTIONS: Record<string, string> = {
  signup: 'masabu’ya hoş geldiniz. Hesabınızı kullanmaya başlamak için aşağıdaki kodu doğrulama ekranına girin.',
  magiclink: 'masabu’ya güvenle giriş yapmak için aşağıdaki bağlantıyı kullanın.',
  recovery: 'Şifrenizi yenilemek için bir istek aldık. Aşağıdaki bağlantıyla yeni şifrenizi oluşturabilirsiniz.',
  email_change: 'Hesabınızın e-posta adresini değiştirmek için aşağıdaki bağlantıyla bu işlemi onaylayın.',
  invite: 'masabu davetiniz hazır. Hesabınıza devam etmek için daveti kabul edin.',
  reauthentication: 'Hesabınızın güvenliği için aşağıdaki kodu işlemi başlattığınız doğrulama ekranına girin.',
  otp: 'Aşağıdaki tek kullanımlık kodu uygulamadaki doğrulama alanına girin.',
}

export function renderAuthEmailHtml(input: AuthEmailTemplateInput): string {
  // Menu signInWithOtp sends no redirect override: those signup/magiclink emails
  // must remain code based. Dashboard login, recovery and account changes use links.
  const dashboardFlow = isDashboardLinkFlow(input.redirectTo)
  const linkOnly = ['recovery', 'invite', 'email_change'].includes(input.actionType)
    || (input.actionType === 'magiclink' && dashboardFlow)
  const showCode = !linkOnly
  const showLink = linkOnly || (input.actionType === 'signup' && dashboardFlow)
  const verificationUrl = showLink ? buildVerificationUrl(input) : null
  if (linkOnly && !verificationUrl) throw new Error('Auth email verification URL unavailable')
  const heading = input.actionType === 'magiclink' && showCode ? 'Giriş kodunuz' : HEADINGS[input.actionType] ?? 'Doğrulama kodunuz'
  const description = input.actionType === 'magiclink' && showCode
    ? 'masabu’ya giriş yapmak için aşağıdaki tek kullanımlık kodu giriş ekranına girin.'
    : DESCRIPTIONS[input.actionType] ?? DESCRIPTIONS['otp']!
  return renderBrandEmail({
    headerLabel: input.actionType === 'magiclink' && showCode ? 'Müşteri girişi' : 'Hesap güvenliği',
    category: ({ signup: 'E-posta doğrulama', magiclink: showCode ? 'Müşteri girişi' : 'Giriş bağlantısı', recovery: 'Şifre sıfırlama', email_change: 'Adres değişikliği', invite: 'Hesap daveti', otp: 'Doğrulama kodu', reauthentication: 'İşlem doğrulama' } as Record<string, string>)[input.actionType] ?? 'Doğrulama kodu',
    tone: input.actionType === 'email_change' ? 'attention' : 'brand',
    title: heading,
    preheader: description,
    bodyHtml: emailParagraph(description)
      + (showCode ? emailCode(input.token) : '')
      + (showCode && verificationUrl ? emailParagraph('Dilerseniz aşağıdaki bağlantıyla da e-posta adresinizi doğrulayabilirsiniz.') : '')
      + (verificationUrl ? emailAction(BUTTON_LABELS[input.actionType] ?? 'Devam et', verificationUrl, { fallback: input.actionType === 'signup' }) : '')
      + (input.email ? emailDetails([['Hesap', input.email]]) : '')
      + emailParagraph(showCode
        ? 'Bu kod tek kullanımlıktır. Kodunuzun süresi dolarsa doğrulama ekranından yeni bir kod isteyebilirsiniz. Kodunuzu kimseyle paylaşmayın.'
        : 'Bu bağlantı tek kullanımlıktır. Süresi dolarsa işlemi başlattığınız ekrandan yeni bir bağlantı isteyebilirsiniz.'),
    footer: showCode
      ? 'Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz. masabu ekibi sizden doğrulama kodunuzu istemez.'
      : 'Bu isteği siz yapmadıysanız bağlantıya tıklamadan bu e-postayı yok sayabilirsiniz.',
  })
}

export function renderAuthEmailText(input: AuthEmailTemplateInput): string {
  return emailHtmlToText(renderAuthEmailHtml(input))
}

export function authEmailSubject(actionType: string, redirectTo?: string): string {
  const subjects: Record<string, string> = {
    signup: 'masabu · E-posta adresinizi doğrulayın',
    magiclink: 'masabu · Giriş kodunuz',
    recovery: 'masabu · Şifre yenileme bağlantınız',
    email_change: 'masabu · E-posta değişikliğini onaylayın',
    otp: 'masabu · Doğrulama kodunuz',
    invite: 'masabu · Davetiniz hazır',
    reauthentication: 'masabu · İşleminizi doğrulayın',
  }
  if (actionType === 'magiclink' && isDashboardLinkFlow(redirectTo ?? '')) return 'masabu · Giriş bağlantınız'
  return subjects[actionType] ?? subjects['otp']!
}
