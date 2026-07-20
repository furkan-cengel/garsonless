'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import {
  createTeamCommandPort, recordSecurityEvent,
} from '@garsonless/db/server'
import {
  acceptTeamInvite,
  inviteTeamMember,
  removeTeamMember,
  resendTeamInvite,
  setTeamMemberStatus,
  updateTeamMemberPermissions,
} from '@garsonless/application/team'
import { TEAM_SECTIONS, type TeamSection } from '@garsonless/domain/team'
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!)
}

type InviteEmailDelivery =
  | { ok: true; mode: 'sent' | 'development' }
  | { ok: false }

function ownerContext(restaurantId: string, userId: string) {
  return {
    actor: 'dashboard-member' as const,
    userId,
    restaurantId,
    permissions: ['settings'],
    isOwner: true,
  }
}

async function recordTeamAudit(input: {
  userId: string
  restaurantId: string
  eventType: 'team_member_invited' | 'team_invite_resent' | 'team_member_permissions_updated' | 'team_member_disabled' | 'team_member_activated' | 'team_member_removed' | 'team_invite_accepted'
  targetEmail: string
  permissions?: string[]
}) {
  await recordSecurityEvent({
    userId: input.userId,
    restaurantId: input.restaurantId,
    eventType: input.eventType,
    metadata: {
      targetEmail: input.targetEmail,
      ...(input.permissions ? { permissions: input.permissions } : {}),
    },
  })
}

/**
 * Send an invite without treating a provider-side error as success. An invite
 * row is deliberately kept when delivery fails: the owner can use the visible
 * "Tekrar gönder" action instead of losing a valid, auditable invitation.
 */
async function sendInviteEmail(
  toEmail: string,
  restaurantName: string,
  url: string,
  permissions: TeamSection[],
): Promise<InviteEmailDelivery> {
  const apiKey = process.env['RESEND_API_KEY']
  const from = process.env['RESEND_FROM_EMAIL']
  if (!apiKey || !from) return { ok: true, mode: 'development' }
  const resend = new Resend(apiKey)
  try {
    const { error } = await resend.emails.send({
      from,
      to: toEmail,
      subject: `${restaurantName.replace(/[\r\n]/g, ' ')} ekibine davet edildiniz`,
      html: `
        <h2>${escapeHtml(restaurantName)} ekibine davet edildiniz</h2>
        <p>Bu işletmenin yönetim panelinde şu bölümlere erişiminiz olacak: <b>${escapeHtml(permissions.join(', '))}</b>.</p>
        <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#1c1814;color:#fff;border-radius:8px;text-decoration:none">Daveti kabul et</a></p>
        <p style="color:#888;font-size:12px">Bağlantı 7 gün geçerlidir. Sizi davet etmediysek bu e-postayı yok sayabilirsiniz.</p>
      `,
    })
    return error ? { ok: false } : { ok: true, mode: 'sent' }
  } catch {
    return { ok: false }
  }
}

export async function inviteMember(
  restaurantId: string,
  input: { email: string; permissions: string[] },
): Promise<{ error: string; invitePending?: true } | { success: true; devInviteUrl?: string }> {
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

  const res = await inviteTeamMember(
    ownerContext(restaurantId, gate.userId),
    { restaurantId, email: parsed.data.email, permissions: parsed.data.permissions },
    createTeamCommandPort(),
  )
  if (!res.ok) {
    return {
      error: res.error === 'already_member' ? 'Bu e-posta zaten ekip üyesi'
        : res.error === 'En az bir bölüm seç' ? 'En az bir bölüm seç'
        : 'Davet oluşturulamadı',
    }
  }
  const url = buildInviteUrl(res.value.token)
  const delivery = await sendInviteEmail(res.value.email, restaurantName, url, res.value.permissions)
  await recordTeamAudit({
    userId: gate.userId,
    restaurantId,
    eventType: res.value.reinvited ? 'team_invite_resent' : 'team_member_invited',
    targetEmail: res.value.email,
    permissions: res.value.permissions,
  })
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  if (!delivery.ok) {
    return {
      error: 'Davet oluşturuldu ancak e-posta gönderilemedi. Ekip listesinden tekrar gönderebilirsin.',
      invitePending: true,
    }
  }
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
  const res = await updateTeamMemberPermissions(
    ownerContext(restaurantId, gate.userId),
    { restaurantId, memberId, permissions: parsed.data },
    createTeamCommandPort(),
  )
  if (!res.ok) return { error: res.error }
  await recordTeamAudit({
    userId: gate.userId,
    restaurantId,
    eventType: 'team_member_permissions_updated',
    targetEmail: res.value.email,
    permissions: res.value.permissions,
  })
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
  const res = await setTeamMemberStatus(
    ownerContext(restaurantId, gate.userId),
    { restaurantId, memberId, status },
    createTeamCommandPort(),
  )
  if (!res.ok) {
    return { error: res.error === 'not_found_or_pending_invite' ? 'Bekleyen davet yalnız davet bağlantısıyla etkinleşir' : res.error }
  }
  await recordTeamAudit({
    userId: gate.userId,
    restaurantId,
    eventType: status === 'active' ? 'team_member_activated' : 'team_member_disabled',
    targetEmail: res.value.email,
    permissions: res.value.permissions,
  })
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
  const res = await removeTeamMember(
    ownerContext(restaurantId, gate.userId),
    { restaurantId, memberId },
    createTeamCommandPort(),
  )
  if (!res.ok) return { error: res.error }
  await recordTeamAudit({
    userId: gate.userId,
    restaurantId,
    eventType: 'team_member_removed',
    targetEmail: res.value.email,
  })
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
  const res = await acceptTeamInvite({ token, userId: user.id, userEmail: user.email }, createTeamCommandPort())
  if (!res.ok) return { error: res.error, ...(res.inviteEmail ? { inviteEmail: res.inviteEmail } : {}) }
  await recordTeamAudit({
    userId: user.id,
    restaurantId: res.value.restaurantId,
    eventType: 'team_invite_accepted',
    targetEmail: res.value.email,
    permissions: res.value.permissions,
  })
  return { redirectTo: firstPermittedPath(res.value.restaurantId, { isOwner: false, isMember: true, permissions: res.value.permissions }) }
}

export async function resendInviteAction(
  restaurantId: string,
  memberId: string,
): Promise<{ error: string } | { success: true; devInviteUrl?: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  if (!idSchema.safeParse(memberId).success) return { error: 'Geçersiz üye' }
  const res = await resendTeamInvite(
    ownerContext(restaurantId, gate.userId),
    { restaurantId, memberId },
    createTeamCommandPort(),
  )
  if (!res.ok) return { error: res.error === 'not_pending' ? 'Bu üye beklemede değil' : res.error }

  const supabase = await createDashboardServerClient()
  const { data: rest } = await supabase.from('restaurants').select('name').eq('id', restaurantId).maybeSingle()
  const url = buildInviteUrl(res.value.token)
  const delivery = await sendInviteEmail(res.value.email, (rest as { name: string } | null)?.name ?? '', url, res.value.permissions)
  await recordTeamAudit({
    userId: gate.userId,
    restaurantId,
    eventType: 'team_invite_resent',
    targetEmail: res.value.email,
    permissions: res.value.permissions,
  })
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  if (!delivery.ok) return { error: 'E-posta gönderilemedi. Lütfen tekrar dene.' }
  return { success: true, ...devUrl(url) }
}
