import { platformAdminCan, type PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { err, type Result } from '@garsonless/domain/result'

export type PlatformTenantAccount = {
  userId: string | null
  memberId: string | null
  role: 'owner' | 'staff'
  membershipStatus: 'active' | 'invited' | 'disabled'
  email: string | null
  name: string | null
  phone: string | null
  createdAt: string | null
  acceptedAt: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  bannedUntil: string | null
  isBanned: boolean
  isDeleted: boolean
  isPlatformAdmin: boolean
  permissions: string[]
  pendingUnlockRequestId: string | null
}

export type PlatformTenantAccounts = {
  restaurantId: string
  accounts: PlatformTenantAccount[]
  billing: null | {
    legalName: string
    email: string
    name: string | null
    phone: string | null
    identityNumber: string | null
    address: string | null
    city: string | null
    district: string | null
    country: string | null
    zipCode: string | null
    taxOffice: string | null
  }
}

export type PlatformAccountOperation = {
  requestId: string
  status: 'completed' | 'pending' | 'failed'
}

type AuditedInput = {
  restaurantId: string
  reason: string
  requestId: string
}
type TrustedInput = AuditedInput & { actorUserId: string; actorRole: PlatformAdminActorContext['role'] }
export interface PlatformTenantAccountsPort {
  reveal(input: TrustedInput): Promise<Result<PlatformTenantAccounts>>
  reactivateMember(input: TrustedInput & { memberId: string }): Promise<Result<PlatformAccountOperation>>
  unbanUser(input: TrustedInput & { userId: string }): Promise<Result<PlatformAccountOperation>>
  reconcileUnban(input: { restaurantId: string; requestId: string; actorUserId: string; actorRole: PlatformAdminActorContext['role'] }): Promise<Result<PlatformAccountOperation>>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const PLATFORM_UNBAN_CONFIRMATION = 'GİRİŞ ENGELİNİ KALDIR'
export const PLATFORM_MEMBER_CONFIRMATION = 'EKİP ERİŞİMİNİ AÇ'

function validate(actor: PlatformAdminActorContext, input: AuditedInput, capability: 'data.manage' | 'tenant.accounts.manage') {
  if (!platformAdminCan(actor, capability)) return 'Bu işlem için Süper yönetici yetkisi gerekir.'
  if (!UUID.test(actor.userId) || !UUID.test(input.restaurantId) || !UUID.test(input.requestId)) return 'Geçersiz işlem bilgisi.'
  if (input.reason.trim().length < 10 || input.reason.trim().length > 1000) return 'Gerekçe 10–1000 karakter olmalıdır.'
  return null
}

export async function revealPlatformTenantAccounts(actor: PlatformAdminActorContext, input: AuditedInput, port: PlatformTenantAccountsPort): Promise<Result<PlatformTenantAccounts>> {
  const invalid = validate(actor, input, 'data.manage')
  if (invalid) return err(invalid)
  const result = await port.reveal({ ...input, reason: input.reason.trim(), actorUserId: actor.userId, actorRole: actor.role })
  return result.ok ? result : err('Hesap bilgileri yüklenemedi. Yetkiyi ve işletme durumunu kontrol edin.')
}

export async function activatePlatformTenantAccount(
  actor: PlatformAdminActorContext,
  input: AuditedInput & { targetId: string; kind: string; confirmation: string },
  port: PlatformTenantAccountsPort,
): Promise<Result<PlatformAccountOperation>> {
  const invalid = validate(actor, input, 'tenant.accounts.manage')
  if (invalid) return err(invalid)
  if (!UUID.test(input.targetId) || !['auth_unban', 'member_reactivate'].includes(input.kind)) return err('Geçersiz hesap işlemi.')
  const expected = input.kind === 'auth_unban' ? PLATFORM_UNBAN_CONFIRMATION : PLATFORM_MEMBER_CONFIRMATION
  if (input.confirmation.trim() !== expected) return err('Onay metni eşleşmiyor.')
  const trusted = { restaurantId: input.restaurantId, requestId: input.requestId, reason: input.reason.trim(), actorUserId: actor.userId, actorRole: actor.role }
  const result = input.kind === 'auth_unban'
    ? await port.unbanUser({ ...trusted, userId: input.targetId })
    : await port.reactivateMember({ ...trusted, memberId: input.targetId })
  return result.ok ? result : err('Hesap açılamadı. Güncel durumu yeniden yükleyin; işlem tamamlanmış sayılmadı.')
}

export async function reconcilePlatformTenantUnban(actor: PlatformAdminActorContext, input: { restaurantId: string; requestId: string }, port: PlatformTenantAccountsPort): Promise<Result<PlatformAccountOperation>> {
  if (!platformAdminCan(actor, 'tenant.accounts.manage')) return err('Bu işlem için Süper yönetici yetkisi gerekir.')
  if (!UUID.test(actor.userId) || !UUID.test(input.restaurantId) || !UUID.test(input.requestId)) return err('Geçersiz işlem bilgisi.')
  const result = await port.reconcileUnban({ ...input, actorUserId: actor.userId, actorRole: actor.role })
  return result.ok ? result : err('İşlem sonucu doğrulanamadı. Tekrar hesap açma isteği göndermeyin.')
}
