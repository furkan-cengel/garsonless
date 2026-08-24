import 'server-only'

import { consumeDashboardAuthRateLimit } from '@garsonless/db/server'
import { createDashboardServerClient } from '../supabase-server'
import { readRequestMeta } from '../request-meta'
import { assertOwner } from './access'

/** Password-based fresh authentication for high-impact owner operations. OAuth
 * and passwordless owners must first create a password from the Security page;
 * a remembered browser session alone is deliberately insufficient. */
export async function requireFreshOwnerPassword(
  restaurantId: string,
  currentPassword: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return { ok: false, error: gate.error }
  if (!currentPassword || currentPassword.length > 256) {
    return { ok: false, error: 'Bu işlem için hesap şifresi gerekli.' }
  }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || user.id !== gate.userId) return { ok: false, error: 'Oturum bulunamadı.' }
  const { ip } = await readRequestMeta()
  const limits = await Promise.all([
    consumeDashboardAuthRateLimit({ action: 'owner-step-up', subject: `subject:${user.id}`, limit: 5, windowSeconds: 900 }),
    ...(ip ? [consumeDashboardAuthRateLimit({ action: 'owner-step-up', subject: `ip:${ip}`, limit: 10, windowSeconds: 900 })] : []),
  ])
  if (!limits.every((limit) => limit.ok && limit.allowed)) {
    return { ok: false, error: 'Çok fazla doğrulama denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' }
  }
  const [factors, assurance] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  const hasVerifiedTotp = !factors.error && factors.data.totp.some((factor) => factor.status === 'verified')
  if (hasVerifiedTotp && (assurance.error || assurance.data.currentLevel !== 'aal2')) {
    return { ok: false, error: 'Bu işlem için önce Authenticator koduyla AAL2 doğrulaması yapın.' }
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  return error
    ? { ok: false, error: 'Hesap şifresi doğrulanamadı.' }
    : { ok: true, userId: gate.userId }
}
