import type { PlatformAccountOperation, PlatformTenantAccount, PlatformTenantAccounts, PlatformTenantAccountsPort } from '@garsonless/application/platform-admin-tenant-accounts'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type RpcName = 'reveal_platform_admin_tenant_accounts' | 'reactivate_platform_admin_tenant_member' | 'prepare_platform_admin_user_unban' | 'finish_platform_admin_user_unban'
export type PlatformAccountsRpc = (name: RpcName, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
export type UnbanAuthUser = (userId: string) => Promise<'accepted' | 'rejected' | 'uncertain'>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object')
  return value as Record<string, unknown>
}
function text(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string') throw new Error('Invalid text')
  return value
}
function id(value: unknown, nullable = false): string | null {
  const result = text(value, nullable)
  if (result !== null && !UUID.test(result)) throw new Error('Invalid id')
  return result
}
function date(value: unknown): string | null {
  const result = text(value, true)
  if (result !== null && Number.isNaN(Date.parse(result))) throw new Error('Invalid date')
  return result
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid flag')
  return value
}
function account(value: unknown): PlatformTenantAccount {
  const row = record(value)
  if (row.role !== 'owner' && row.role !== 'staff') throw new Error('Invalid role')
  if (row.membershipStatus !== 'active' && row.membershipStatus !== 'invited' && row.membershipStatus !== 'disabled') throw new Error('Invalid membership')
  if (!Array.isArray(row.permissions) || !row.permissions.every((item) => typeof item === 'string')) throw new Error('Invalid permissions')
  return {
    userId: id(row.userId, true), memberId: id(row.memberId, true), role: row.role, membershipStatus: row.membershipStatus,
    email: text(row.email, true), name: text(row.name, true), phone: text(row.phone, true),
    createdAt: date(row.createdAt), acceptedAt: date(row.acceptedAt), lastSignInAt: date(row.lastSignInAt), emailConfirmedAt: date(row.emailConfirmedAt), bannedUntil: date(row.bannedUntil),
    isBanned: bool(row.isBanned), isDeleted: bool(row.isDeleted), isPlatformAdmin: bool(row.isPlatformAdmin),
    permissions: [...row.permissions], pendingUnlockRequestId: id(row.pendingUnlockRequestId, true),
  }
}
function accounts(value: unknown, restaurantId: string): PlatformTenantAccounts {
  const row = record(value)
  if (row.restaurantId !== restaurantId || !Array.isArray(row.accounts)) throw new Error('Invalid tenant')
  let billing: PlatformTenantAccounts['billing'] = null
  if (row.billing !== null) {
    const b = record(row.billing)
    billing = {
      legalName: text(b.legalName)!, email: text(b.email)!, name: text(b.name, true), phone: text(b.phone, true), identityNumber: text(b.identityNumber, true),
      address: text(b.address, true), city: text(b.city, true), district: text(b.district, true), country: text(b.country, true), zipCode: text(b.zipCode, true), taxOffice: text(b.taxOffice, true),
    }
  }
  return { restaurantId, accounts: row.accounts.map(account), billing }
}
function operation(value: unknown, requestId: string): PlatformAccountOperation {
  const row = record(value)
  if (row.requestId !== requestId || !['completed', 'pending', 'failed'].includes(row.status as string)) throw new Error('Invalid operation')
  return { requestId, status: row.status as PlatformAccountOperation['status'] }
}
function args(input: { restaurantId: string; actorUserId: string; actorRole: string; requestId: string }) {
  return { p_restaurant_id: input.restaurantId, p_actor_user_id: input.actorUserId, p_actor_role: input.actorRole, p_request_id: input.requestId }
}
function serviceRpc(): PlatformAccountsRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformAccountsRpc
}
async function authUnban(userId: string): Promise<'accepted' | 'rejected' | 'uncertain'> {
  try {
    // This is a global Auth ban only; no password, MFA, email confirmation or metadata is changed.
    const { error } = await createServiceClient().auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (!error) return 'accepted'
    return error.status && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429 ? 'rejected' : 'uncertain'
  } catch { return 'uncertain' }
}

export function createPlatformAdminTenantAccountsPort(rpc: PlatformAccountsRpc = serviceRpc(), unban: UnbanAuthUser = authUnban): PlatformTenantAccountsPort {
  const finish = async (input: Parameters<PlatformTenantAccountsPort['reconcileUnban']>[0], rejected = false) => {
    try {
      const result = await rpc('finish_platform_admin_user_unban', { ...args(input), p_rejected: rejected })
      if (result.error) return err('platform_account_unban_unconfirmed')
      return ok(operation(result.data, input.requestId))
    } catch { return err('platform_account_unban_unconfirmed') }
  }
  return {
    async reveal(input) {
      try {
        const result = await rpc('reveal_platform_admin_tenant_accounts', { ...args(input), p_reason: input.reason })
        if (result.error) return err('platform_accounts_reveal_failed')
        return ok(accounts(result.data, input.restaurantId))
      } catch { return err('platform_accounts_reveal_failed') }
    },
    async reactivateMember(input) {
      try {
        const result = await rpc('reactivate_platform_admin_tenant_member', { ...args(input), p_member_id: input.memberId, p_reason: input.reason })
        if (result.error) return err('platform_member_reactivation_failed')
        return ok(operation(result.data, input.requestId))
      } catch { return err('platform_member_reactivation_failed') }
    },
    async unbanUser(input) {
      try {
        const prepared = await rpc('prepare_platform_admin_user_unban', { ...args(input), p_user_id: input.userId, p_reason: input.reason })
        if (prepared.error) return err('platform_account_unban_failed')
        const pending = operation(prepared.data, input.requestId)
        const execute = bool(record(prepared.data).execute)
        if (!execute) return ok(pending)
        if (pending.status !== 'pending') return err('platform_account_unban_failed')
        // Durable intent must exist before crossing the Auth API boundary.
        let outcome: Awaited<ReturnType<UnbanAuthUser>> = 'uncertain'
        try { outcome = await unban(input.userId) } catch { /* Reconcile from persisted Auth state. */ }
        const completed = await finish(input, outcome === 'rejected')
        return completed.ok ? completed : ok(pending)
      } catch { return err('platform_account_unban_failed') }
    },
    reconcileUnban: finish,
  }
}
