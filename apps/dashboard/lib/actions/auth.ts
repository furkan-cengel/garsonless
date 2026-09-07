'use server'

import { createHash } from 'node:crypto'
import { recordEmailVerifiedDeviceSession, deviceSecurityEnabled, deviceContext, checkDeviceEvidence } from '../auth/device-session'
import { revokeDashboardDevices } from '@garsonless/db/server'
import { redirect } from 'next/navigation'
import {
  consumeDashboardAuthRateLimit,
  findDashboardRecoveryEmail,
  deleteDashboardPushEndpoint,
  recordSecurityEvent,
  recordSignupLegalEvidence,
  requireDashboardSignupEmailVerification,
} from '@garsonless/db/server'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { safeCallbackPath } from '../auth/callback-path'
import { readRequestMeta } from '../request-meta'
import { newPasswordSchema, emailSchema, emailCodeSchema } from '../auth/password-policy'
import type { AuthActionState } from '../auth/entry-context'
import { completeVerifiedSession, saveFlowGrant, validatedFlowSession, deleteFlowGrant } from '../auth/flow-session'
import { sessionIdFromToken } from '../auth/flow-grant'
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
  email: emailSchema,
  password: z.string().min(1, 'Şifreni gir.'),
})

const signUpSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  name: z.string().trim().min(2, 'Ad soyad gerekli.').max(100, 'Ad soyad en fazla 100 karakter olabilir.'),
  businessName: z.string().trim().max(200).optional(),
  termsAccepted: z.literal('on', { errorMap: () => ({ message: 'Devam etmek için hizmet sözleşmesini kabul et.' }) }),
  termsVersion: z.literal(LEGAL_DOCUMENT_VERSION, { errorMap: () => ({ message: 'Sözleşme güncellendi. Sayfayı yenileyip tekrar dene.' }) }),
})

const magicLinkSchema = z.object({
  email: emailSchema,
})

const passwordResetRequestSchema = z.object({ email: emailSchema })

const signupEmailCodeSchema = z.object({
  email: emailSchema,
  code: emailCodeSchema,
  next: z.string().optional(),
})

const resendSignupEmailCodeSchema = z.object({
  email: emailSchema,
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
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return validationFailure(parsed.error)
  }

  const rateLimit = await checkDashboardAuthAction({
    action: 'sign-in', subject: parsed.data.email, limit: 10, windowSeconds: 900,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' }
  }

  const supabase = await createDashboardServerClient({ authOnly: true })
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: publicAuthError(error, 'auth.sign-in', 'Giriş yapılamadı. Lütfen tekrar deneyin.') }

  // Best-effort security audit (never blocks the login).
  if (data.user) {
    const { ip, userAgent } = await readRequestMeta()
    await recordSecurityEvent({ userId: data.user.id, eventType: 'login', ip, userAgent })
    await repairSignupLegalEvidenceFromMetadata(data.user)
  }

  const target = safeNext(formData.get('next'))
  if (deviceSecurityEnabled()) {
    const context = await deviceContext(supabase)
    if (!context || await checkDeviceEvidence(context)) redirect('/auth/device-verification?' + new URLSearchParams({ next: target }).toString())
  }
  redirect(target)
}

/** Only allow same-origin relative redirects (e.g. the accept-invite return path). */
function safeNext(value: FormDataEntryValue | null, fallback = '/dashboard'): string {
  return safeCallbackPath(typeof value === 'string' ? value : null, fallback)
}

export async function signUp(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') ?? '',
    businessName: formData.get('biz') || undefined,
    termsAccepted: formData.get('termsAccepted'),
    termsVersion: formData.get('termsVersion'),
  })
  if (!parsed.success) {
    return validationFailure(parsed.error)
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
  const callbackUrl = authConfirmationRedirect('signup', next)
  const acceptedAt = new Date().toISOString()

  const supabase = await createDashboardServerClient({ authOnly: true })
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
    return { error: 'Bu adresle kayıt tamamlanamıyorsa giriş yapabilir veya şifreni yenileyebilirsin.', code: 'INVALID' }
  }

  await persistSignupLegalEvidence({
    userId: data.user.id,
    version: parsed.data.termsVersion,
    occurredAt: acceptedAt,
  })
  // Native confirmation sends exactly one message. Fail closed if the
  // environment accidentally starts auto-confirming registrations.
  if (data.session) {
    await requireDashboardSignupEmailVerification(data.user.id)
    await supabase.auth.signOut({ scope: 'local' })
    return { error: 'E-posta doğrulama hizmeti şu anda kullanılamıyor.', code: 'UNAVAILABLE' }
  }
  await saveFlowGrant('sent', parsed.data.email, 'signup')

  const verifySearch = new URLSearchParams({ email: parsed.data.email, next })
  redirect(`/auth/verify-email?${verifySearch.toString()}`)
}

export async function verifySignupEmailCode(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupEmailCodeSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
    next: formData.get('next') || undefined,
  })
  if (!parsed.success) return { error: 'E-postana gönderilen 6 haneli kodu gir.', fieldErrors: { code: '6 haneli doğrulama kodunu gir.' }, code: 'INVALID' }

  const rateLimit = await checkDashboardAuthAction({
    action: 'verify-signup-email', subject: parsed.data.email, limit: 8, windowSeconds: 900,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla doğrulama denemesi yapıldı. Lütfen daha sonra tekrar dene.' }
  }

  const supabase = await createDashboardServerClient({ authOnly: true })
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'email',
  })
  if (error || !data.user) return { error: 'Doğrulama kodu geçersiz veya süresi dolmuş.', code: 'EXPIRED', fieldErrors: { code: 'Kodu kontrol et veya yeni kod iste.' } }

  if (!data.session || !await completeVerifiedSession(supabase, data.user, data.session.access_token)) {
    return { error: 'E-postan doğrulandı. Oturumunu tamamlamak için tekrar dene.', code: 'COMPLETE_PENDING' }
  }

  await recordEmailVerifiedDeviceSession(supabase)
  redirect(safeNext(parsed.data.next ?? null, '/dashboard/onboarding'))
}

export async function resendSignupEmailCode(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resendSignupEmailCodeSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: 'Geçerli bir e-posta adresi gerekli.' }

  const rateLimit = await checkDashboardAuthAction({
    action: 'resend-signup-email', subject: parsed.data.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla kod isteği gönderildi. Lütfen daha sonra tekrar dene.', code: rateLimit === 'unavailable' ? 'UNAVAILABLE' : 'RATE_LIMITED', retryAfter: rateLimit === 'blocked' ? 3600 : undefined }
  }

  const supabase = await createDashboardServerClient({ authOnly: true })
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: authConfirmationRedirect('signup', safeNext(formData.get('next'), '/dashboard/onboarding')) },
  })
  if (error) return emailSendFailure(error)
  await saveFlowGrant('sent', parsed.data.email, 'signup')
  return { success: true, retryAfter: 60 }

}

const logoutEndpointSchema = z.string().url().max(2_048).refine((value) => value.startsWith('https://'))

/** Ends only this browser session and retires only its matching push endpoint. */
export async function signOut(endpoint: unknown): Promise<{ success: true } | { error: string }> {
  const supabase = await createDashboardServerClient({ authOnly: true })
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
): Promise<AuthActionState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return validationFailure(parsed.error)
  }

  const rateLimit = await checkDashboardAuthAction({
    action: 'magic-link', subject: parsed.data.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit !== 'allowed') {
    return { error: rateLimit === 'unavailable'
      ? AUTH_SECURITY_UNAVAILABLE
      : 'Çok fazla bağlantı isteği gönderildi. Lütfen daha sonra tekrar deneyin.' }
  }

  const supabase = await createDashboardServerClient({ authOnly: true })
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: authConfirmationRedirect('magiclink', safeNext(formData.get('next'))) },
  })
  if (error && !['otp_disabled', 'user_not_found', 'signup_disabled'].includes(error.code ?? '')) return emailSendFailure(error)
  return { success: true, retryAfter: 60 }
}

export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: 'Geçerli bir e-posta adresi girin.' }

  const rateLimit = await checkDashboardAuthAction({
    action: 'password-reset', subject: parsed.data.email, limit: 3, windowSeconds: 3600,
  })
  if (rateLimit === 'unavailable') return { error: AUTH_SECURITY_UNAVAILABLE }
  if (rateLimit === 'blocked') {
    // Enumeration-safe: throttled known and unknown addresses receive the same response.
    return { success: true, retryAfter: 60 }
  }

  const supabase = await createDashboardServerClient({ authOnly: true })
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: passwordRecoveryRedirect(safeNext(formData.get('next'))),
  })
  if (error) return emailSendFailure(error)
  // Account enumeration is intentionally avoided; the same success response is
  // returned whether or not the address exists.
  return { success: true, retryAfter: 60 }
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
    return validationFailure(parsed.error)
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.updateUser({ data: parsed.data })
  if (error) return { error: publicAuthError(error, 'auth.profile-update', 'Profil güncellenemedi. Lütfen tekrar deneyin.') }

  return { success: true }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
  newPassword: newPasswordSchema,
})

const freshPasswordSchema = z.object({ currentPassword: z.string().min(1).max(256) }).strict()
const emailChangeSchema = freshPasswordSchema.extend({ email: z.string().trim().email().max(320) }).strict()
const totpCodeSchema = z.object({
  factorId: z.string().uuid(),
  code: emailCodeSchema,
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
  newPassword: newPasswordSchema,
})


function passwordRecoveryRedirect(next = '/dashboard'): string {
  return authConfirmationRedirect('recovery', next)
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
): Promise<{ error: string; fieldErrors?: Record<string, string> } | { success: true }> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  if (!await isSameOriginRequest()) return { error: 'İstek doğrulanamadı.' }
  const supabase = await createDashboardServerClient({ authOnly: true })
  const verified = await validatedFlowSession(supabase, 'recovery')
  if (!verified) return { error: 'Bu bağlantının süresi dolmuş. Yeni bir şifre yenileme e-postası iste.' }
  const { user, grant } = verified
  const consumed = await consumeDashboardAuthRateLimit({ action: 'recovery-consume', subject: grant.nonce, limit: 1, windowSeconds: 3600 })
  if (!consumed.ok || !consumed.allowed) return { error: 'Bu bağlantı kullanılmış. Yeni bir şifre yenileme e-postası iste.' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) return { error: publicAuthError(error, 'auth.password-recovery-update', 'Şifre güncellenemedi. Yeni bağlantı isteyin.') }

  if (deviceSecurityEnabled()) await revokeDashboardDevices(user.id)
  await deleteFlowGrant('recovery')
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
  if (signOutError) return { error: 'Şifren güncellendi ancak oturumlar kapatılamadı. Güvenlik ayarlarından oturumlarını sonlandır.' }
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

  if (deviceSecurityEnabled()) await revokeDashboardDevices(user.id)
  // Best-effort security audit (never blocks the change).
  const { ip, userAgent } = await readRequestMeta()
  await recordSecurityEvent({ userId: user.id, eventType: 'password_change', ip, userAgent })

  return { success: true }
}

function validationFailure(error: z.ZodError): AuthActionState & { error: string } {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '')
    if (!fieldErrors[field]) fieldErrors[field] = issue.message
  }
  return { error: 'İşaretli alanları kontrol et.', fieldErrors, code: 'INVALID' }
}

function authConfirmationRedirect(flow: 'signup' | 'magiclink' | 'recovery', next: string): string {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  const query = new URLSearchParams({ flow, next: safeCallbackPath(next) })
  return base + '/auth/confirm?' + query.toString()
}

function emailSendFailure(error: { code?: string; status?: number }): AuthActionState {
  if (error.status === 429 || error.code?.includes('rate_limit')) return { error: 'Gönderim sınırına ulaşıldı. Biraz bekleyip tekrar dene.', code: 'RATE_LIMITED', retryAfter: 60 }
  return { error: publicAuthError(error, 'auth.email-send', 'E-posta şu anda gönderilemedi. Tekrar deneyebilirsin.'), code: 'UNAVAILABLE' }
}

export async function verifyEmailToken(_prev: unknown, formData: FormData): Promise<AuthActionState> {
  const flow = formData.get('flow')
  if (flow !== 'signup' && flow !== 'magiclink' && flow !== 'recovery') return { error: 'Bağlantı geçersiz.', code: 'INVALID' }
  const tokenHash = formData.get('token_hash')
  const email = emailSchema.safeParse(formData.get('email'))
  const code = formData.get('code')
  const hasHash = typeof tokenHash === 'string' && /^[a-zA-Z0-9_-]{20,256}$/.test(tokenHash)
  if (!hasHash && (!email.success || !emailCodeSchema.safeParse(code).success)) return { error: '6 haneli kodu gir.', fieldErrors: { code: '6 haneli kod gerekli.' }, code: 'INVALID' }
  const subject = hasHash ? createHash('sha256').update(tokenHash).digest('hex') : email.success ? email.data : ''
  const rate = await checkDashboardAuthAction({ action: 'verify-email-token', subject, limit: 8, windowSeconds: 900 })
  if (rate !== 'allowed') return { error: 'Doğrulama şu anda yapılamıyor. Daha sonra tekrar dene.', code: rate === 'blocked' ? 'RATE_LIMITED' : 'UNAVAILABLE' }
  const supabase = await createDashboardServerClient({ authOnly: true })
  let recoveryIntent: {userId: string} | null = null
  if (flow === 'recovery') {
    try { recoveryIntent = await findDashboardRecoveryEmail(hasHash ? {tokenHash} : {email: email.success ? email.data : '', code: String(code)}) }
    catch { return {error:'Doğrulama hizmetine ulaşılamadı. Tekrar deneyebilirsin.', code:'UNAVAILABLE'} }
    if (!recoveryIntent) return {error:'Bu bağlantı veya kod şifre yenilemek için kullanılamaz. Yeni bir şifre yenileme e-postası iste.', code:'EXPIRED'}
  }
  const type = flow === 'recovery' ? 'recovery' as const : 'email' as const
  const result = hasHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : await supabase.auth.verifyOtp({ email: email.success ? email.data : '', token: String(code), type })
  const { user, session } = result.data
  if (result.error || !user || !session) return { error: 'Bağlantı veya kod geçersiz ya da süresi dolmuş. Yeni bir e-posta iste.', code: 'EXPIRED' }
  if (flow === 'recovery') {
    if (user.id !== recoveryIntent?.userId) return {error:'Kurtarma oturumu doğrulanamadı.', code:'EXPIRED'}
    const sessionId = sessionIdFromToken(session.access_token)
    if (!sessionId) return { error: 'Oturum doğrulanamadı.', code: 'UNAVAILABLE' }
    await saveFlowGrant('recovery', user.id, sessionId)
    redirect('/auth/reset-password?' + new URLSearchParams({ next: safeNext(formData.get('next')) }).toString())
  }
  if (!await completeVerifiedSession(supabase, user, session.access_token)) return { error: 'E-postan doğrulandı. Oturumunu tamamlamak için tekrar dene.', code: 'COMPLETE_PENDING' }
  await recordEmailVerifiedDeviceSession(supabase)
  redirect(safeNext(formData.get('next'), flow === 'signup' ? '/dashboard/onboarding' : '/dashboard'))
}

export async function retryAuthCompletion(_prev: unknown, formData: FormData): Promise<AuthActionState> {
  if (!await isSameOriginRequest()) return { error: 'İstek doğrulanamadı.' }
  const supabase = await createDashboardServerClient({ authOnly: true })
  const verified = await validatedFlowSession(supabase, 'complete')
  if (!verified) return { error: 'Devam etmek için tekrar giriş yap.', code: 'EXPIRED' }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || !await completeVerifiedSession(supabase, verified.user, session.access_token)) return { error: 'Oturum henüz tamamlanamadı. Tekrar deneyebilirsin.', code: 'COMPLETE_PENDING' }
  await recordEmailVerifiedDeviceSession(supabase)
  redirect(safeNext(formData.get('next')))
}
