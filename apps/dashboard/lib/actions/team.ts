'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import {
  createInvite, resendInvite, updateMemberPermissions, setMemberStatus, removeMember,
  acceptInvite, TEAM_SECTIONS, type TeamSection,
} from '@garsonless/db'
import { assertOwner, firstPermittedPath } from '../auth/access'
import { createDashboardServerClient } from '../supabase-server'

const sectionEnum = z.enum([...TEAM_SECTIONS] as [TeamSection, ...TeamSection[]])
const permsSchema = z.array(sectionEnum).min(1).max(TEAM_SECTIONS.length)
const inviteSchema = z.object({ email: z.string().email().max(255), permissions: permsSchema })
const idSchema = z.string().uuid()

function buildInviteUrl(token: string): string {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  return `${base}/auth/accept-invite?token=${token}`
}

function devUrl(url: string): { devInviteUrl?: string } {
  // Mirrors the OTP devCode pattern: surface the link only outside production so
  // invites are testable locally without a configured email provider.
  return process.env['NODE_ENV'] !== 'production' ? { devInviteUrl: url } : {}
}

async function sendInviteEmail(toEmail: string, restaurantName: string, url: string, permissions: TeamSection[]): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY']
  const from = process.env['RESEND_FROM_EMAIL']
  if (!apiKey || !from) return // dev / unconfigured → caller returns devInviteUrl instead
  const resend = new Resend(apiKey)
  await resend.emails.send({
    from,
    to: toEmail,
    subject: `${restaurantName} ekibine davet edildiniz`,
    html: `
      <h2>${restaurantName} ekibine davet edildiniz</h2>
      <p>Bu işletmenin yönetim panelinde şu bölümlere erişiminiz olacak: <b>${permissions.join(', ')}</b>.</p>
      <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#1c1814;color:#fff;border-radius:8px;text-decoration:none">Daveti kabul et</a></p>
      <p style="color:#888;font-size:12px">Bağlantı 7 gün geçerlidir. Sizi davet etmediysek bu e-postayı yok sayabilirsiniz.</p>
    `,
  })
}

export async function inviteMember(
  restaurantId: string,
  input: { email: string; permissions: string[] },
): Promise<{ error: string } | { success: true; devInviteUrl?: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz davet' }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email && user.email.trim().toLowerCase() === parsed.data.email.trim().toLowerCase()) {
    return { error: 'Kendi e-postanı davet edemezsin' }
  }
  const { data: rest } = await supabase.from('restaurants').select('name').eq('id', restaurantId).maybeSingle()
  const restaurantName = (rest as { name: string } | null)?.name ?? ''

  const res = await createInvite({ restaurantId, email: parsed.data.email, permissions: parsed.data.permissions, invitedBy: gate.userId })
  if (!res.ok) {
    return {
      error: res.error === 'already_member' ? 'Bu e-posta zaten ekip üyesi'
        : res.error === 'no_permissions' ? 'En az bir bölüm seç'
        : 'Davet oluşturulamadı',
    }
  }
  const url = buildInviteUrl(res.token)
  await sendInviteEmail(res.email, restaurantName, url, parsed.data.permissions)
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { success: true, ...devUrl(url) }
}

export async function updateMemberPermissionsAction(
  restaurantId: string,
  memberId: string,
  permissions: string[],
): Promise<{ error: string } | { success: true }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  if (!idSchema.safeParse(memberId).success) return { error: 'Geçersiz üye' }
  const parsed = permsSchema.safeParse(permissions)
  if (!parsed.success) return { error: 'En az bir bölüm seç' }
  const res = await updateMemberPermissions(restaurantId, memberId, parsed.data)
  if (!res.ok) return { error: res.error }
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { success: true }
}

export async function setMemberStatusAction(
  restaurantId: string,
  memberId: string,
  status: 'active' | 'disabled',
): Promise<{ error: string } | { success: true }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  if (!idSchema.safeParse(memberId).success) return { error: 'Geçersiz üye' }
  if (status !== 'active' && status !== 'disabled') return { error: 'Geçersiz durum' }
  const res = await setMemberStatus(restaurantId, memberId, status)
  if (!res.ok) return { error: res.error }
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { success: true }
}

export async function removeMemberAction(
  restaurantId: string,
  memberId: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  if (!idSchema.safeParse(memberId).success) return { error: 'Geçersiz üye' }
  const res = await removeMember(restaurantId, memberId)
  if (!res.ok) return { error: res.error }
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { success: true }
}

/**
 * Accept an invite for the CURRENTLY signed-in user. The DB layer only links the
 * member row when the authenticated email matches the invite email → no hijack.
 * Returns the landing path on success, or a typed error for the accept screen.
 */
export async function acceptInviteAction(
  token: string,
): Promise<{ error: 'not_authenticated' | 'invalid_or_expired' | 'email_mismatch' | string; inviteEmail?: string } | { redirectTo: string }> {
  if (typeof token !== 'string' || token.length < 16) return { error: 'invalid_or_expired' }
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'not_authenticated' }
  const res = await acceptInvite({ token, userId: user.id, userEmail: user.email })
  if (!res.ok) return { error: res.error, ...(res.inviteEmail ? { inviteEmail: res.inviteEmail } : {}) }
  return { redirectTo: firstPermittedPath(res.restaurantId, { isOwner: false, isMember: true, permissions: res.permissions }) }
}

export async function resendInviteAction(
  restaurantId: string,
  memberId: string,
): Promise<{ error: string } | { success: true; devInviteUrl?: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  if (!idSchema.safeParse(memberId).success) return { error: 'Geçersiz üye' }
  const res = await resendInvite(restaurantId, memberId)
  if (!res.ok) return { error: res.error === 'not_pending' ? 'Bu üye beklemede değil' : res.error }

  const supabase = await createDashboardServerClient()
  const { data: rest } = await supabase.from('restaurants').select('name').eq('id', restaurantId).maybeSingle()
  const url = buildInviteUrl(res.token)
  await sendInviteEmail(res.email, (rest as { name: string } | null)?.name ?? '', url, [])
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { success: true, ...devUrl(url) }
}
