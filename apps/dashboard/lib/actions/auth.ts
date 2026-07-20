'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { recordSecurityEvent } from '@garsonless/db/server'
import { createDashboardServerClient } from '../supabase-server'
import { readRequestMeta } from '../request-meta'

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const magicLinkSchema = z.object({
  email: z.string().email(),
})

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
  if (error) return { error: error.message }

  // Best-effort security audit (never blocks the login).
  if (data.user) {
    const { ip, userAgent } = await readRequestMeta()
    await recordSecurityEvent({ userId: data.user.id, eventType: 'login', ip, userAgent })
  }

  redirect(safeNext(formData.get('next')))
}

/** Only allow same-origin relative redirects (e.g. the accept-invite return path). */
function safeNext(value: FormDataEntryValue | null): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

export async function signUp(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const next = safeNext(formData.get('next'))
  const callbackUrl = `${process.env['NEXT_PUBLIC_APP_URL']}/auth/callback?next=${encodeURIComponent(next)}`

  const supabase = await createDashboardServerClient()
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: callbackUrl },
  })
  if (error) return { error: error.message }

  // If the project doesn't require email confirmation, signUp returns a live
  // session → go straight to `next` (e.g. accept-invite). Otherwise the
  // confirmation email carries `next` via the callback above.
  if (data.session) redirect(next)
  return { success: true }
}

export async function signOut(): Promise<never> {
  const supabase = await createDashboardServerClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
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
  if (error) return { error: error.message }

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
  if (error) return { error: error.message }

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
  if (error) return { error: error.message }
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
  if (error) return { error: error.message }

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
  if (updateError) return { error: updateError.message }

  // Best-effort security audit (never blocks the change).
  const { ip, userAgent } = await readRequestMeta()
  await recordSecurityEvent({ userId: user.id, eventType: 'password_change', ip, userAgent })

  return { success: true }
}
