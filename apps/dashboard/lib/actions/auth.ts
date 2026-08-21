'use server'

import { createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import {
  deleteDashboardPushEndpoint,
  recordSignupLegalEvidence,
} from '@garsonless/db/server'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { recordSecurityEvent } from '@garsonless/db/server'
import { createDashboardServerClient } from '../supabase-server'
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
  name: z.string().trim().max(100).optional(),
  businessName: z.string().trim().max(200).optional(),
  termsAccepted: z.literal('on'),
  termsVersion: z.literal(LEGAL_DOCUMENT_VERSION),
})

const magicLinkSchema = z.object({
  email: z.string().email(),
})

const passwordResetRequestSchema = z.object({ email: z.string().email() })

function legalIpHash(ip: string | null): string | null {
  const salt = process.env['LEGAL_ACCEPTANCE_IP_SALT']?.trim()
  return ip && salt ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null
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
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

export async function signUp(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
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

  if (data.user) {
    await persistSignupLegalEvidence({
      userId: data.user.id,
      version: parsed.data.termsVersion,
      occurredAt: acceptedAt,
    })
  }

  // If the project doesn't require email confirmation, signUp returns a live
  // session → go straight to `next` (e.g. accept-invite). Otherwise the
  // confirmation email carries `next` via the callback above.
  if (data.session) redirect(next)
  return { success: true }
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
