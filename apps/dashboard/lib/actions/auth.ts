'use server'

import { createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import {
  completeDashboardSignupEmailVerification,
  consumeDashboardAuthRateLimit,
  deleteDashboardPushEndpoint,
  recordSecurityEvent,
  recordSignupLegalEvidence,
  requireDashboardSignupEmailVerification,
} from '@garsonless/db/server'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { cookies, headers } from 'next/headers'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { safeCallbackPath } from '../auth/callback-path'
import { readRequestMeta } from '../request-meta'
import { sanitizeServerDiagnostic } from '../server-log-redaction'

function publicAuthError(
  error: { code?: string; status?: number },
  operation: string,
  fallback: string,
): string {
  console.error('[dashboard-auth-failure]', { operation }, sanitizeServerDiagnostic(error))
  switch (error.code) {
    case 'invalid_credentials': return 'E-posta veya şifre hatalı.'
    case 'email_not_confirmed': return 'Devam etmek için e-posta adresini doğrula.'
    case 'user_already_exists':
    case 'email_exists': return 'Bu e-posta adresiyle zaten bir hesap var.'
    case 'weak_password': return 'Şifre güvenlik gereksinimlerini karşılamıyor.'
    case 'over_email_send_rate_limit': return 'Çok fazla e-posta isteği gönderildi. Lütfen daha sonra tekrar dene.'
    case 'same_password': return 'Yeni şifre mevcut şifreden farklı olmalı.'
    default: return fallback
  }
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(2, 'Ad soyad gerekli.').max(100),
  businessName: z.string().trim().max(200).optional(),
  termsAccepted: z.literal('on'),
  termsVersion: z.literal(LEGAL_DOCUMENT_VERSION),
})

const magicLinkSchema = z.object({
  email: z.string().email(),
})

const passwordResetRequestSchema = z.object({ email: z.string().email() })

const signupEmailCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().regex(/^\d{6}$/),
  next: z.string().optional(),
})

const resendSignupEmailCodeSchema = z.object({
  email: z.string().email(),
})

function legalIpHash(ip: string | null): string | null {
  const salt = process.env['LEGAL_ACCEPTANCE_IP_SALT']?.trim()
  return ip && salt ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null
}

async function isSameOriginRequest(): Promise<boolean> {
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin')
  if (!origin) return requestHeaders.get('sec-fetch-site') === 'same-origin'
  const expectedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  try {
    return Boolean(expectedHost) && new URL(origin).host === expectedHost
  } catch {
    return false
  }
}

type DashboardAuthRateLimitDecision = 'allowed' | 'blocked' | 'unavailable'

const AUTH_SECURITY_UNAVAILABLE =
  'Güvenlik kontrolü şu anda kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin.'

async function checkDashboardAuthAction(input: {
  action: string
  subject: string
  limit: number
  windowSeconds: number
}): Promise<DashboardAuthRateLimitDecision> {
  if (!await isSameOriginRequest()) return 'blocked'
  const { ip } = await readRequestMeta()
  const subjects = [`subject:${input.subject}`, ...(ip ? [`ip:${ip}`] : [])]
  const checks = await Promise.all(subjects.map((subject) => consumeDashboardAuthRateLimit({
    action: input.action,
    subject,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  })))
  if (checks.some((check) => !check.ok)) return 'unavailable'
  return checks.every((check) => check.ok && check.allowed) ? 'allowed' : 'blocked'
}

async function persistSignupLegalEvidence(input: {
  userId: string
  version: string
  occurredAt: string
}): Promise<void> {
  const { ip, userAgent } = await readRequestMeta()
  const result = await recordSignupLegalEvidence({
    userId: input.userId,
    documentVersion: input.version,
    occurredAt: input.occurredAt,
    ipHash: legalIpHash(ip),
    userAgent: userAgent?.slice(0, 500) ?? null,
  })
  if (!result.ok) {
    // Auth metadata carries the same immutable version/time so a later login can
    // repair this service-role evidence without deleting a valid account.
    console.error('[signup-legal-evidence-pending]', { userId: input.userId })
  }
}

async function repairSignupLegalEvidenceFromMetadata(user: {
  id: string
  user_metadata?: Record<string, unknown>
}): Promise<void> {
  const version = user.user_metadata?.['b2b_terms_version']
  const occurredAt = user.user_metadata?.['b2b_terms_accepted_at']
  if (version !== LEGAL_DOCUMENT_VERSION || typeof occurredAt !== 'string'
    || !Number.isFinite(Date.parse(occurredAt))) return
  await persistSignupLegalEvidence({ userId: user.id, version, occurredAt })
}

export async function signIn(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | never> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const rateLimit = await checkDashboardAuthAction({
    action: 'sign-in', subject: parsed.data.email, limit: 10, windowSeconds: 900,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' }
  }

  const supabase = await createDashboardServerClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: publicAuthError(error, 'auth.sign-in', 'Giriş yapılamadı. Lütfen tekrar deneyin.') }

  // Best-effort security audit (never blocks the login).
  if (data.user) {
    const { ip, userAgent } = await readRequestMeta()
    await recordSecurityEvent({ userId: data.user.id, eventType: 'login', ip, userAgent })
    await repairSignupLegalEvidenceFromMetadata(data.user)
  }

  redirect(safeNext(formData.get('next')))
}

/** Only allow same-origin relative redirects (e.g. the accept-invite return path). */
function safeNext(value: FormDataEntryValue | null, fallback = '/dashboard'): string {
  return safeCallbackPath(typeof value === 'string' ? value : null, fallback)
}

export async function signUp(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string }> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
    businessName: formData.get('biz') || undefined,
    termsAccepted: formData.get('termsAccepted'),
    termsVersion: formData.get('termsVersion'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const rateLimit = await checkDashboardAuthAction({
    action: 'sign-up', subject: parsed.data.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla hesap oluşturma denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' }
  }

  // Onboarding belongs to account creation. Login and other auth entrypoints
  // keep /dashboard as their default so existing accounts never start here.
  const next = safeNext(formData.get('next'), '/dashboard/onboarding')
  const callbackUrl = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/callback?next=${encodeURIComponent(next)}`
  const acceptedAt = new Date().toISOString()

  const supabase = await createDashboardServerClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        full_name: parsed.data.name || undefined,
        business_name: parsed.data.businessName || undefined,
        b2b_terms_version: parsed.data.termsVersion,
        b2b_terms_accepted_at: acceptedAt,
        privacy_notice_version: parsed.data.termsVersion,
      },
    },
  })
  if (error) return { error: publicAuthError(error, 'auth.sign-up', 'Hesap oluşturulamadı. Lütfen tekrar deneyin.') }
  if (!data.user || data.user.identities?.length === 0) {
    await supabase.auth.signOut({ scope: 'local' })
    return { error: 'Bu e-posta adresiyle zaten bir hesap var.' }
  }

  await persistSignupLegalEvidence({
    userId: data.user.id,
    version: parsed.data.termsVersion,
    occurredAt: acceptedAt,
  })
  const pending = await requireDashboardSignupEmailVerification(data.user.id)
  if (!pending.ok) {
    await supabase.auth.signOut({ scope: 'local' })
    return { error: 'E-posta doğrulaması başlatılamadı. Lütfen tekrar deneyin.' }
  }

  // The product-level OTP gate is independent from the Supabase project's
  // `enable_confirmations` setting. This prevents an auto-confirmed provider
  // configuration from opening onboarding before inbox possession is proven.
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl },
  })
  await supabase.auth.signOut({ scope: 'local' })
  if (otpError) {
    return { error: publicAuthError(otpError, 'auth.signup-otp', 'Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.') }
  }

  const verifySearch = new URLSearchParams({ email: parsed.data.email, next })
  redirect(`/auth/verify-email?${verifySearch.toString()}`)
}

export async function verifySignupEmailCode(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string }> {
  const parsed = signupEmailCodeSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
    next: formData.get('next') || undefined,
  })
  if (!parsed.success) return { error: 'E-postana gönderilen 6 haneli kodu gir.' }

  const rateLimit = await checkDashboardAuthAction({
    action: 'verify-signup-email', subject: parsed.data.email, limit: 8, windowSeconds: 900,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla doğrulama denemesi yapıldı. Lütfen daha sonra tekrar dene.' }
  }

  const supabase = await createDashboardServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'email',
  })
  if (error || !data.user) return { error: 'Doğrulama kodu geçersiz veya süresi dolmuş.' }

  const completed = await completeDashboardSignupEmailVerification(data.user.id)
  if (!completed.ok) {
    await supabase.auth.signOut({ scope: 'local' })
    return { error: 'E-posta doğrulaması tamamlanamadı. Lütfen tekrar dene.' }
  }
  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    await supabase.auth.signOut({ scope: 'local' })
    return { error: 'Doğrulama tamamlandı ancak güvenli oturum açılamadı. Lütfen giriş yap.' }
  }

  redirect(safeNext(parsed.data.next ?? null, '/dashboard/onboarding'))
}

export async function resendSignupEmailCode(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = resendSignupEmailCodeSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: 'Geçerli bir e-posta adresi gerekli.' }

  const rateLimit = await checkDashboardAuthAction({
    action: 'resend-signup-email', subject: parsed.data.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla kod isteği gönderildi. Lütfen daha sonra tekrar dene.' }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  })
  return error
    ? { error: publicAuthError(error, 'auth.resend-signup-otp', 'Kod yeniden gönderilemedi.') }
    : { success: true }
}

const logoutEndpointSchema = z.string().url().max(2_048).refine((value) => value.startsWith('https://'))

/** Ends only this browser session and retires only its matching push endpoint. */
export async function signOut(endpoint: unknown): Promise<{ success: true } | { error: string }> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) {
    return { error: publicAuthError(error, 'auth.sign-out', 'Çıkış yapılamadı. Lütfen tekrar deneyin.') }
  }

  const parsedEndpoint = logoutEndpointSchema.safeParse(endpoint)
  if (user && parsedEndpoint.success) {
    const deleted = await deleteDashboardPushEndpoint({
      userId: user.id,
      endpointHash: createHash('sha256').update(parsedEndpoint.data).digest('hex'),
    })
    if (!deleted.ok) {
      // The local browser subscription is also retired client-side. A stale
      // server row is safe to clean up later through the provider's 404/410 path.
      console.warn('[dashboard-auth-push-cleanup-failure]', { operation: 'auth.sign-out' })
    }
  }
  return { success: true }
}

export async function sendMagicLink(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid email' }
  }

  const rateLimit = await checkDashboardAuthAction({
    action: 'magic-link', subject: parsed.data.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla bağlantı isteği gönderildi. Lütfen daha sonra tekrar deneyin.' }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${process.env['NEXT_PUBLIC_APP_URL']}/auth/callback` },
  })
  if (error) return { error: publicAuthError(error, 'auth.magic-link', 'Giriş bağlantısı gönderilemedi. Lütfen tekrar deneyin.') }

  return { success: true }
}

export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: 'Geçerli bir e-posta adresi girin.' }

  const rateLimit = await checkDashboardAuthAction({
    action: 'password-reset', subject: parsed.data.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit === 'unavailable') return { error: AUTH_SECURITY_UNAVAILABLE }
  if (rateLimit === 'blocked') {
    // Enumeration-safe: throttled known and unknown addresses receive the same response.
    return { success: true }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: passwordRecoveryRedirect(),
  })
  if (error) return { error: publicAuthError(error, 'auth.password-reset-request', 'Şifre yenileme bağlantısı gönderilemedi.') }
  // Account enumeration is intentionally avoided; the same success response is
  // returned whether or not the address exists.
  return { success: true }
}

const updateProfileSchema = z.object({
  full_name: z.string().max(100).optional(),
  display_name: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
})

export async function updateUserProfile(
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = updateProfileSchema.safeParse({
    full_name: formData.get('full_name') ?? undefined,
    display_name: formData.get('display_name') ?? undefined,
    phone: formData.get('phone') ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.updateUser({ data: parsed.data })
  if (error) return { error: publicAuthError(error, 'auth.profile-update', 'Profil güncellenemedi. Lütfen tekrar deneyin.') }

  return { success: true }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalı'),
})

const freshPasswordSchema = z.object({ currentPassword: z.string().min(1).max(256) }).strict()
const emailChangeSchema = freshPasswordSchema.extend({ email: z.string().trim().email().max(320) }).strict()
const totpCodeSchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
}).strict()

async function requireFreshUserPassword(currentPassword: string) {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false as const, error: 'Oturum bulunamadı.' }
  const rateLimit = await checkDashboardAuthAction({
    action: 'fresh-reauth', subject: user.id, limit: 5, windowSeconds: 900,
  })
  if (rateLimit !== 'allowed') {
    return { ok: false as const, error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla doğrulama denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' }
  }
  const [factors, assurance] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  const hasVerifiedTotp = !factors.error && factors.data.totp.some((factor) => factor.status === 'verified')
  if (hasVerifiedTotp && (assurance.error || assurance.data.currentLevel !== 'aal2')) {
    return { ok: false as const, error: 'Bu işlem için önce Authenticator koduyla AAL2 doğrulaması yapın.' }
  }
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  return error
    ? { ok: false as const, error: 'Hesap şifresi doğrulanamadı.' }
    : { ok: true as const, supabase, user }
}

export async function signOutOtherSessions(
  input: { currentPassword: string },
): Promise<{ error: string } | { success: true }> {
  const parsed = freshPasswordSchema.safeParse(input)
  if (!parsed.success) return { error: 'Bu işlem için hesap şifresi gerekli.' }
  const fresh = await requireFreshUserPassword(parsed.data.currentPassword)
  if (!fresh.ok) return { error: fresh.error }
  const { error } = await fresh.supabase.auth.signOut({ scope: 'others' })
  return error
    ? { error: publicAuthError(error, 'auth.sign-out-others', 'Diğer oturumlar kapatılamadı.') }
    : { success: true }
}

export async function requestEmailChange(
  input: { currentPassword: string; email: string },
): Promise<{ error: string } | { success: true }> {
  const parsed = emailChangeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Geçerli yeni e-posta ve hesap şifresi gerekli.' }
  const fresh = await requireFreshUserPassword(parsed.data.currentPassword)
  if (!fresh.ok) return { error: fresh.error }
  const { error } = await fresh.supabase.auth.updateUser({ email: parsed.data.email })
  return error
    ? { error: publicAuthError(error, 'auth.email-change', 'E-posta değişikliği başlatılamadı.') }
    : { success: true }
}

export async function getDashboardMfaStatus(): Promise<
  { error: string } | { factors: Array<{ id: string; friendlyName: string | null; status: string }>; aal: string | null }
> {
  const supabase = await createDashboardServerClient()
  const [{ data: factorData, error: factorError }, { data: aalData, error: aalError }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  if (factorError || aalError) return { error: 'İki faktörlü doğrulama durumu yüklenemedi.' }
  return {
    factors: factorData.totp.map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? null, status: factor.status })),
    aal: aalData.currentLevel,
  }
}

export async function startTotpEnrollment(): Promise<
  { error: string } | { factorId: string; qrCode: string; secret: string }
> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum bulunamadı.' }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Masabu Dashboard' })
  return error
    ? { error: publicAuthError(error, 'auth.mfa.enroll', 'Authenticator kurulumu başlatılamadı.') }
    : { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotpEnrollment(
  input: { factorId: string; code: string },
): Promise<{ error: string } | { success: true }> {
  const parsed = totpCodeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Altı haneli doğrulama kodunu girin.' }
  const supabase = await createDashboardServerClient()
  const challenge = await supabase.auth.mfa.challenge({ factorId: parsed.data.factorId })
  if (challenge.error) return { error: 'Doğrulama oturumu başlatılamadı.' }
  const verified = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: challenge.data.id,
    code: parsed.data.code,
  })
  return verified.error ? { error: 'Authenticator kodu doğrulanamadı.' } : { success: true }
}

export async function removeTotpFactor(
  input: { factorId: string; currentPassword: string },
): Promise<{ error: string } | { success: true }> {
  const parsed = freshPasswordSchema.extend({ factorId: z.string().uuid() }).strict().safeParse(input)
  if (!parsed.success) return { error: 'Hesap şifresi gerekli.' }
  const fresh = await requireFreshUserPassword(parsed.data.currentPassword)
  if (!fresh.ok) return { error: fresh.error }
  const { error } = await fresh.supabase.auth.mfa.unenroll({ factorId: parsed.data.factorId })
  return error ? { error: 'Authenticator kaldırılamadı.' } : { success: true }
}

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalı'),
})

const PASSWORD_RECOVERY_COOKIE = 'dashboard_password_recovery'

function passwordRecoveryRedirect(): string {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  return `${base}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`
}

/** Sends a recovery link for passwordless email/OAuth users and for forgotten passwords. */
export async function sendPasswordResetEmail(): Promise<{ error: string } | { success: true }> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'E-posta hesabı bulunamadı' }

  const rateLimit = await checkDashboardAuthAction({
    action: 'password-reset', subject: user.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit === 'unavailable') return { error: AUTH_SECURITY_UNAVAILABLE }
  if (rateLimit === 'blocked') {
    return { success: true }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: passwordRecoveryRedirect(),
  })
  if (error) return { error: publicAuthError(error, 'auth.password-reset-email', 'Şifre yenileme e-postası gönderilemedi.') }
  return { success: true }
}

/**
 * Only a session that arrived through the password-recovery callback may set a
 * password without knowing the old one. A regular authenticated session must
 * continue through changePassword and re-authenticate first.
 */
export async function setPasswordFromRecovery(
  input: { newPassword: string },
): Promise<{ error: string } | { success: true }> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz giriş' }

  const cookieStore = await cookies()
  if (!cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value) {
    return { error: 'Bu bağlantının süresi dolmuş. Yeni bir şifre belirleme e-postası iste.' }
  }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum bulunamadı' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) return { error: publicAuthError(error, 'auth.password-recovery-update', 'Şifre güncellenemedi. Yeni bağlantı isteyin.') }

  cookieStore.delete(PASSWORD_RECOVERY_COOKIE)
  const { ip, userAgent } = await readRequestMeta()
  await recordSecurityEvent({ userId: user.id, eventType: 'password_change', ip, userAgent })
  return { success: true }
}

export async function changePassword(
  input: { currentPassword: string; newPassword: string },
): Promise<{ error: string } | { success: true }> {
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz giriş' }
  }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Oturum bulunamadı' }

  // Supabase updateUser does NOT require the old password, so verify it
  // explicitly by re-authenticating before allowing the change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  })
  if (reauthError) return { error: 'Mevcut şifre hatalı' }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (updateError) return { error: publicAuthError(updateError, 'auth.password-change', 'Şifre güncellenemedi. Lütfen tekrar deneyin.') }

  // Best-effort security audit (never blocks the change).
  const { ip, userAgent } = await readRequestMeta()
  await recordSecurityEvent({ userId: user.id, eventType: 'password_change', ip, userAgent })

  return { success: true }
}
